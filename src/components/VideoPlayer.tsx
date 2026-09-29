import { useEffect, useRef, useState } from "react";
import { getPublicPlaybackConfig } from "../lib/adminApi";
import Artplayer from "artplayer";
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

const API_SECRET_KEY = "Sarad_Secret_App_2026";
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
  
  const artRef = useRef<HTMLDivElement>(null);
  const artInstanceRef = useRef<Artplayer | null>(null);
  const storageKey = `final-progress:${type}:${tmdbId}:${season}:${episode}`;

  // 1. جلب المصادر والسيرفرات
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    const load = async () => {
      const all: Source[] = [];
      const api = ((import.meta.env.VITE_PLAYBACK_API_URL as string | undefined)?.trim()) || DEFAULT_API_URL;

      if (api) {
        try {
          const u = new URL(api);
          u.searchParams.set("tmdbId", String(tmdbId));
          u.searchParams.set("type", type);
          u.searchParams.set("season", String(season));
          u.searchParams.set("episode", String(episode));
          if (!u.searchParams.has("key")) u.searchParams.set("key", API_SECRET_KEY);

          const r = await fetch(u.toString(), { 
            headers: { accept: "application/json", "X-API-KEY": API_SECRET_KEY } 
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
          console.error("Failed to fetch from proxy", e);
        }
      }

      try {
        const cfg = await getPublicPlaybackConfig();
        const providers = (cfg.source_providers || [])
          .filter((p: any) => p && p.enabled !== false && typeof p.urlTemplate === "string" && (p.type === "both" || p.type === type));

        for (const p of providers) {
          const url = expandTemplate(p.urlTemplate, tmdbId, type, season, episode);
          if (isHttp(url)) all.push({ url, label: p.name || "مصدر", kind: p.kind || detectKind(url) });
        }
      } catch {}

      const unique = all.filter((x, i, a) => x.url && !a.slice(0, i).some((y) => y.url === x.url));

      if (!alive) return;
      setSources(unique);
      if (!unique.length) setError("لا يوجد مصدر مشاهدة مهيأ حالياً.");
      setLoading(false);
    };

    load();
    return () => { alive = false; };
  }, [tmdbId, type, season, episode]);

  const src = sources[selected]?.url || "";
  const sourceKind = sources[selected]?.kind || detectKind(src);
  const isIframe = sourceKind === "iframe";

  // 2. تشغيل واستدعاء المشغل الاحترافي
  useEffect(() => {
    if (!artRef.current || !src || isIframe) return;

    // تدمير المشغل القديم في حال التبديل
    if (artInstanceRef.current) {
      artInstanceRef.current.destroy(false);
    }

    const savedProgress = Number(localStorage.getItem(storageKey) || 0);

    const art = new Artplayer({
      container: artRef.current,
      url: src,
      poster: poster || "",
      type: sourceKind === "hls" ? "m3u8" : "mp4",
      autoplay: false,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      playbackRate: true,
      setting: true,
      aspectRatio: true,
      autoOrientation: true,
      customType: {
        m3u8: function (video, url) {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
          }
        },
      },
    });

    artInstanceRef.current = art;

    // استئناف الوقت وتخزين التقدم
    art.on("ready", () => {
      if (savedProgress > 10) art.currentTime = savedProgress;
    });

    art.on("video:timeupdate", () => {
      if (art.currentTime > 0) {
        localStorage.setItem(storageKey, String(art.currentTime));
      }
    });

    return () => {
      if (artInstanceRef.current) {
        artInstanceRef.current.destroy(false);
      }
    };
  }, [src, sourceKind, isIframe]);

  return (
    <div className="player">
      <div className="player-video-wrap" style={{ position: "relative", width: "100%", height: "450px", backgroundColor: "#000" }}>
        {loading ? (
          <div className="loading" style={{ color: "#fff", padding: "20px" }}>جاري تجهيز المشغل العالمي…</div>
        ) : src ? (
          isIframe ? (
            <iframe
              key={src}
              src={src}
              title={title || "المشغل"}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="origin-when-cross-origin"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <div ref={artRef} style={{ width: "100%", height: "100%" }} />
          )
        ) : (
          <div className="loading" style={{ color: "#fff", padding: "20px" }}>{error}</div>
        )}
      </div>

      {title && (
        <div className="player-title" style={{ marginTop: "10px", fontWeight: "bold" }}>
          {title}
          {type === "tv" && <span className="episode-label"> · الموسم {season} · الحلقة {episode}</span>}
        </div>
      )}

      {sources.length > 1 && (
        <div className="player-tools" style={{ marginTop: "10px" }}>
          <label style={{ marginLeft: "10px" }}>اختر السيرفر: </label>
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            style={{ padding: "5px 10px", borderRadius: "5px" }}
          >
            {sources.map((x, i) => (
              <option key={x.url + i} value={i}>
                {x.label || `سيرفر ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
