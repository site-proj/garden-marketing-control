# Google Business Profile summary service

This small Node service keeps the OAuth refresh token and client secret on the server. It exposes only a summary (review count, average rating, latest review time), not reviewer names or review text. Requests require a Firebase ID token from the existing Garden Studio login and are restricted to one configured Firebase UID. Results are cached in memory for five minutes.

## Runtime configuration

Deploy this directory as a Cloud Run service in Google Cloud project `garden-analytics-511519`. Use a dedicated Cloud Run runtime service identity with Application Default Credentials; no service-account key file is required in source. Store the OAuth secret and refresh token in Secret Manager and configure these Cloud Run variables:

- `GOOGLE_CLIENT_ID`: OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: newly rotated OAuth client secret (Secret Manager reference).
- `GOOGLE_REFRESH_TOKEN`: refresh token generated for this OAuth client with the `https://www.googleapis.com/auth/business.manage` scope (Secret Manager reference).
- `GOOGLE_ACCOUNT_ID`: `accounts/105765779662568090049`.
- `GOOGLE_LOCATION_ID`: `locations/11536416076404130194`.
- `GOOGLE_ALLOWED_FIREBASE_UID`: UID for the Garden Studio account allowed to see the summary.
- `FIREBASE_PROJECT_ID`: `garden-marketing-control`.
- `ALLOWED_ORIGIN`: `https://site-proj.github.io`.

The OAuth consent must be granted by an account with access to the listed Business Profile. OAuth Playground tokens are not read from the repository and must not be assumed available to this service.

## Endpoint and dashboard

The endpoint is `GET /api/google/reviews/summary` with `Authorization: Bearer <Firebase ID token>`. The response contains aggregate review metrics only. Non-Garden Studio users are rejected.

The Garden Studio dashboard calls this endpoint only when `NEXT_PUBLIC_GBP_API_URL` is set at build time. Add a GitHub Actions repository variable with that exact name and the Cloud Run service's base URL (no trailing slash). It is a public URL, not a secret. The deploy workflow passes it only to the static build. The existing Firebase login, Firestore history, manual entries, CSV import/export, and scan reporting continue to work independently.

## Deploy

1. In Google Cloud project `garden-analytics-511519`, deploy this directory to Cloud Run with Node.js 20 or later.
2. Keep the OAuth client secret and refresh token in Secret Manager. Grant the Cloud Run runtime identity access to those secret versions. Use Application Default Credentials; do not add a service-account key to the repository.
3. Configure the variables listed above. Cloud Run invocation can be public because the endpoint independently verifies Firebase ID tokens and restricts the allowed UID; never remove that check.
4. Set `NEXT_PUBLIC_GBP_API_URL` as a repository variable in GitHub, then publish the Garden Studio site.
5. Sign in to the Garden Studio account whose UID is configured and use “Conectar e consultar avaliações” on Analytics.

No secret belongs in GitHub source, the static frontend, or a `NEXT_PUBLIC_*` variable. The current Garden Studio deployment is a static GitHub Pages export, so the API must remain a separate server-side service.
