import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const required = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_ACCOUNT_ID",
  "GOOGLE_LOCATION_ID",
  "GOOGLE_ALLOWED_FIREBASE_UID",
  "FIREBASE_PROJECT_ID",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required configuration: ${name}`);
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://site-proj.github.io";
const port = Number(process.env.PORT || 8080);
let tokenCache = { value: "", expiresAt: 0 };
let summaryCache = { value: null, expiresAt: 0 };

function response(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": allowedOrigin,
      "vary": "Origin",
      ...extra,
    },
  });
}

async function googleAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const result = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await result.json();
  if (!result.ok || !data.access_token) throw new Error("Google OAuth token refresh failed");
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return tokenCache.value;
}

async function loadReviewSummary() {
  if (summaryCache.value && Date.now() < summaryCache.expiresAt) return summaryCache.value;
  const accessToken = await googleAccessToken();
  const accountId = process.env.GOOGLE_ACCOUNT_ID.replace(/^accounts\\//, "");
  const locationId = process.env.GOOGLE_LOCATION_ID.replace(/^locations\\//, "");
  const account = encodeURIComponent(accountId);
  const location = encodeURIComponent(locationId);
  let pageToken;
  let reviewCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let newestReviewTime = null;
  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${account}/locations/${location}/reviews`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const result = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!result.ok) throw new Error(`Google Business Profile API returned ${result.status}`);
    const data = await result.json();
    for (const review of data.reviews || []) {
      reviewCount += 1;
      const stars = Number(review.starRating);
      const values = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
      if (values[review.starRating]) {
        ratingSum += values[review.starRating];
        ratingCount += 1;
      } else if (Number.isFinite(stars) && stars > 0) {
        ratingSum += stars;
        ratingCount += 1;
      }
      const date = review.updateTime || review.createTime;
      if (date && (!newestReviewTime || date > newestReviewTime)) newestReviewTime = date;
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  const summary = {
    reviewCount,
    averageRating: ratingCount ? Number((ratingSum / ratingCount).toFixed(2)) : null,
    newestReviewTime,
    fetchedAt: new Date().toISOString(),
  };
  summaryCache = { value: summary, expiresAt: Date.now() + 5 * 60_000 };
  return summary;
}

const server = null;

async function handleRequest(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) return response(403, { error: "Origin not allowed" });
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": allowedOrigin,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600",
        "vary": "Origin",
      },
    });
  }
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/api/google/reviews/summary") {
    return response(404, { error: "Not found" });
  }
  const bearer = request.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) return response(401, { error: "Authentication required" });
  try {
    const identity = await getAuth().verifyIdToken(bearer.slice(7));
    if (identity.uid !== process.env.GOOGLE_ALLOWED_FIREBASE_UID) {
      return response(403, { error: "Account not allowed" });
    }
    return response(200, await loadReviewSummary());
  } catch {
    return response(502, { error: "Unable to load Google review summary" });
  }
}

if (!server) {
  const { createServer } = await import("node:http");
  createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const result = await handleRequest(request);
    res.writeHead(result.status, Object.fromEntries(result.headers.entries()));
    res.end(Buffer.from(await result.arrayBuffer()));
  }).listen(port, "0.0.0.0");
}
