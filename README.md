# WatchParty

WatchParty is a full-stack movie browsing and synchronized watch-party application. Users can register and verify their email address, browse a movie library, create or join a room, invite other verified users, chat, and keep video playback synchronized in real time.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Express 5, Socket.IO, TypeScript
- **Data:** PostgreSQL and Prisma
- **Authentication:** JWTs stored in HTTP-only cookies
- **Email:** SMTP via Nodemailer for account verification and password reset codes

## Repository layout

```text
frontend/   Next.js application and static artwork
backend/    Express API, Socket.IO server, Prisma schema, migrations, and tests
```

## Prerequisites

- Node.js 20 or newer (Node 22 LTS recommended)
- npm 10 or newer
- A running PostgreSQL database
- An SMTP account that can send email. The backend verifies its SMTP connection when it starts, so these credentials are required even for local use.

## Clone and install

Replace the placeholder URL with the URL of your GitHub repository.

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY

cd frontend
npm ci

cd ../backend
npm ci
```

## Configure the backend

Create `backend/.env`. Do not commit this file: it contains database credentials, JWT secrets, and SMTP credentials.

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/watchparty?schema=public"

# Local API settings
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

# Use long, random values. Do not reuse these example strings in a real deployment.
JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-refresh-secret

# SMTP settings used for verification and password-reset codes
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="WatchParty <no-reply@example.com>"
```

This repository currently provides the values above in this README rather than a `backend/.env.example` file, so create `backend/.env` manually or save that block as the file.

## Configure the frontend

The frontend has a tracked example file. Copy it to the local environment file:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
```

For ordinary local development, keep these values:

```env
BACKEND_URL=http://127.0.0.1:5000
```

Leave `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` unset locally. Next.js proxies `/api` and `/socket.io` to the backend, which lets authentication cookies work on the same local origin.

## Create the database schema

From `backend/`, after setting `DATABASE_URL`:

```bash
npm exec prisma migrate deploy
npm exec prisma generate
```

`migrate deploy` applies the checked-in Prisma migrations without resetting your database. For local schema changes during development, use `npm exec prisma migrate dev -- --name your_change` instead. Never run a Prisma reset command against a database that contains data you need.

## Add demo video files (optional, required for playback)

`frontend/public/videos/` is deliberately ignored by Git because video files are large. Consequently, a fresh clone does not include the demo MP4s.

To enable the included movie catalog and playback demo, add legally usable MP4 files to `frontend/public/videos/` using these names:

```text
guardians.mp4
guardians1.mp4 through guardians22.mp4
```

Then run the catalog attachment script from `backend/`:

```bash
npm run attach:demo-videos
```

The script verifies that all 23 files exist and creates or updates the related movie and genre records. Alternatively, create movies through the admin API with video URLs that your deployment can serve.

## Run locally

Open two terminals from the repository root.

Terminal 1 - API and Socket.IO server:

```bash
cd backend
npm run dev
```

Terminal 2 - Next.js application:

```bash
cd frontend
npm run dev
```

Visit <http://localhost:3000>. The backend listens on <http://localhost:5000>; its API is available through the frontend at `/api` during local development.

## Available commands

Run these from the directory shown.

| Directory | Command | Purpose |
| --- | --- | --- |
| `frontend` | `npm run dev` | Start the Next.js development server. |
| `frontend` | `npm run build` | Create a production frontend build. |
| `frontend` | `npm run start` | Serve the production frontend build. |
| `frontend` | `npm run lint` | Run ESLint. |
| `backend` | `npm run dev` | Start the API and Socket.IO server with file watching. |
| `backend` | `npm run start` | Start the API and Socket.IO server. |
| `backend` | `npm run attach:demo-videos` | Attach the local demo videos to catalog records. |
| `backend` | `npm run test:views` | Run the movie-view smoke test against the configured local database. |
| `backend` | `npm run test:room-status` | Run the Socket.IO room-status smoke test against the configured local database. |
| `backend` | `npm run test:invitations` | Run the invitation flow smoke test. Start both local servers first. |

The smoke tests create and remove temporary database records. `test:views` and `test:room-status` reject non-local database hosts as a safeguard; use a disposable local database for all tests.

## Production notes

- Set `BACKEND_URL` in the frontend environment to the backend origin used by Next.js rewrites.
- Set `CORS_ORIGIN` to a comma-separated list of the exact frontend origins allowed to send credentialed requests.
- Use HTTPS in production. Cookie security is enabled automatically when `NODE_ENV=production`.
- Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` only when your public topology needs direct browser-to-backend requests. They should share a cookie-compatible domain.
- Run `npm exec prisma migrate deploy` and `npm exec prisma generate` in `backend/` as part of the backend deployment.
- Store video assets outside Git (object storage or another media host) and update movie `videoUrl` values accordingly.

## Security

Keep `backend/.env`, `frontend/.env.local`, real SMTP passwords, JWT secrets, database URLs, and private media out of Git. Commit only example configuration containing placeholders.
