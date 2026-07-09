# PhotoProof — Step-by-Step Deployment Guide
## Zero to Live in ~1 Hour

---

## Prerequisites
- GitHub account (free)
- Supabase account (free) — supabase.com
- Upstash account (free) — upstash.com
- Render account (free) — render.com
- Vercel account (free) — vercel.com
- Resend account (free) — resend.com

---

## Step 1: Push Code to GitHub

```bash
# In the project root (f:\muneeb)
git init
git add .
git commit -m "Initial PhotoProof deployment"
git remote add origin https://github.com/YOUR_USERNAME/photoproof.git
git push -u origin main
```

---

## Step 2: Set Up Supabase Database

1. Go to **supabase.com** → Create New Project
2. Choose a region close to Pakistan (Singapore or Mumbai)
3. Copy your project URL and API keys

### Run the Schema:
1. In Supabase dashboard → **SQL Editor**
2. Paste the contents of `backend/src/db/schema.sql`
3. Click **Run**
4. You should see "Success" with all tables created

### Get Database URL:
1. Supabase → Settings → Database
2. Copy **Connection String** → **URI** mode
3. Replace `[YOUR-PASSWORD]` with your project password

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

## Step 3: Set Up Upstash Redis (for job queue)

1. Go to **upstash.com** → Create Database → Redis
2. Choose region: Singapore (closest to Pakistan)
3. Copy the **Redis URL** (starts with `redis://...`)

---

## Step 4: Set Up Resend Email

1. Go to **resend.com** → Sign Up (free: 3,000 emails/month)
2. Go to API Keys → Create API Key
3. Copy the key (starts with `re_...`)

> **Optional:** Add your domain for professional email. If not, emails come from `onboarding@resend.dev`.

---

## Step 5: Deploy Backend to Render

1. Go to **render.com** → New → Web Service
2. Connect your GitHub repo → Select the `backend` folder

### Render Settings:
- **Name:** `photoproof-backend`
- **Region:** Singapore
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `node src/index.js`
- **Plan:** Starter ($7/mo) — recommended, or Free (has cold starts)

### Environment Variables (Add these in Render):
```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres
JWT_SECRET=[generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"]
REDIS_URL=redis://default:[PW]@[HOST].upstash.io:6379
RESEND_API_KEY=re_xxxx
FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=faseehasghar167@gmail.com
ADMIN_PASSWORD=[your secure admin password]
FRONTEND_URL=https://your-app.vercel.app
USE_BG_REMOVAL=false
```

4. Click **Deploy** — takes ~3 minutes
5. Your API will be at: `https://photoproof-backend.onrender.com`
6. Test: `https://photoproof-backend.onrender.com/health`

---

## Step 6: Deploy Frontend to Vercel

1. Go to **vercel.com** → New Project → Import from GitHub
2. Select the repo → Set **Root Directory** to `frontend`

### Environment Variables (in Vercel):
```
NEXT_PUBLIC_API_URL=https://photoproof-backend.onrender.com
NEXT_PUBLIC_APP_NAME=PhotoProof
```

3. Click **Deploy** — takes ~2 minutes
4. Your frontend will be at: `https://photoproof.vercel.app`

---

## Step 7: Update CORS

After deployment, update the backend `FRONTEND_URL` env var in Render to match your Vercel URL:
```
FRONTEND_URL=https://photoproof.vercel.app
```

Then redeploy the backend (Render → Manual Deploy).

---

## Step 8: Test Everything

### Test Checklist:
- [ ] Visit your Vercel URL — landing page loads
- [ ] Go to `/register` — registration form works
- [ ] Register a test account
- [ ] Go to Supabase → Table Editor → `users` — confirm user is there
- [ ] Login as admin: `faseehasghar167@gmail.com` with your admin password
- [ ] Go to `/admin/users` — see the pending user
- [ ] Click Approve — user gets activated
- [ ] Login as the test user
- [ ] Upload a few photos
- [ ] Check job status updates
- [ ] Download the ZIP

---

## Step 9: Optional — Custom Domain

1. Buy a `.pk` domain from PKNIC (~PKR 1,500/year) or `.com` from Namecheap (~$12/year)
2. In Vercel → Settings → Domains → Add your domain
3. Add the DNS records Vercel gives you to your domain registrar
4. Done! SSL is automatic.

---

## Step 10: FAPIhub Background Removal (Optional)

For AI background removal (much better quality):

1. Go to **fapihub.com** → Sign Up → API Keys
2. Add to Render environment variables:
```
FAPIHUB_API_KEY=your_key_here
USE_BG_REMOVAL=true
```
3. Costs ~$0.001 per image (100 images free per month)

---

## Monitoring & Maintenance

### Check logs:
- Render → Your Service → Logs

### Database:
- Supabase → Table Editor → View all tables

### Scale up (when needed):
- Render: Upgrade to $25/month plan for 2 worker instances
- Supabase: Free tier handles up to ~50K users easily

---

## Admin Account

After first deployment:
- **Email:** faseehasghar167@gmail.com  
- **Password:** Whatever you set in `ADMIN_PASSWORD` env var
- **URL:** https://your-app.vercel.app/admin

**IMPORTANT:** Change your admin password after first login!

---

## Support

For any issues, check:
1. Render logs for backend errors
2. Vercel deployment logs for frontend errors
3. Supabase logs for database errors
4. Browser console for frontend JavaScript errors
