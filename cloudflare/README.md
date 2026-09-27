# Cloudflare playback layer

This Worker is intentionally a **configuration resolver**, not a scraper.

Endpoint:
GET /resolve?tmdbId=123&type=movie
GET /resolve?tmdbId=123&type=tv&season=1&episode=2

Set PLAYBACK_CONFIG to JSON containing only sources you own or are licensed to distribute. Templates may use:
- {tmdbId}
- {type}
- {season}
- {episode}

The worker does not discover, scrape, bypass, decrypt, or extract protected streams from third-party sites.
