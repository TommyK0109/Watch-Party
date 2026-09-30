# WatchParty

WatchParty is a full-stack movie browsing and synchronized watch-party application. Users can register and verify their email address, browse a movie library, create or join a room, invite other verified users, chat, and keep video playback synchronized in real time.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Express 5, Socket.IO, TypeScript
- **Data:** PostgreSQL and Prisma
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
This repository currently provides the values above in this README rather than a `backend/.env.example` file, so create `backend/.env` manually or save that block as the file.

## Configure the frontend

The frontend has a tracked example file. Copy it to the local environment file:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
```
## Create the database schema
```bash
npm exec prisma migrate deploy
npm exec prisma generate
```

`migrate deploy` applies the checked-in Prisma migrations without resetting your database. For local schema changes during development, use `npm exec prisma migrate dev -- --name your_change` instead. Never run a Prisma reset command against a database that contains data you need.

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
