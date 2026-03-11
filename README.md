# Code Sprint Setup

This project has:
1. Frontend: Next.js app in the repository root.
2. Backend: Express + MongoDB API in [backend](backend).

## Environment Variables

After checking all frontend and backend files, these are the environment variables used by the code.

### Backend .env file

Create this file:
1. [backend/.env](backend/.env)

Required variables:
1. MONGODB_URI
2. JWT_SECRET
3. ADMIN_ID
4. ADMIN_PASSWORD

Optional variables:
1. PORT (default is 5000)
2. JUDGE0_URL (default is http://localhost:2358)

Example backend .env:

MONGODB_URI=mongodb://127.0.0.1:27017/code-sprint
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_ID=admin
ADMIN_PASSWORD=replace_with_secure_password
PORT=5000
JUDGE0_URL=http://localhost:2358

### Frontend .env file

Current frontend code does not read any environment variables.

You do not need a frontend .env file right now.

If you later move API base URLs or other settings to env, create:
1. .env.local in the repository root

## Where Each Key Is Used

Backend usage references:
1. MONGODB_URI: [backend/server.js](backend/server.js#L23), [backend/seed.js](backend/seed.js#L66)
2. PORT: [backend/server.js](backend/server.js#L44)
3. JUDGE0_URL: [backend/controllers/submissionController.js](backend/controllers/submissionController.js#L6)
4. JWT_SECRET: [backend/controllers/authController.js](backend/controllers/authController.js#L24), [backend/controllers/authController.js](backend/controllers/authController.js#L61), [backend/controllers/authController.js](backend/controllers/authController.js#L87)
5. ADMIN_ID and ADMIN_PASSWORD: [backend/controllers/authController.js](backend/controllers/authController.js#L60)

## Run Project

Backend:
1. Open terminal in [backend](backend)
2. Run: npm install
3. Run: npm run dev

Frontend:
1. Open terminal in repository root
2. Run: npm install
3. Run: npm run dev

Frontend runs on http://localhost:3000 and backend runs on http://localhost:5000 by default.
