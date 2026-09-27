export interface Env {
  PLAYBACK_CONFIG: string;
}

type ConfigItem = {
  tmdbId: string;
  type: "movie" | "tv";
  season?: string;
  episode?: string;
  url: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

function expand(value: string, p: URL) {
  return value
    .replaceAll("{tmdbId}", p.searchParams.get("tmdbId") || "")
    .replaceAll("{type}", p.searchParams.get("type") || "")
    .replaceAll("{season}", p.searchParams.get("season") || "1")
    .replaceAll("{episode}", p.searchParams.get("episode") || "1");
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname !== "/resolve") return json({ error: "Not found" }, 404);

    const tmdbId = url.searchParams.get("tmdbId");
    const type = url.searchParams.get("type") as "movie" | "tv" | null;
    if (!tmdbId || (type !== "movie" && type !== "tv")) {
      return json({ error: "tmdbId and type are required" }, 400);
    }

    let items: ConfigItem[] = [];
    try { items = JSON.parse(env.PLAYBACK_CONFIG || "[]"); } catch { return json({ error: "Invalid PLAYBACK_CONFIG" }, 500); }

    const matches = items
      .filter(x => String(x.tmdbId) === tmdbId && x.type === type && x.url)
      .map(x => ({ ...x, url: expand(x.url, url) }));

    return json({ sources: matches });
  }
};
