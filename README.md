# TinyCloud

A mini-cloud for deploying your projects.

TinyCloud is a small, self-hostable web app built around four things: **users**,
**projects**, **project membership**, and **host stats**. It is a Go API backed by
Postgres with a Next.js frontend. This version intentionally leaves out
instances, Docker orchestration, GitHub, Cloudflare, Tailscale and deploy
pipelines.

## Features

- First-run setup: the first administrator is created from the web UI.
- Admin-managed user accounts (registration is disabled).
- Projects with `owner` / `member` roles and admin-only project creation.
- Host-only stats (CPU, RAM, disk, uptime) sampled every 60 seconds, kept 90 days.
- One frontend that works locally, on Vercel, and in a shared Docker instance.

## Repository layout

```
back-end/    Go API (net/http, pgxpool, embedded SQL migrations)
front-end/   Next.js 16 app (App Router, Tailwind, shadcn-style UI)
docker/      Development compose files
Makefile     Local and Docker workflows
```

## Requirements

- Go 1.26 or newer
- Node.js 24 or newer
- npm
- Docker (for the Postgres container or the full stack)

## Quick start (local development)

```bash
cp .env.example .env
make db-up      # Postgres on 127.0.0.1:5433
make api-dev    # Go API on 127.0.0.1:5950

# in another terminal
make web-dev    # Next.js on http://localhost:3000
```

Open <http://localhost:3000>. On an empty database the login page redirects to
`/setup`, where you create the first administrator and are signed in
automatically.

To start over from scratch:

```bash
make db-reset   # removes the development Postgres volume (destructive)
```

## First-run setup

- `GET /setup/status` is public and returns `{ "needs_setup": true }` while the
  users table is empty.
- `POST /setup` creates the first `admin` and returns a session token. It uses a
  Postgres advisory transaction lock, so concurrent setup requests cannot create
  two administrators; after the first success it returns `409`.
- Once any user exists, `/setup` redirects to `/login`.

An optional environment bootstrap remains available for automated deployments:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=a-long-password
ADMIN_USERNAME=admin
ADMIN_DISPLAY_NAME=TinyCloud Admin
```

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` to seed the first administrator on
startup. Leave both empty (the default in the compose files) to use the UI.

## Roles and permissions

There are two independent role systems:

- **Global role:** `admin` or `user`.
- **Project role:** `owner` or `member`.

| Action | Global admin | Project owner | Project member |
| --- | --- | --- | --- |
| See all projects | yes | only memberships | only memberships |
| Create / delete projects | yes | no | no |
| Edit project name / description | yes | yes | no |
| Change project slug | yes | no | no |
| Add / remove regular members | yes | yes | no |
| Promote / demote owners | yes | no | no |
| Remove another owner | yes | no | no |
| View host stats | yes | no | no |
| Create / delete users | yes | no | no |

Additional rules:

- The admin who creates a project becomes its `owner` automatically.
- Non-members of a project receive `404` (the project's existence is not leaked).
- Deleting a project is a soft delete: its name and slug become reusable and the
  memberships are removed.
- A user cannot delete their own account, and the last administrator cannot be
  deleted.

## Privacy

- Email addresses are visible only to the owner of the account and to global
  admins.
- User search (used to add project members) and member lists never include email.
- Avatars are generated from the username, so they do not expose the email.

## Host stats

Stats are admin-only. In this version the collector reads directly from the host
filesystem, so the API needs no Docker socket access. That keeps the current
deployment small; a future version can add Docker-backed features without this
being a permanent design constraint.

- Sampling interval: `STATS_INTERVAL` (default `60s`, minimum `5s`).
- Retention: `STATS_RETENTION_DAYS` (default `90`, maximum `3660`).
- `HOST_PROC` and `HOST_ROOT` select the `/proc` and root filesystem paths.
- The full compose stack mounts the real host paths read-only:

  ```yaml
  volumes:
    - /proc:/host/proc:ro
    - /:/host:ro
  ```

  with `HOST_PROC=/host/proc` and `HOST_ROOT=/host`.

> With Docker Desktop on macOS or Windows, `/proc` and `/` are those of the Linux
> VM, not of the host operating system.

## Docker

### Postgres only

```bash
make db-up     # start
make db-logs   # follow logs
make db-down   # stop
make db-reset  # stop and delete the volume (destructive)
```

Compose file: `docker/docker.dev.postgres.yml`. Postgres listens on
`127.0.0.1:5433` to avoid clashing with a local server on 5432.

### Full validation stack

```bash
make stack-up     # build and start db + api + web
make stack-ps     # status
make stack-logs   # follow logs
make stack-down   # stop
make stack-reset  # stop and delete the volume (destructive)
```

Compose file: `docker/docker.dev.full.yml`.

- **web**: publicly exposed on <http://localhost:3000>.
- **api**: exposed only on `127.0.0.1:5950` for debugging.
- **db**: internal only.

The frontend calls same-origin `/api/*`, and Next.js rewrites those requests to
`API_PROXY_TARGET`. The target is baked in at build time, so the compose file
passes `http://api:5950` as a Docker build arg.

There is no production compose file yet; these files are for development and
end-to-end validation.

## Vercel

Deploy `front-end` as the project root and set:

```env
API_PROXY_TARGET=https://api.your-domain.example
```

Notes:

- `API_PROXY_TARGET` is read by `next.config.ts` during `next build`; changing it
  requires a new deployment.
- The API must be reachable from Vercel over HTTPS.
- Requests from the browser go to the Vercel app and are proxied server-side, so
  browser CORS does not apply to the normal flow.
- If you call the API directly from another origin, add that origin to
  `CORS_ORIGIN` on the API.

## Environment variables

Backend (`back-end/`):

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string |
| `JWT_SECRET` | required | At least 16 characters |
| `HOST` / `PORT` | `0.0.0.0` / `5950` | API listen address |
| `CORS_ORIGIN` | localhost:3000 origins | Comma-separated allowed origins |
| `ADMIN_EMAIL` | empty | Optional bootstrap admin email |
| `ADMIN_USERNAME` | `admin` | Optional bootstrap username |
| `ADMIN_DISPLAY_NAME` | `TinyCloud Admin` | Optional bootstrap display name |
| `ADMIN_PASSWORD` | empty | Optional bootstrap password (min 8 chars) |
| `STATS_INTERVAL` | `60s` | Host sampling interval |
| `STATS_RETENTION_DAYS` | `90` | Host sample retention |
| `HOST_PROC` | `/proc` | Path to host `/proc` |
| `HOST_ROOT` | `/` | Path to host root filesystem |
| `PG_POOL_MAX` | `10` | Max Postgres connections |
| `PG_POOL_MIN` | `2` | Warm Postgres connections |
| `PG_POOL_MAX_LIFETIME` | `30m` | Connection max age |
| `PG_POOL_MAX_IDLE` | `5m` | Max idle time |
| `PG_POOL_HEALTH_PERIOD` | `30s` | Pool health check period |
| `PG_CONNECT_TIMEOUT` | `10s` | Initial connection timeout |

Frontend (`front-end/`):

| Variable | Default | Notes |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://127.0.0.1:5950` | Build-time `/api` rewrite target |
| `API_URL` / `NEXT_PUBLIC_API_URL` | `/api` | Optional direct API base URL |

## API overview

All protected routes expect `Authorization: Bearer <token>`. Errors use
`{ "error": "...", "message": "..." }`.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/healthz` | public |
| `GET` | `/setup/status` | public |
| `POST` | `/setup` | public, only while no users exist |
| `POST` | `/auth/login` | public |
| `GET` / `PATCH` | `/auth/me` | authenticated |
| `GET` | `/users?q=` | authenticated |
| `GET` | `/users/{username}` | authenticated |
| `GET` / `POST` | `/admin/users` | admin |
| `DELETE` | `/admin/users/{id}` | admin |
| `GET` | `/projects` | authenticated (scoped) |
| `POST` | `/projects` | admin |
| `GET` / `PATCH` | `/projects/{id}` | member / owner or admin |
| `DELETE` | `/projects/{id}` | admin |
| `GET` / `POST` | `/projects/{id}/members` | member / owner or admin |
| `PATCH` | `/projects/{id}/members/{userId}` | admin |
| `DELETE` | `/projects/{id}/members/{userId}` | owner (members only) or admin |
| `GET` | `/admin/stats/overview` | admin |
| `GET` | `/admin/stats/history?days=&tz=` | admin |

## Development commands

```bash
make help     # list targets
make install  # install backend modules and frontend dependencies
make test     # backend tests
make check    # go vet + tests
make build    # build backend and frontend
make fmt      # gofmt
```

## Security notes

- Set a long, random `JWT_SECRET` outside development.
- Put the public deployment behind TLS and a reverse proxy.
- TinyCloud does not ship rate limiting; add it at the proxy for public
  deployments.
- Passwords are hashed with bcrypt and JWTs expire after 24 hours.
