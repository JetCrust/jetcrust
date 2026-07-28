# Jet Crust — going live

The app is production-ready (it builds clean). Going live means moving the database
off the local file, adding real keys, deploying to Vercel, and pointing the domain
with the SEO redirects already in place.

## Accounts you need
1. **Vercel** (hosting) — free to start.
2. **Supabase** (Postgres database) — free tier is fine.
3. **Resend** (email) — plus a domain verified for sending (e.g. mail.jetcrust.com).
4. **Stripe** — your live keys (you already have the account).
5. Access to **jetcrust.com DNS**.

## 1. Database (Supabase)
- Create a Supabase project, copy its connection string (use the **pooled** "Transaction" URL for serverless).
- In `prisma/schema.prisma`, change the datasource provider from `sqlite` to `postgresql`.
- Push the schema to Supabase:
  ```
  DATABASE_URL="postgres://...pooled..." npx prisma db push
  ```
- Create your admin account against the live DB:
  ```
  DATABASE_URL="postgres://..." node scripts/seed-admin.mjs you@email.com "a-strong-password"
  ```

## 2. Environment variables (set in Vercel → Project → Settings → Environment Variables)
```
DATABASE_URL                         = <Supabase pooled connection string>
AUTH_SECRET                          = <run: openssl rand -hex 32>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   = pk_live_...        (LIVE)
STRIPE_SECRET_KEY                    = sk_live_...        (LIVE)
CONTRACT_VERSION                     = 2026-07-v1         (bump when the contract text changes)
NEXT_PUBLIC_SITE_URL                 = https://jetcrust.com
SITE_ORIGIN                          = https://jetcrust.com
RESEND_API_KEY                       = re_...
EMAIL_FROM                           = Jet Crust <bookings@jetcrust.com>
EMAIL_ADMIN                          = contact@jetcrust.com
CRON_SECRET                          = <run: openssl rand -hex 24>
```
Do not put live keys anywhere except Vercel's settings. Never commit them.

## 3. Deploy
- Push this `jetcrust-app` folder to a Git repo and import it in Vercel (framework auto-detected as Next.js).
- Vercel runs the build. The `vercel.json` cron syncs external calendars every 3 hours.

## 4. Email domain (Resend)
- Add and verify your sending domain in Resend (DNS records).
- Set `EMAIL_FROM` to an address on that domain. Until verified, emails fall back to the dev outbox.

## 5. Calendar sync (channel manager)
- Give each platform (Airbnb, Booking.com, VRBO, concierge) our export feed so they see our booked dates:
  `https://jetcrust.com/api/ical/castelaria` (and `/marque-de-lago`, `/soho-place`).
- To pull their calendars in, paste their iCal URLs into each property's `ical_urls` in `data/*.json`, redeploy, and the cron (or the Admin "Sync calendars" button) imports them.

## 6. Domain cutover (keeps SEO)
- The 81 old WordPress URLs already 301-redirect to the new pages (`middleware.ts` + `lib/redirects.ts`), so rankings carry over.
- Point jetcrust.com at Vercel (Vercel gives the exact DNS records). Add `www` too.
- After DNS propagates, submit `https://jetcrust.com/sitemap.xml` in **Google Search Console** and request re-indexing.

## 7. Before you take real money — final checks
- [ ] Reset the admin password (do not keep the seeded test one).
- [ ] Finalize the rental contract text in `lib/contract.ts` (ideally lawyer-reviewed) and bump `CONTRACT_VERSION`.
- [ ] Replace `data/soho-place.json` price/details with the confirmed figures.
- [ ] Do one real booking end to end with a live card for a small test amount, approve it, confirm the charge and the confirmation email, then refund it from the Stripe dashboard.
- [ ] Add real Privacy, Terms, Cookie and GDPR pages (currently placeholder links).
- [ ] Delete the redundant static HTML files in the project root (`index.html`, `castelaria.html`, etc.); the app is the source of truth.

## Notes
- Stripe holds authorizations for about 7 days; approve requests within that window or the hold expires (status EXPIRED).
- The database keeps only accounts, bookings, availability and consent records. Property content stays in `data/*.json`.
