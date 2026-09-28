import { useEffect, useRef, useState } from "react";
import { getPublicPlaybackConfig } from "../lib/adminApi";
import Hls from "hls.js";

type Props = {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  poster?: string;
  title?: string;
};

type Source = {
  url: string;
  label?: string;
  kind?: "iframe" | "hls" | "mp4";
};

// مفتاح الترخيص الموحد الخاص بتطبيقك
const API_SECRET_KEY = "Sarad_Secret_App_2026";

// رابط الـ API المباشر على Cloudflare Worker
const DEFAULT_API_URL = "https://my-stream-proxy.irdreed95.workers.dev";

function expandTemplate(template: string, tmdbId: number, type: "movie" | "tv", season: number, episode: number) {
  return template
    .replaceAll("{tmdbId}", String(tmdbId))
    .replaceAll("{type}", type)
    .replaceAll("{season}", String(season))
    .replaceAll("{episode}", String(episode));
}

function isHttp(url: string) {
  try {
    return /^https?:$/i.test(new URL(url).protocol);
  } catch {
    return false;
  }
}

// التحقق وتحديد نوع المصدر
function detectKind(url: string, isM3U8?: boolean, isEmbed?: boolean): Source["kind"] {
  if (isEmbed) return "iframe";
  if (isM3U8 || /\.m3u8(?:$|[?#])/i.test(url)) return "hls";
  if (/\.mp4(?:$|[?#])/i.test(url)) return "mp4";
  if (/\/embed(?:\/|\?|$)|iframe/i.test(url)) return "iframe";
  return "hls";
}

export default function VideoPlayer({ tmdbId, type, season = 1, episode = 1, poster, title }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const [playerError, setPlayerError] = useState("");
  const [failed, setFailed] = useState<number[]>([]);
  const failedRef = useRef<number[]>([]);
  const storageKey = `final-progress:${type}:${tmdbId}:${season}:${episode}`;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setSelected(0);
    setFailed([]);
    failedRef.current = [];
    setPlayerError("");

    const load = async () => {
      const all: Source[] = [];
      const api = ((import.meta.env.VITE_PLAYBACK_API_URL as string | undefined)?.trim()) || DEFAULT_API_URL;

      // 1. جلب المصادر المباشرة والبديلة من Cloudflare Worker
      if (api) {
        try {
          const u = new URL(api);
          u.searchParams.set("tmdbId", String(tmdbId));
          u.searchParams.set("type", type);
          u.searchParams.set("season", String(season));
          u.searchParams.set("episode", String(episode));
          
          if (!u.searchParams.has("key")) {
            u.searchParams.set("key", API_SECRET_KEY);
          }

          const r = await fetch(u.toString(), { 
            headers: { 
              accept: "application/json",
              "X-API-KEY": API_SECRET_KEY 
            } 
          });
          
          if (r.ok) {
            const d = await r.json();
            const rawSources = Array.isArray(d?.sources) ? d.sources : [];

            for (const x of rawSources) {
              if (typeof x?.url === "string" && isHttp(x.url)) {
                all.push({
                  url: x.url,
                  label: x.label || x.quality || (x.isEmbed ? "سيرفر البث (Embed)" : "سيرفر مباشر HLS"),
                  kind: x.kind || detectKind(x.url, x.isM3U8, x.isEmbed),
                });
              }
            }
          }
        } catch (e) {
          console.error("Failed to fetch from resolve API", e);
        }
      }

      // 2. جلب أي مصادر وإعدادات إضافية من لوحة الإدارة (إن وجدت)
      try {
        const cfg = await getPublicPlaybackConfig();

        for (const endpoint of cfg.server_urls || []) {
          if (typeof endpoint !== "string" || !isHttp(endpoint)) continue;
          try {
            const u = new URL(endpoint);
            u.searchParams.set("tmdbId", String(tmdbId));
            u.searchParams.set("type", type);
            u.searchParams.set("season", String(season));
            u.searchParams.set("episode", String(episode));

            const r = await fetch(u.toString(), { headers: { accept: "application/json" } });
            if (!r.ok) continue;

            const d = await r.json();
            const rows = Array.isArray(d?.sources) ? d.sources : Array.isArray(d) ? d : d?.url ? [d] : [];

            for (const x of rows) {
              if (typeof x?.url === "string" && isHttp(x.url)) {
                all.push({
                  url: x.url,
                  label: x.label || "سيرفر التطبيق",
                  kind: x.kind || detectKind(x.url, x.isM3U8, x.isEmbed),
                });
              }
            }
          } catch {}
        }

        const custom = (cfg.custom_streams || [])
          .filter((x: any) => String(x.tmdbId) === String(tmdbId) && x.type === type && typeof x.url === "string" && isHttp(x.url))
          .map((x: any) => ({ url: String(x.url), label: x.label || "سيرفر مخصص", kind: detectKind(String(x.url), x.isM3U8, x.isEmbed) }));

        const providers = (cfg.source_providers || [])
          .filter((p: any) => p && p.enabled !== false && typeof p.urlTemplate === "string" && (p.type === "both" || p.type === type))
          .sort((a: any, b: any) => (Number(a.priority) || 999) - (Number(b.priority) || 999));

        for (const p of providers) {
          const url = expandTemplate(p.urlTemplate, tmdbId, type, season, episode);
          if (isHttp(url)) all.push({ url, label: p.name || "مصدر", kind: p.kind || detectKind(url) });
        }

        all.push(...custom);
      } catch {
        if (!all.length) throw new Error("config");
      }

      // تصفية المصادر المكررة
      const unique = all.filter((x, i, a) => x.url && !a.slice(0, i).some((y) => y.url === x.url));

      if (!alive) return;
      setSources(unique);

      if (!unique.length) {
        setError("لا يوجد مصدر مشاهدة مهيأ لهذا العنوان حالياً.");
      }
    };

    load()
      .catch(() => {
        if (alive) setError("تعذر تحميل إعدادات المشاهدة.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [tmdbId, type, season, episode]);

  const src = sources[selected]?.url || "";
  const sourceKind = sources[selected]?.kind || detectKind(src);
  const iframe = sourceKind === "iframe";

  useEffect(() => {
    setPlayerError("");
    const v = videoRef.current;
    if (!v || !src || iframe) return;

    v.playbackRate = speed;
    const saved = Number(localStorage.getItem(storageKey) || 0);

    try {
      const raw = JSON.parse(localStorage.getItem("final-recent") || "[]");
      const item = {
        key: storageKey,
        path: type === "tv" ? `/series/${tmdbId}` : `/movie/${tmdbId}`,
        title: title || "مشاهدة",
        poster: poster || "",
      };
      const next = [item, ...raw.filter((x: any) => x.key !== storageKey)].slice(0, 12);
      localStorage.setItem("final-recent", JSON.stringify(next));
    } catch {}

    const restore = () => {
      if (saved > 10 && saved < v.duration - 20) {
        v.currentTime = saved;
        setPlayerError(`استأنفنا المشاهدة من ${Math.floor(saved / 60)}:${String(Math.floor(saved % 60)).padStart(2, "0")}`);
      }
    };

    const progress = () => localStorage.setItem(storageKey, String(v.currentTime));

    v.addEventListener("loadedmetadata", restore);
    v.addEventListener("timeupdate", progress);

    let h: Hls | undefined;
    let handled = false;

    const fail = () => {
      if (handled) return;
      handled = true;
      failedRef.current = failedRef.current.includes(selected) ? failedRef.current : [...failedRef.current, selected];
      setFailed(failedRef.current);
      const next = sources.findIndex((_, i) => i !== selected && !failedRef.current.includes(i));
      if (next >= 0) {
        setPlayerError("المصدر الحالي لم يعمل، جاري الانتقال للمصدر التالي…");
        setSelected(next);
      } else setPlayerError("تعذر تشغيل جميع المصادر المهيأة لهذا العنوان.");
    };

    const onError = () => fail();
    v.addEventListener("error", onError);

    if (sourceKind === "hls" && Hls.isSupported()) {
      h = new Hls({ enableWorker: true });
      h.on(Hls.Events.ERROR, (_: any, d: any) => {
        if (d.fatal) fail();
      });
      h.loadSource(src);
      h.attachMedia(v);
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
    } else {
      v.src = src;
    }

    return () => {
      v.removeEventListener("error", onError);
      v.removeEventListener("loadedmetadata", restore);
      v.removeEventListener("timeupdate", progress);
      h?.destroy();
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [src, sourceKind, selected, speed]);

  return (
    <div className="player">
      <div className="player-video-wrap">
        {loading ? (
          <div className="loading">جاري تجهيز المشغل…</div>
        ) : src ? (
          iframe ? (
            <iframe
              key={src}
              src={src}
              title={title || "المشغل"}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <video ref={videoRef} key={src} data-final-player poster={poster} controls playsInline preload="metadata" />
          )
        ) : (
          <div className="loading">{error}</div>
        )}
      </div>
      {title && (
        <div className="player-title">
          {title}
          {type === "tv" && <span className="episode-label"> · الموسم {season} · الحلقة {episode}</span>}
        </div>
      )}
      <div className="player-tools">
        <span>{sources.length ? "المصادر المتاحة: " + sources.length : "لا يوجد مصدر"}</span>
        <label>
          السرعة{" "}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((x) => (
              <option key={x} value={x}>
                {x}x
              </option>
            ))}
          </select>
        </label>
        {sources.length > 1 && (
          <select
            value={selected}
            onChange={(e) => {
              const n = Number(e.target.value);
              setSelected(n);
              failedRef.current = [];
              setFailed([]);
            }}
          >
            {sources.map((x, i) => (
              <option key={x.url} value={i}>
                {x.label || `مصدر ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>
      {playerError && <p className="error player-error">{playerError}</p>}
      {src && !iframe && (
        <button
          className="player-clear-progress"
          onClick={() => {
            localStorage.removeItem(storageKey);
            if (videoRef.current) videoRef.current.currentTime = 0;
            setPlayerError("تمت إعادة المشاهدة من البداية.");
          }}
        >
          بدء من البداية
        </button>
      )}
    </div>
  );
}
