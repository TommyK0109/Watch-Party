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
