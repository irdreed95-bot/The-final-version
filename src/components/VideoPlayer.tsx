import { useEffect, useRef, useState } from "react";
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
  kind?: "hls" | "mp4" | "iframe";
};

const API_SECRET_KEY = "Sarad_Secret_App_2026";
const DEFAULT_API_URL = "https://my-stream-proxy.irdreed95.workers.dev";

function isHttp(url: string) {
  try {
    return /^https?:$/i.test(new URL(url).protocol);
  } catch {
    return false;
  }
}

function detectKind(url: string): Source["kind"] {
  if (/\.m3u8(?:$|[?#])/i.test(url)) return "hls";
  if (/\.mp4(?:$|[?#])/i.test(url)) return "mp4";
  return "iframe";
}

export default function VideoPlayer({ tmdbId, type, season = 1, episode = 1, poster, title }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const [playerError, setPlayerError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const storageKey = `final-progress:${type}:${tmdbId}:${season}:${episode}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setSelected(0);

    const fetchSourcesFromWorker = async () => {
      const api = (import.meta.env.VITE_PLAYBACK_API_URL as string | undefined)?.trim() || DEFAULT_API_URL;

      try {
        const u = new URL(api);
        u.searchParams.set("tmdbId", String(tmdbId));
        u.searchParams.set("type", type);
        u.searchParams.set("season", String(season));
        u.searchParams.set("episode", String(episode));
        u.searchParams.set("key", API_SECRET_KEY);

        const response = await fetch(u.toString(), {
          headers: { accept: "application/json", "X-API-KEY": API_SECRET_KEY },
        });

        if (!response.ok) throw new Error("فشل الجلب من السيرفر");

        const data = await response.json();
        const rawSources = Array.isArray(data?.sources) ? data.sources : Array.isArray(data) ? data : [];

        const parsedSources: Source[] = [];
        for (const item of rawSources) {
          if (typeof item?.url === "string" && isHttp(item.url)) {
            parsedSources.push({
              url: item.url,
              label: item.label || item.name || `مصدر ${parsedSources.length + 1}`,
              kind: item.kind || detectKind(item.url),
            });
          }
        }

        if (!alive) return;

        if (parsedSources.length > 0) {
          setSources(parsedSources);
        } else {
          setError("لم يتم العثور على روابط تشغيل لهذا العنوان من الـ API.");
        }
      } catch (err) {
        if (alive) setError("تعذر الاتصال بسيرفر فك الروابط.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchSourcesFromWorker();

    return () => {
      alive = false;
    };
  }, [tmdbId, type, season, episode]);

  const currentSource = sources[selected];
  const src = currentSource?.url || "";
  const isIframe = currentSource?.kind === "iframe";

  // إعداد التشغيل في مشغل الفيديو الخاص بك
  useEffect(() => {
    setPlayerError("");
    const v = videoRef.current;
    if (!v || !src || isIframe) return;

    let hlsInstance: Hls | undefined;
    const savedTime = Number(localStorage.getItem(storageKey) || 0);

    const handleLoadedMetadata = () => {
      if (savedTime > 10 && Number.isFinite(v.duration) && savedTime < v.duration - 20) {
        v.currentTime = savedTime;
      }
    };

    const handleTimeUpdate = () => {
      if (Number.isFinite(v.currentTime) && v.currentTime > 0) {
        localStorage.setItem(storageKey, String(v.currentTime));
      }
    };

    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    v.addEventListener("timeupdate", handleTimeUpdate);

    // تشغيل ملفات M3U8/HLS داخل المشغل المباشر
    if (currentSource?.kind === "hls" || /\.m3u8/i.test(src)) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true });
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(v);
        hlsInstance.on(Hls.Events.ERROR, () => {
          setPlayerError("خطأ في تشغيل تدفق الفيديو HLS.");
        });
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = src;
      }
    } else {
      v.src = src;
    }

    return () => {
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("timeupdate", handleTimeUpdate);
      hlsInstance?.destroy();
    };
  }, [src, isIframe, currentSource, storageKey]);

  return (
    <div className="player">
      <div className="player-video-wrap">
        {loading ? (
          <div className="loading">جاري جلب روابط البث المباشرة من الـ API…</div>
        ) : src ? (
          isIframe ? (
            /* في حال كان الرابط قادماً كـ iframe بدون فك تشفير */
            <iframe
              key={src}
              src={src}
              title={title || "المشغل"}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            /* المشغل الخاص بك (HTML5 Video Player) */
            <video
              ref={videoRef}
              key={src}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              style={{ width: "100%", height: "100%" }}
              onLoadedData={() => {
                if (videoRef.current) videoRef.current.playbackRate = speed;
              }}
            />
          )
        ) : (
          <div className="loading">{error}</div>
        )}
      </div>

      {title && (
        <div className="player-title">
          {title} {type === "tv" && `· الموسم ${season} · الحلقة ${episode}`}
        </div>
      )}

      {sources.length > 0 && (
        <div className="player-tools">
          <span>المصادر القادمة من الـ API: {sources.length}</span>
          {sources.length > 1 && (
            <select value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
              {sources.map((x, i) => (
                <option key={i} value={i}>
                  {x.label} ({x.kind?.toUpperCase()})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {playerError && <p className="error player-error">{playerError}</p>}
    </div>
  );
}
