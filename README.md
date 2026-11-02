# ITSA — PCCOER website

A responsive public website and password-protected admin CMS for the Information Technology Student Association at PCCOER.

## What is included

- Public homepage with the reference-style full-screen animated 3D particle-head scene with individual cursor-reactive particles, filterable event cards with looping video previews, compact Info/Aims/Exploring/Connect panels, mobile navigation, about section, statistics, event directory, gallery lightbox, team directory, sponsor area, and contact links.
- Admin dashboard at `/admin` with login and a one-time first-admin setup flow.
- Event management: create, edit, delete, set upcoming/past/draft status, choose one featured event, add date/location/registration link, upload a cover image, and set an optional MP4/WebM hero preview video URL.
- Gallery management: upload, edit captions/categories, hide/show, and delete photos.
- Team management: add/edit/remove members, roles, departments, profiles, social links, display order, and profile photos.
- Sponsor management: Title/Gold/Silver tiers, logo uploads, website links, and visibility.
- Homepage settings: hero info and mission text, about copy, focus areas, email/social links, and statistics.
- Password change, password hashing, rate-limited login, HTTP-only session cookie, origin check, and 8 MB image upload limit.

## Cosmic visual system

- The top hero is a live Three.js spiral-galaxy point cloud, not a static image. Two fine particle arms curl around a small centre, rotate slowly, and respond to the cursor with a soft push and spring return. A separate lightweight starfield drifts and twinkles behind every section, including the admin console. The palette is near-black with electric cyan and blue accents drawn from the uploaded ITSA logo. System reduced-motion settings stop the ambient movement. Particle count and interaction radius scale down on mobile.
- The event cards at the left are rendered from the same event records used by the events archive. Category chips filter those cards instantly. Hovering a card highlights it; selecting one takes the visitor to the event listing.
- In Admin → Events, set **Hero preview video URL** to a direct HTTPS MP4/WebM URL. The clip is muted, looping, and inline. If no clip is supplied, the card uses its cover image; if neither exists, it shows the built-in animated-style placeholder.
- The right-side Info, Aims, Exploring, and Connect content is driven by Admin → Settings.

## Requirements

- Node.js 20 or newer
- npm

## Run locally (Mac / Windows / Linux)

**On Mac, the easiest option is to double-click `start-mac.command`.** It checks Node.js, installs dependencies if needed, creates `.env` with a random session secret, and starts the website. Keep the Terminal window open while using the site.

Manual setup (also works on Windows/Linux):

1. Extract this folder.
2. Open Terminal in the `itsa-website` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET` (at least 32 characters). You can generate one with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Start the website:

   ```bash
   npm start
   ```

6. Open the public website at `http://localhost:3000`.
7. Open the admin panel at `http://localhost:3000/admin`.
8. While no admin exists, the terminal prints the **ITSA FIRST-ADMIN SETUP KEY**. Paste it into the setup form, enter an admin email, and create a password of at least 12 characters. If the server restarts before setup is completed, it prints the same key again. The key file is deleted after the first admin is created.

For development with automatic server restart, use `npm run dev`.

## How content is stored

- `data/db.json` stores website content and the hashed admin password.
- `uploads/` stores images uploaded from the admin panel.
- Both folders are created automatically and are excluded from Git by `.gitignore`.
- Back up **both** `data/db.json` and `uploads/` regularly. Losing either can mean losing content or uploaded media.
- The current server uses a single-process JSON data store and Express's in-memory session store. This is suitable for a single VPS/EC2 instance or local use. Do not run multiple app instances against the same JSON file. For high traffic or multi-instance hosting, move content to PostgreSQL and sessions to a persistent session store (or use Supabase).

## Deployment notes (EC2 / VPS)

1. Install Node.js 20+, clone or upload this folder, then run `npm install`.
2. Create `.env` on the server. Set `NODE_ENV=production`, a strong `SESSION_SECRET`, and `PORT`.
3. Start with a process manager such as PM2 (`pm2 start server.js --name itsa-website`) or a systemd service.
4. Put Nginx/Caddy in front of Node and enable HTTPS. The admin session cookie is marked `Secure` in production, so HTTPS is required for normal admin sign-in.
5. Persist the `data/` and `uploads/` directories across redeployments. Back them up.
6. Complete first-admin setup using the setup key shown in your server logs. Do not share this key.

## Before publishing

The initial event entries are starter/demo content based on the supplied HTML. Confirm every title, description, date, status, and registration link in the admin panel before making the site public. The initial homepage stats and contact/social details also come from the supplied HTML and should be verified by the club. Gallery, team, and sponsor records start empty so you can upload the correct photos and names rather than publishing invented people or logos.

## Useful routes

- `/` — public website
- `/admin` — admin CMS
- `/api/health` — server health check
- `/api/public` — public website data (published content only)

## Notes

- Image formats supported: JPG/JPEG, PNG, WEBP, GIF, AVIF. Maximum file size: 8 MB. Event hero preview video URLs must use HTTPS and point to a browser-playable MP4/WebM resource; preview videos are linked rather than uploaded through the admin panel.
- Only one event can be marked as featured at a time.
- Draft events and unpublished items are not visible on the public site.
- The public website uses same-origin API requests. Keep the frontend and server on the same domain when deploying this starter.


## Cursor interaction tuning (free scatter)

The particle sphere is not meant to remain rigid under the cursor. The interaction
uses a 1.12-unit desktop / 0.98-unit mobile radius, strong screen-space repulsion,
a 3D depth kick, and a directional wake following cursor movement. Displaced points
are pulled back by the damped spring after the cursor moves away.


## Recent visual tuning — localized scatter + denser starfield

- Cursor influence radius is now 0.72 desktop / 0.62 mobile.
- Repulsion strength is retained, but only particles in the smaller local area are affected.
- Full-page white starfield now targets 650–1,800 desktop stars and 260–520 mobile stars.
- Background particles use varied sizes, soft twinkle, gentle vertical drift and subtle cursor parallax.


## Deep-space background update

The fixed starfield is now denser and covers the full viewport behind every section
while scrolling. Desktop target density is 2,200–4,600 stars; mobile target density
is 850–1,600. Three depth layers use different sizes, brightness, drift speeds,
subtle parallax, and twinkle. Occasional monochrome shooting stars and a very faint
moving white haze add depth without introducing blue or changing the page layout.
The same starfield is also present on the admin page.
# itsa
