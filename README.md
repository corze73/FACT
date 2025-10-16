# ⚽ FACT – Find A Coach Today

[![Made with React](https://img.shields.io/badge/React-18-blue?logo=react)](https://reactjs.org/)
[![Neon](https://img.shields.io/badge/Powered_by-Neon-green?logo=postgresql)](https://neon.tech/)
[![Deployed on Bolt](https://img.shields.io/badge/Hosting-Bolt-orange)](https://bolt.new)

**Find A Coach Today (FACT)** is a Progressive Web App that connects users with coaches across football, fitness, and life coaching.  
Built with **React + Vite**, **Neon PostgreSQL**, and hosted on **Netlify** with a custom domain: [findacoachtoday.com](https://findacoachtoday.com).

---

## ✨ Features

- 🔑 **Authentication & Roles** – User, Coach, and Admin roles with custom authentication  
- 👤 **Profiles** – Coaches can add bios, skills, images, location, and rates  
- 📅 **Bookings** – Calendar-based booking flow with availability management  
- 💬 **Messaging** – Direct communication between users and coaches  
- 📊 **Admin Dashboard** – Manage coaches, users, reports, and settings  
- 🌍 **Custom Domain** – Live at [findacoachtoday.com](https://findacoachtoday.com)

---

## 🛠 Tech Stack

- **Frontend:** React 18 + Vite  
- **Backend/DB:** Neon PostgreSQL  
- **Hosting:** Bolt Hosting  
- **Styling:** TailwindCSS  
- **Future:** Stripe integration for payments  

---

## ⚙️ Setup & Development

# ⚽ FACT – Find A Coach Today

[![Made with React](https://img.shields.io/badge/React-18-blue?logo=react)](https://reactjs.org/)
[![Neon](https://img.shields.io/badge/Powered_by-Neon-green?logo=postgresql)](https://neon.tech/)
[![Netlify](https://img.shields.io/badge/Hosting-Netlify-brightgreen?logo=netlify)](https://www.netlify.com/)

Find A Coach Today (FACT) connects players with verified coaches. Built with React + Vite, Neon PostgreSQL, and serverless APIs (Netlify Functions). Production runs behind strict security headers and CSP.

- Live: https://findacoachtoday.com
- Repo: https://github.com/corze73/FACT

---

## ✨ Core features

- Google login and roles: user, coach, admin
- Coach profiles: bio, skills, location, rates, external video URLs (YouTube/Vimeo/hosted)
- Bookings with availability and rescheduling
- Messaging between clients and coaches
- Admin dashboard: manage users and bookings
- Account governance: admin soft-deactivate/restore with reason; user deletion requests with admin approval
- Security headers and CSP for prod/dev, allowlisting Google/Stripe/YouTube/Vimeo
- Stripe-ready payment architecture (Elements on client, APIs on server)

---

## 🧱 Architecture

- Frontend: React 18 + Vite (`src/`)
- Serverless API: Netlify Functions (`netlify/functions/`)
- Local Node server (dev helpers): `server.js` (Stripe webhooks + email)
- Database: Neon PostgreSQL with SQL migrations (`migrations/`)
- Security headers:
	- Production: `public/_headers`
	- Development: `vite-plugin-security-headers.js`

Key Netlify Functions: `users.js`, `bookings.js`, `messages.js` (see `netlify/functions/`).

---

## ✅ Prerequisites

- Node.js 18+
- Neon PostgreSQL database (connection string)
- Netlify account (deploy + functions)
- Google OAuth Client ID (Web app)
- Stripe account (optional until payments enabled)

---

## 🔐 Environment variables

See `.env.example` for the full list and guidance.

Server-only (never in the browser):
- `DATABASE_URL` (Neon connection string)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`

Client-safe (`VITE_` prefix):
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_APP_URL`, `VITE_API_URL`

Notes: The app uses server APIs in production; any `VITE_DATABASE_URL` is dev-only and should not be set in production builds.

---

## ⚙️ Setup

Clone & install:

```bash
git clone https://github.com/corze73/FACT.git
cd FACT
npm install
```

Create your env file and set values:

```bash
cp .env.example .env
# Set DATABASE_URL, VITE_GOOGLE_CLIENT_ID, VITE_APP_URL, VITE_API_URL, etc.
```

Apply database migrations in Neon (see `migrations/`), and any feature-specific SQL files in the repo (e.g., `enable-rls.sql`).

---

## 🧪 Run locally

Netlify Dev (emulates functions + serves app):

```bash
npm run dev
```

Full dev (Netlify Dev + local Node server for Stripe/email):

```bash
npm run dev:full
```

Other:

```bash
npm run build     # build the frontend
npm run preview   # preview Netlify prod locally
npm run server    # start local Node server for Stripe/email
```

Local endpoints:
- App: http://localhost:8888 (Netlify Dev) or http://localhost:5173 (`dev:vite`)
- Health: http://localhost:3001/health
- Stripe webhook: http://localhost:3001/stripe/webhook

---

## 🚀 Deploy (Netlify)

1) Connect the repo in Netlify

2) Set environment variables (Build & deploy → Environment)
	 - Required: `DATABASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_APP_URL`
	 - Optional: Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`)
	 - Optional: Email (`SMTP_*`)

3) Build settings
	 - Build command: `npm run build`
	 - Publish directory: `dist`

4) Security headers: `public/_headers` is deployed verbatim (CSP, XFO, XCTO, etc.)

---

## 🔒 Security

- Strict CSP and headers in prod (`public/_headers`) and dev (`vite-plugin-security-headers.js`)
- Frame/script/connect-src allowlists for Google, Stripe, YouTube/Vimeo
- Video clips are external URLs only; backend rejects data URIs and non-http(s)
- Admin soft-deactivation + user deletion request workflow
- Server-only secrets (`DATABASE_URL`, `STRIPE_SECRET_KEY`) — keep out of client

---

## 📂 Structure

```
netlify/functions/        # serverless API (users, bookings, messages)
migrations/               # SQL migrations
public/_headers           # production security headers (CSP)
src/
	api/                    # apiClient, entities, stripe/email routes
	components/, pages/     # UI
	vite-plugin-security-headers.js
server.js                 # local dev server for Stripe/email
netlify.toml              # Netlify config
```

---

## 🧯 Troubleshooting

- CSP/headers blocking: check `public/_headers` or dev plugin
- Google login errors: verify `VITE_GOOGLE_CLIENT_ID` and OAuth origins
- DB errors: confirm `DATABASE_URL` and Neon project status (not paused)
- Stripe: ensure keys/secrets are set; use `npm run server` for webhooks

---

## 🤝 Contributing

PRs welcome. Don’t commit secrets — `.env` is gitignored.

---

## 📜 License

ISC (see `package.json`).
