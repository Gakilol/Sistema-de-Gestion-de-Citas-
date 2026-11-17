# NovaCita development workflow

- Work on the `desarrollo` branch. Commits and pushes to `desarrollo` are authorized.
- Do not push, merge, promote, or otherwise release code to `main` or Vercel Production without the user's explicit approval for that release.
- Keep the existing Neon project `Citas` (`late-unit-50798422`) on its `main` branch (`br-still-fog-aj98aqjv`), as explicitly requested by the user. Preview and production share this database.
- Database migrations must be additive and backwards compatible. Do not run test fixtures, destructive migrations, seeds, or data cleanup against the shared database.
- Every working session with code changes must end with a verified Vercel Preview deployment of the latest `desarrollo` commit and its URL. Check deployment status and commit SHA; do not substitute the production URL.
- Store credentials only in ignored local environment files or Vercel server secrets. Never print or commit credentials.
- Preserve the current timezone helpers and appointment concurrency checks.
- For the assistant, keep client identities and internal query results inside NovaCita. The free Gemini API receives only allowlisted operational commands and temporary catalog references. Appointment creation requires the separate on-screen confirmation endpoint.
