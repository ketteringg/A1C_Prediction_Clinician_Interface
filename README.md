# Diabetes Glycemic Control Dashboard

Interactive Next.js dashboard for visualizing patient-level diabetes risk predictions from a CatBoost v8.1 model. Server-side authentication via Vercel environment variables.

## Data policy

**No real patient data is committed to this repo.** `app/dashboard/data.js` contains 1,000 fully fabricated patients with clinically plausible distributions, scored through the actual trained CatBoost model. No real patient rows or IDs appear in the output.

## Local development

```bash
npm install
cp .env.example .env.local   # edit with your chosen credentials
npm run dev
```

Open http://localhost:3000. You'll be redirected to `/login`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel (auto-detects Next.js).
3. Under **Project Settings → Environment Variables**, add:
   - `AUTH_USER` = your chosen username
   - `AUTH_PASS` = your chosen password
   
   Note the variable names have **no `VITE_` prefix** — these are server-side vars and are never sent to the browser.
4. Deploy.

## How auth works

- `middleware.js` runs on every request. If the visitor doesn't have a valid `dm_session` cookie, they're redirected to `/login`.
- `/login` posts credentials to `/api/login`, which compares them to `process.env.AUTH_USER` and `process.env.AUTH_PASS` server-side.
- On match, an HTTP-only cookie is set (8-hour expiry). The browser never sees the password.
- Logout button on the dashboard clears the cookie via `/api/logout`.

This is real authentication — credentials live only on the server. The JS bundle delivered to browsers contains no password material.

## Project layout

```
.
├── package.json
├── middleware.js              # auth gate on every request
├── .env.example
├── .gitignore
├── README.md
└── app/
    ├── layout.jsx
    ├── page.jsx               # → redirects to /dashboard
    ├── login/page.jsx         # login UI
    ├── api/
    │   ├── login/route.js     # validates credentials, sets cookie
    │   └── logout/route.js    # clears cookie
    └── dashboard/
        ├── page.jsx           # dashboard wrapper with logout button
        ├── App.jsx            # main React dashboard (client component)
        └── data.js            # 1,000 synthetic patients
```

## Model pipeline summary

- **Model:** CatBoost, 500 iterations, depth 5, lr 0.03
- **Features:** 25 engineered (A1c trajectory stats, med orders, demographics, ADI)
- **Decision threshold:** 0.1725
- **AUC:** 0.889 (training)

## Follow-up flag logic

Patients with no recorded 2025 A1c collection date get:
- `Schedule Follow-Up` — standard
- `Urgent: Schedule Follow-Up` — when predicted probability ≥ 0.4 (high-risk tier)
