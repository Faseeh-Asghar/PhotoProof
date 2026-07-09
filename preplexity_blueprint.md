Lets users log in (email + password)

Lets you control sign-ups via OTP/payment

Allows bulk photo upload

Automatically:

Removes background

Sets white background

Resizes to 600×800

Keeps file size ~10–20 KB (or as close as possible)

Can handle thousands of users and be sold as a service

I’ll break it into:

Architecture overview

Tech stack (free / very cheap options)

Core features & user flows

Database schema

Backend API design

Frontend design

Image processing pipeline

Authentication, OTP, and payment flow

Deployment & scaling plan

Cost estimate & how to monetize

Step‑by‑step build plan

1. Architecture Overview
   High-level design:

Frontend: React/Next.js (or simple HTML+JS for minimal version)

Backend: Node.js (Express/Fastify) or Python (FastAPI)

Database: PostgreSQL (free tier) or SQLite/PostgreSQL on Supabase/Neon

Auth: Custom email+password + OTP managed by you

Storage: Object storage (Cloudflare R2 / Backblaze B2 / Supabase Storage)

Image processing:

Background removal API (cheap: FAPIhub, Poof, JUHEAPI, etc.)

Resize & compress with server-side code (sharp in Node, Pillow in Python)

Hosting:

Frontend: Vercel / Netlify (free)

Backend: Render / Railway / Fly.io / Oracle Cloud free tier

DB: Supabase / Neon / Railway free Postgres

This stack is fully buildable on free/very-low-cost tiers and can scale to thousands of users.

2. Recommended Tech Stack (Low Budget)
   Frontend

Framework: Next.js (React) or plain HTML + JS + Tailwind CSS

Hosting: Vercel or Netlify (free for small–medium traffic)

Backend

Language: Node.js (Express/Fastify) or Python (FastAPI)

Hosting:

Render (free web service with some limits)

Railway (free credits, easy deploy)

Oracle Cloud free tier (always-free VM, more setup but powerful)

Database

Supabase (PostgreSQL + auth primitives, free tier)

or Neon (serverless Postgres, free tier)

or Railway Postgres (free tier)

File Storage

Cloudflare R2 (very cheap S3-compatible storage)

or Supabase Storage (free tier included)

or Backblaze B2 (very cheap)

Image Processing

Background removal:

FAPIhub ($0.001/image, 100 free/month) – very cheap and scalable

Alternatives: Poof, JUHEAPI, remove.bg (more expensive)

Resize/compress:

Node: sharp

Python: Pillow + pillow-heif if needed

Auth & OTP

Custom implementation:

Store users in DB with email, password_hash, is_paid, otp_code, otp_expires_at

You send OTP manually (email/SMS/WhatsApp) or via low-cost service (e.g., Resend, SendGrid free tier, Twilio trial)

3. Core Features & User Flows
   A. Public /未登录 users
   See landing page: features, pricing, contact.

No access to upload/processing.

B. Sign-up flow (controlled by you)
User clicks “Sign Up”.

Enters:

Name

Email

School name (optional)

Password

System:

Creates a pending user record with status = 'pending_payment'.

Does not activate account yet.

Shows message: “Please contact admin to complete registration and payment.”

You:

Receive their request (via a dashboard or email).

Confirm payment (manual bank transfer, JazzCash, EasyPaisa, Stripe, etc.).

Generate an OTP (e.g., 6-digit).

Send OTP to user (email/SMS/WhatsApp).

User:

Enters OTP on site.

If OTP matches and not expired:

Mark user as status = 'active', is_paid = true.

Allow login.

This gives you full control over who can use the system and when they pay.

C. Login flow
Email + password.

Backend checks:

Credentials valid?

status = 'active'?

If yes: issue a session token (JWT or cookie-based session).

Redirect to dashboard.

D. Upload & process photos
User logs in.

Dashboard:

“Upload student photos” button.

Drag-and-drop area; supports multiple files (e.g., up to 50–100 at once).

Frontend:

Sends files to backend /api/upload endpoint.

Shows progress bar per file.

Backend:

Validates:

File type (jpg/png)

Size (e.g., max 5–10 MB raw)

Uploads original to storage (e.g., originals/{userId}/{filename}).

Queues processing job (can be immediate or via a simple queue like Redis/Bull or just async functions for starters).

Processing pipeline (per image):

Call background removal API → get transparent PNG.

Composite onto white background.

Resize to exactly 600×800 (or fit within, then pad).

Compress to target size (e.g., aim for 10–20 KB):

Adjust JPEG quality / PNG compression.

If still too large, reduce quality iteratively.

Save processed image to storage (e.g., processed/{userId}/{filename}).

Store metadata in DB:

user_id, original_url, processed_url, width, height, file_size, status.

Frontend:

Polls or uses WebSocket/SSE to get status.

Shows:

“Processing…”

“Done” with preview and download button.

Allows bulk download (ZIP) of processed images.

E. Admin features (for you)
Admin login (separate role).

Dashboard:

List of all users.

Pending sign-ups (awaiting payment/OTP).

Ability to:

Mark user as paid.

Generate & send OTP.

Deactivate/reactivate users.

Usage stats:

Images processed per user.

Total storage used.

Revenue (if you track payments).

4. Database Schema (Simplified)
   Use PostgreSQL. Main tables:

users
sql
CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL,
email TEXT UNIQUE NOT NULL,
password_hash TEXT NOT NULL,
school_name TEXT,
status TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment, active, suspended
is_paid BOOLEAN DEFAULT FALSE,
role TEXT NOT NULL DEFAULT 'user', -- 'user' or 'admin'
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
otp_codes
sql
CREATE TABLE otp_codes (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
code TEXT NOT NULL,
expires_at TIMESTAMPTZ NOT NULL,
used BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
images
sql
CREATE TABLE images (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
original_url TEXT NOT NULL,
processed_url TEXT,
status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
width INT,
height INT,
file_size INT, -- in bytes
error_message TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
payments (optional, if you want to track)
sql
CREATE TABLE payments (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
amount NUMERIC NOT NULL,
currency TEXT NOT NULL DEFAULT 'PKR',
method TEXT NOT NULL, -- bank_transfer, jazcash, easypaisa, stripe, etc.
status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
notes TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
); 5. Backend API Design (Example with Node/Express)
Key endpoints:

Auth
POST /api/auth/register

Body: { name, email, password, school_name? }

Creates user with status = 'pending_payment'.

Returns: { message: 'Registration successful. Please complete payment to activate.' }

POST /api/auth/verify-otp

Body: { email, otp }

Checks OTP, activates user if valid.

POST /api/auth/login

Body: { email, password }

Returns JWT or sets session cookie.

GET /api/auth/me

Returns current user info (if logged in).

Upload & Processing
POST /api/images/upload (multipart/form-data)

Accepts multiple files.

For each file, creates an images row with status = 'pending'.

Uploads original to storage.

Triggers processing (async).

Returns list of image IDs.

GET /api/images

Returns list of images for current user (with status, URLs, etc.).

GET /api/images/:id

Returns details for a specific image.

POST /api/images/:id/reprocess (optional)

Reprocess if failed.

Admin
GET /api/admin/users

List users, filter by status.

POST /api/admin/users/:id/activate

Mark as paid, generate OTP, store in otp_codes.

POST /api/admin/users/:id/send-otp

Manually trigger OTP email/SMS.

You’ll implement these with proper validation, error handling, and authentication middleware.

6. Frontend Design
   Pages
   Landing page

Hero: “School Student Photo Processor – White Background, 600×800, Bulk Upload”

Features list:

Bulk upload

Automatic white background

Standard size

Secure, paid access

“Contact Admin” / “Request Access” button.

Sign Up

Form: name, email, password, school name.

After submit: show instruction to pay & contact you.

OTP Verification

After you tell them OTP is sent:

Input: email + OTP.

On success: redirect to login.

Login

Email + password.

Dashboard (logged-in users)

Summary: number of images processed, remaining quota (if you set limits).

“Upload Photos” button.

List/grid of images with:

Thumbnail (processed)

Status (Processing/Done/Failed)

Download button

“Download All as ZIP” button.

Admin Dashboard

Users list:

Name, email, school, status, images processed.

Actions: Activate, Send OTP, Suspend.

Payments log (if implemented).

Use a simple, clean UI framework:

Tailwind CSS + Headless UI or Chakra UI / Mantine for components.

Responsive design for mobile and desktop.

7. Image Processing Pipeline (Detailed)
   Assume Node.js + sharp + FAPIhub API.

Step 1: Background Removal
Call FAPIhub (or your chosen API):

Endpoint (example): https://api.fapihub.com/v1/remove-background

Headers: Authorization: Bearer YOUR_API_KEY

Body: multipart image or base64.

Response: transparent PNG.

FAPIhub is extremely cheap (~$0.001/image) and has a free tier (100/month), making it ideal for scaling at low cost.

Step 2: Composite on White Background
Using sharp:

js
import sharp from 'sharp';

async function processImage(inputBuffer) {
// 1. Remove background via API → get pngBuffer (transparent)
const pngBuffer = await removeBackgroundViaAPI(inputBuffer);

// 2. Create white background 600x800
const width = 600;
const height = 800;

const whiteBackground = await sharp({
create: {
width,
height,
channels: 3,
background: { r: 255, g: 255, b: 255 },
},
})
.png()
.toBuffer();

// 3. Resize subject to fit within 600x800 while preserving aspect ratio
const subject = await sharp(pngBuffer)
.resize(width, height, {
fit: 'contain',
background: { r: 0, g: 0, b: 0, alpha: 0 },
})
.toBuffer();

// 4. Composite subject over white background
const result = await sharp(whiteBackground)
.composite([{ input: subject, top: 0, left: 0 }])
.jpeg({ quality: 85 }) // start with 85
.toBuffer();

// 5. Adjust quality to target size 10–20 KB
let quality = 85;
let output = result;
while (output.length > 20 \* 1024 && quality > 20) {
quality -= 5;
output = await sharp(whiteBackground)
.composite([{ input: subject, top: 0, left: 0 }])
.jpeg({ quality })
.toBuffer();
}

return { buffer: output, width, height, size: output.length };
}
For Python, similar logic with Pillow.

Concurrency & Performance
Process images in parallel but limit concurrency (e.g., 5–10 at a time) to avoid overloading the server/API.

For thousands of users, you can:

Use a job queue (Bull + Redis) to process images in background workers.

Scale workers horizontally (multiple instances).

8. Authentication, OTP, and Payment Flow
   OTP Generation
   Use 6-digit numeric code.

Store in DB with expires_at (e.g., 10–15 minutes).

Mark used = true after successful verification.

Sending OTP
Options:

Manual: You copy OTP from admin panel and send via:

Email (Gmail/Outlook)

WhatsApp

SMS

Automated (low cost):

Email: Resend, SendGrid, Mailgun (free tiers).

SMS: Twilio trial, or local Pakistani SMS gateways.

For lowest cost and simplicity at start, manual is fine.

Payment Integration
You don’t need a complex automated system initially:

Show bank details / mobile wallet numbers on site.

User sends payment, then:

Fills a form with transaction ID.

Or you match by email/time.

You verify and then:

Mark user as paid.

Generate and send OTP.

Later, you can add automated payments:

Stripe (if available in your region)

Local gateways (JazzCash/EasyPaisa merchant APIs)

Show a “Pay Now” button, then auto-activate after webhook confirmation.

9. Deployment & Scaling Plan
   Phase 1: MVP (Single Server, Free/Low-Cost)
   Frontend: Vercel (Next.js) – free.

Backend: Render/Railway free tier – Node/Express or FastAPI.

DB: Supabase/Neon free Postgres.

Storage: Supabase Storage or Cloudflare R2 (very cheap).

Background removal: FAPIhub free tier (100/month) then paid as you grow.

This can comfortably handle:

Hundreds of users.

Thousands of images per month, depending on concurrency and API limits.

Phase 2: Scaling to Thousands of Users
When traffic grows:

Backend:

Move to a paid plan on Render/Railway or a small VPS (e.g., $5–10/month).

Run multiple instances behind a load balancer (or use a platform that auto-scales).

Database:

Upgrade Postgres plan (still cheap).

Add indexes on user_id, status, created_at.

Image processing:

Use a dedicated worker service:

Separate process/container that pulls jobs from a queue (Redis/Bull).

Scale workers independently.

Consider caching results if same image is re-uploaded (hash-based).

Storage:

Use Cloudflare R2 + CDN for faster downloads.

Set lifecycle rules to delete old originals if needed.

Monitoring:

Basic logging (console + log provider).

Error tracking (e.g., Sentry free tier).

This architecture can scale to tens of thousands of users with modest cost.

10. Cost Estimate & Monetization
    Rough Monthly Costs (Early Stage)
    Hosting (backend + frontend): $0–10

Database: $0–10

Storage: $0–5 (depends on usage)

Background removal:

FAPIhub: $0.001/image

Example: 10,000 images/month → ~$10

Email/SMS OTP: $0–5 (if using automated email; SMS more)

Total early-stage: $10–30/month, potentially less if you keep everything on free tiers initially.

Pricing Model (for Schools)
Examples:

Per student per year: e.g., PKR 50–100/student.

Or per image: e.g., PKR 5–10/image (you pay ~$0.001 ≈ PKR 0.3, huge margin).

Or flat monthly fee per school: PKR 2,000–10,000/month depending on size.

You can offer:

Free trial (e.g., 50 images).

Then paid access via OTP.

11. Step‑by‑Step Build Plan
    Week 1: Core Setup
    Set up repo (GitHub).

Initialize:

Next.js frontend.

Node/Express or FastAPI backend.

Set up:

Postgres DB (Supabase/Neon).

Basic tables (users, otp_codes, images).

Implement:

User registration (pending status).

Login (JWT or sessions).

Basic auth middleware.

Week 2: Admin & OTP
Build admin login (hardcode first admin or seed in DB).

Admin dashboard:

List users.

Mark as paid.

Generate OTP.

Implement OTP verification endpoint.

Simple email/manual OTP flow.

Week 3: Upload & Processing
Implement file upload endpoint.

Integrate FAPIhub background removal API.

Implement image processing:

White background

Resize to 600×800

Compression to target size

Store processed images and metadata.

Frontend:

Upload UI with progress.

Image list with status and download.

Week 4: Polish & Deploy
Improve UI/UX:

Landing page.

Clear instructions for payment & OTP.

Add:

Bulk download (ZIP).

Basic error handling & messages.

Deploy:

Frontend to Vercel.

Backend to Render/Railway.

DB to Supabase/Neon.

Test with a small school:

Fix bugs.

Optimize speed.
