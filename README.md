# THE FINAL VERSION

React + Vite streaming platform prepared for Vercel.

## Vercel environment variables
Set these in Vercel Project Settings → Environment Variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_TMDB_API_KEY
- VITE_IMGBB_KEY (reserved for future image uploads)
- VITE_ADMIN_PASSWORD (legacy/simple admin gate; do not treat this as a security boundary)

Do not commit .env files or secret values to GitHub.

## Supabase
Open the Supabase SQL editor and run `supabase/schema.sql`. Then configure Auth email settings and the production Site URL/redirect URLs for your Vercel domain.

## Build
`npm install`
`npm run build`

The app contains a responsive home/search/details experience, movie and series metadata from TMDB, seasons/episodes UI, HLS/direct video playback, authentication, public chat, project requests, profile, AI assistant shell, admin shell, and a Vercel SPA rewrite.

Streaming sources must be authorized/direct URLs that you are permitted to use. The player UI itself does not inject advertisements.
