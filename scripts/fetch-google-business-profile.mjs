import { mkdir, writeFile } from "node:fs/promises";

const outputPath = new URL("../public/data/google-business-profile-summary.json", import.meta.url);
const required = ["GBP_CLIENT_ID", "GBP_CLIENT_SECRET", "GBP_REFRESH_TOKEN"];
const missing = required.filter((name) => !process.env[name]);

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });

if (missing.length) {
  await writeFile(outputPath, JSON.stringify({ available: false, reason: "not_configured" }) + "\n");
  console.log("Google Business Profile secrets are not configured; publishing the site without a summary.");
  process.exit(0);
}

async function fetchAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GBP_CLIENT_ID,
    client_secret: process.env.GBP_CLIENT_SECRET,
    refresh_token: process.env.GBP_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    const knownCodes = new Set(["invalid_client", "invalid_grant", "unauthorized_client", "invalid_request"]);
    const errorCode = knownCodes.has(result.error) ? result.error : "unknown";
    throw new Error(`Google OAuth token request failed (HTTP ${response.status}, ${errorCode}).`);
  }
  return result.access_token;
}

async function fetchReviews(accessToken) {
  const account = "105765779662568090049";
  const location = "11536416076404130194";
  let pageToken = "";
  let reviewCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let newestReviewTime = null;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${account}/locations/${location}/reviews`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Google Business Profile API returned HTTP ${response.status}.`);
    }
    const result = await response.json();
    for (const review of result.reviews || []) {
      reviewCount += 1;
      const rating = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[review.starRating];
      if (rating) {
        ratingSum += rating;
        ratingCount += 1;
      }
      const timestamp = review.updateTime || review.createTime;
      if (timestamp && (!newestReviewTime || timestamp > newestReviewTime)) newestReviewTime = timestamp;
    }
    pageToken = result.nextPageToken || "";
  } while (pageToken);

  return {
    available: true,
    reviewCount,
    averageRating: ratingCount ? Number((ratingSum / ratingCount).toFixed(2)) : null,
    newestReviewTime,
    fetchedAt: new Date().toISOString(),
  };
}

try {
  const summary = await fetchReviews(await fetchAccessToken());
  await writeFile(outputPath, JSON.stringify(summary, null, 2) + "\n");
  console.log("Google Business Profile aggregate summary refreshed.");
} catch (error) {
  await writeFile(outputPath, JSON.stringify({ available: false, reason: "temporarily_unavailable" }) + "\\n");
  console.error(error instanceof Error ? error.message : "Google Business Profile refresh failed.");
  process.exitCode = 1;
}
