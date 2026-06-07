# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).
# pulsemaint

## Environment configuration

Copy `.env.example` to `.env` and fill in the values.

### Reports → Google Sheets push (optional)

The Reports module can push a report straight into a new Google Sheet. This
needs a Google OAuth client:

1. In Google Cloud Console, enable the **Google Sheets API**.
2. Create an **OAuth 2.0 Client ID** (Application type: *Web application*).
3. Add your app origins to **Authorized JavaScript origins** and **Authorized
   redirect URIs** (e.g. `http://localhost:5173` for dev and your deployed
   `VITE_APP_URL`).
4. Put the client ID in `VITE_GOOGLE_OAUTH_CLIENT_ID`.

Scopes (`spreadsheets`, `drive.file`) are requested at runtime when the user
connects their Google account in the report panel. If the variable is left
blank, the **Sheets** button falls back to a CSV download (which imports
cleanly into Google Sheets / Excel).

### Analytics

The Analytics dashboards and reports compute their metrics client-side from the
operational collections (breakdowns, work orders, contractor jobs, PM history,
machines) when the pre-aggregated `analytics_monthly` / `analytics_daily` /
`machine_health` collections are empty — so no backend aggregation job is
required for them to work.
