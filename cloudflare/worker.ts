export interface Env {
  PLAYBACK_CONFIG: string;
  SARAD_SECRET_KEY?: string;
}

type ConfigItem = {
  tmdbId: string;
  type: "movie" | "tv";
  season?: string;
  episode?: string;
  url: string;
  referer?: string;
  quality?: string;
  label?: string;
  kind?: "iframe" | "hls" | "mp4";
};

const json = (body: unknown, status = 200, extra: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type, X-API-KEY",
      ...extra,
    },
  });

function expand(value: string, p: URL) {
  return value
    .replaceAll("{tmdbId}", p.searchParams.get("tmdbId") || "")
    .replaceAll("{type}", p.searchParams.get("type") || "")
    .replaceAll("{season}", p.searchParams.get("season") || "1")
    .replaceAll("{episode}", p.searchParams.get("episode") || "1");
}

function isAllowedKey(request: Request, env: Env, key: string | null) {
  const configured = env.SARAD_SECRET_KEY?.trim();
  if (!configured) return true;
  return key === configured;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") return json(null, 204);

    const url = new URL(request.url);
    if (url.pathname !== "/resolve") return json({ error: "Not found" }, 404);

    const key = url.searchParams.get("key") || request.headers.get("X-API-KEY");
    if (!isAllowedKey(request, env, key)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const tmdbId = url.searchParams.get("tmdbId");
    const type = url.searchParams.get("type") as "movie" | "tv" | null;
    if (!tmdbId || (type !== "movie" && type !== "tv")) {
      return json({ error: "tmdbId and type are required" }, 400);
    }

    let items: ConfigItem[] = [];
    try {
      const parsed = JSON.parse(env.PLAYBACK_CONFIG || "[]");
      if (!Array.isArray(parsed)) throw new Error("not-array");
      items = parsed;
    } catch {
      return json({ error: "Invalid PLAYBACK_CONFIG" }, 500);
    }

    const season = url.searchParams.get("season") || "1";
    const episode = url.searchParams.get("episode") || "1";

    const sources = items
      .filter(x =>
        x &&
        String(x.tmdbId) === tmdbId &&
        x.type === type &&
        typeof x.url === "string" &&
        x.url.trim()
      )
      .map(x => {
        const sourceUrl = expand(x.url.trim(), url);
        const isM3U8 = /\.m3u8(?:$|[?#])/i.test(sourceUrl);
        const isEmbed = x.kind === "iframe" || /\/embed(?:\/|\?|$)/i.test(sourceUrl);
        return {
          url: sourceUrl,
          referer: x.referer ? expand(x.referer, url) : undefined,
          quality: x.quality || "Auto",
          isM3U8,
          isEmbed,
          provider: "Cloudflare-config",
          kind: x.kind || (isEmbed ? "iframe" : isM3U8 ? "hls" : "mp4"),
          label: x.label || (isEmbed ? "مصدر رسمي" : isM3U8 ? "HLS" : "MP4"),
        };
      });

    return json({
      ok: true,
      count: sources.length,
      tmdbId,
      type,
      season,
      episode,
      sources,
    });
  },
};
