# SkillScan deployment guide

SkillScan uses one Vercel project for the static frontend and Express API, with Supabase as its hosted database.

## 1. Create the Supabase tables

Open the Supabase SQL Editor and run `backend/supabase-schema.sql` once.

## 2. Configure Vercel environment variables

Add these variables in **Vercel → Project Settings → Environment Variables**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `EMAIL_USER`
- `EMAIL_PASS`
- `GROQ_API_KEY`
- `GROQ_MODEL` (optional)

Use `backend/.env.example` as the variable-name reference. Never commit `backend/.env` or real keys.

## 3. Deploy

Import the GitHub repository into Vercel and keep **Root Directory** as `.`. Vercel reads `vercel.json`, serves the HTML frontend, and sends `/api/*` requests to `api/index.js`.

## 4. Verify

Open `https://YOUR-DOMAIN/api/health`. A successful deployment returns:

```json
{"status":"ok","database":"supabase"}
```

Then test signup, OTP verification, login, resume analysis, and the dashboard history.
