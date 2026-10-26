# Google Business Profile summary service

This small Node service keeps the OAuth refresh token and client secret on the server. It exposes only a summary (review count, average rating, latest review time), not reviewer names or review text. Requests require a Firebase ID token from the existing Garden Studio login and are restricted to one configured Firebase UID. Results are cached in memory for five minutes.

## Runtime configuration

Deploy this directory as a Cloud Run service in Google Cloud project `garden-analytics-511519`. Grant the runtime service account permission to verify Firebase ID tokens for the Garden Studio Firebase project. Set these values in Cloud Run; store the OAuth secret and refresh token in Secret Manager:

- `GOOGLE_CLIENT_ID`: OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: newly rotated OAuth client secret.
- `GOOGLE_REFRESH_TOKEN`: refresh token from the authorized OAuth flow (not an OAuth Playground token unless deliberately generated for this production client and securely saved).
- `GOOGLE_ACCOUNT_ID`: `accounts/105765779662568090049`.
- `GOOGLE_LOCATION_ID`: `locations/11536416076404130194`.
- `GOOGLE_ALLOWED_FIREBASE_UID`: UID for the Garden Studio account allowed to see the summary.
- `FIREBASE_PROJECT_ID`: Garden Studio Firebase project ID.
- `ALLOWED_ORIGIN`: `https://site-proj.github.io`.

The Google OAuth grant must include `https://www.googleapis.com/auth/business.manage`. Do not add secrets to GitHub, the static frontend, or build-time `NEXT_PUBLIC_*` variables.

## Endpoint

`GET /api/google/reviews/summary` with `Authorization: Bearer <Firebase ID token>`. The response contains aggregate review metrics only. Non-Garden Studio users are rejected.

The Garden Studio dashboard must be configured with this service's URL before it can call the endpoint. The current Garden Studio deployment is a static GitHub Pages export, so the API must remain a separate server-side service. No OAuth Playground credentials are available to this code.

## Deploy

From this folder, deploy the source to Cloud Run with Node.js 20 or later. Configure each secret as a Secret Manager reference and grant the Cloud Run runtime identity access to those secret versions. Keep unauthenticated Cloud Run invocation enabled only because application requests are independently verified using Firebase Auth; never omit the Firebase token check.
