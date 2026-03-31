# Code Sprint

Online coding assessment platform with:
- Next.js frontend (root workspace)
- Express + MongoDB backend ([backend](backend))

## Features

- Participant login and assessment flow
- Admin control panel for assessment operations
- Question management and submissions
- Environment-based branding for title, provider, and logo

## Tech Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: Express, Mongoose, JWT
- Database: MongoDB

## Project Structure

- Frontend app: [app](app)
- UI components: [components](components)
- Backend API: [backend](backend)
- API client: [lib/api.js](lib/api.js)

## Environment Setup

This repository now includes safe env templates:

- Frontend template: [.env.local.example](.env.local.example)
- Backend template: [backend/.env.example](backend/.env.example)

### 1. Frontend env

Create [.env.local](.env.local) in the repository root using the template.

Variables:
- NEXT_PUBLIC_APP_TITLE (optional, default: Code Sprint 2026)
- NEXT_PUBLIC_PROVIDER_NAME (optional, default: Dhanekula Institute of Engineering & Technology)
- NEXT_PUBLIC_LOGO_URL (optional, default: /diet-logo.png)
- NEXT_PUBLIC_LOGO_ALT (optional, default: Platform logo)
- NEXT_PUBLIC_API_BASE_URL (optional, default: http://localhost:5000/api)

### 2. Backend env

Create [backend/.env](backend/.env) using the template.

Required:
- MONGODB_URI
- JWT_SECRET
- ADMIN_ID
- ADMIN_PASSWORD

Optional:
- PORT (default: 5000)
- JUDGE0_URL (default: http://localhost:2358)
- FRONTEND_URL (default: http://localhost:3000)

## Local Development

### Run backend

1. Open terminal in [backend](backend)
2. Install dependencies:

```bash
npm install
```

3. Start backend in dev mode:

```bash
npm run dev
```

Backend default URL: http://localhost:5000

### Run frontend

1. Open terminal in repository root
2. Install dependencies:

```bash
npm install
```

3. Start frontend in dev mode:

```bash
npm run dev
```

Frontend default URL: http://localhost:3000

## Production Notes

- Set all env variables in your hosting platforms (frontend and backend separately).
- Only use NEXT_PUBLIC_ prefix for non-sensitive frontend values.
- Never commit real secrets (JWT secret, DB URI, admin password) to git.

## Sample Deployment

link : https://code.yashdev.tech

## sample credentials

id : admin@0911
password : CodeSprint@0911

## Branding Configuration

You can rebrand for any college/provider without code changes by setting:

- NEXT_PUBLIC_APP_TITLE
- NEXT_PUBLIC_PROVIDER_NAME
- NEXT_PUBLIC_LOGO_URL
- NEXT_PUBLIC_LOGO_ALT

These values are used in the login page and participant header.
