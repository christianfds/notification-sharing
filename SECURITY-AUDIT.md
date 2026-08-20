# Security Audit

Date: 2026-08-20

## Scope

The audit covered the Express/Prisma backend, REST and WebSocket authorization, JWT and refresh-token handling, frontend token handling, validation, soft deletion, deployment configuration, secrets, and npm dependencies.

## Remediated

- Notification responses no longer expose sender password hashes. Sender relations use an explicit public-field selection.
- Access-token requests now revalidate that the user is active and that the current role still matches the token.
- WebSocket handshakes also revalidate the current user session and reject unexpected browser origins when `CORS_ORIGIN` is configured.
- Refresh tokens are hashed at rest and rotated on refresh. Existing plaintext refresh tokens will require users to log in again after deployment of this change.
- Login requests have a bounded per-IP rate limit in addition to username lockout logic.
- JSON and URL-encoded request bodies are capped at 16 KB.
- WebSocket payloads are capped at 16 KB.
- Production JWT secrets must be at least 32 characters and cannot use placeholder values. Bcrypt cost is validated between 10 and 15.
- Production seeding requires `ADMIN_INITIAL_PASSWORD`; development seeding generates a random initial password when one is not supplied.
- Soft-deleted notifications are excluded from Pastor feeds and direct Pastor lookups. Secretary/Admin history can restore them.

## Dependency Results

`npm audit --omit=dev --workspaces` reports **0 production vulnerabilities**.

The full audit reports vulnerabilities in development tooling: Vite, Vitest, Vite Node, and esbuild. The available automatic fix requires a breaking Vitest upgrade. These affect development/test tooling rather than the production backend dependency set, but the Vite development server must never be exposed to an untrusted network.

## Residual Risks

- The in-memory login rate limiter is per process. Production deployments with multiple instances need a shared limiter such as Redis.
- Refresh-token reuse detection and token-family revocation are not implemented. Tokens are hashed and rotated, but a stolen token is not actively detected as reused after rotation.
- WebSocket bearer tokens are still passed in the connection URL. A short-lived WebSocket ticket or header-based upgrade authentication would reduce URL-log exposure.
- Authorization is instance-wide. Secretaries/Admins can operate on notifications from the shared instance. If multiple congregations share one deployment, tenant boundaries are required.
- Production deployment still needs HTTPS, a trusted reverse-proxy configuration, restricted database networking, secure secret injection, and a non-privileged database role.
- The initial Admin password must be changed after first login, and Supabase/database credentials must never be committed or placed in frontend environment variables.

## Verification

- `npm run build` passes.
- `npm test` passes with no test files because optional test tasks were intentionally skipped.
- `npm audit --omit=dev --workspaces` reports zero production vulnerabilities.
