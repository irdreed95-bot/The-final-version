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

const API_SECRET_KEY = "Sarad_Secret_App_2026";
const DEFAULT_API_URL = "https://my-stream-proxy.irdreed95.workers.dev";

function expandTemplate(
  template: string,
  tmdbId: number,
  type: "movie" | "tv",
  season: number,
  episode: number,
) {
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

function detectKind(
  url: string,
  isM3U8?: boolean,
  isEmbed?: boolean,
): Source["kind"] {
  if (isEmbed) return "iframe";
  if (isM3U8 || /\.m3u8(?:$|[?#])/i.test(url)) return "hls";
  if (/\.(mp4|webm|mov)(?:$|[?#])/i.test(url)) return "mp4";
  if (/\/embed(?:\/|$)|\/tv\/|\/movie\//i.test(url)) return "iframe";
  return "hls";
}

function normalizeApiUrl(raw: string) {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return "";
  return value;
}

export default function VideoPlayer({
  tmdbId,
  type,
  season = 1,
  episode = 1,
  poster,
  title,
}: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const [playerError, setPlayerError] = useState("");
  const [iframeLoading, setIframeLoading] = useState(false);

  const failedRef = useRef<number[]>([]);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const storageKey = `final-progress:${type}:${tmdbId}:${season}:${episode}`;

  useEffect(() => {
    let alive = true;

    setLoading(true);
    setError("");
    setSelected(0);
    failedRef.current = [];
    setPlayerError("");

    const load = async () => {
      const all: Source[] = [];
      const api =
        normalizeApiUrl(
          (import.meta.env.VITE_PLAYBACK_API_URL as string | undefined) || "",
        ) || DEFAULT_API_URL;

      // 1. Resolve API / Cloudflare Worker.
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
            "X-API-KEY": API_SECRET_KEY,
          },
          signal: AbortSignal.timeout(30000),
        });

        if (r.ok) {
          const d = await r.json();
          const rawSources = Array.isArray(d?.sources)
            ? d.sources
            : Array.isArray(d)
              ? d
              : d?.url
                ? [d]
                : [];

          for (const x of rawSources) {
            if (typeof x?.url === "string" && isHttp(x.url)) {
              all.push({
                url: x.url,
                label: x.label || x.quality || "سيرفر البث",
                kind: x.kind || detectKind(x.url, x.isM3U8, x.isEmbed),
              });
            }
          }
        }
      } catch (e) {
        console.error("Playback API request failed", e);
      }

      // 2. Public app playback configuration.
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

            const r = await fetch(u.toString(), {
              headers: { accept: "application/json" },
              signal: AbortSignal.timeout(20000),
            });

            if (!r.ok) continue;

            const d = await r.json();
            const rows = Array.isArray(d?.sources)
              ? d.sources
              : Array.isArray(d)
                ? d
                : d?.url
                  ? [d]
                  : [];

            for (const x of rows) {
              if (typeof x?.url === "string" && isHttp(x.url)) {
                all.push({
                  url: x.url,
                  label: x.label || "سيرفر التطبيق",
                  kind: x.kind || detectKind(x.url, x.isM3U8, x.isEmbed),
                });
              }
            }
          } catch {
            // Continue with the next configured server.
          }
        }

        const custom = (cfg.custom_streams || [])
          .filter(
            (x: any) =>
              String(x.tmdbId) === String(tmdbId) &&
              x.type === type &&
              typeof x.url === "string" &&
              isHttp(x.url),
          )
          .map((x: any) => ({
            url: String(x.url),
            label: x.label || "سيرفر مخصص",
            kind: detectKind(String(x.url), x.isM3U8, x.isEmbed),
          }));

        const providers = (cfg.source_providers || [])
          .filter(
            (p: any) =>
              p &&
              p.enabled !== false &&
              typeof p.urlTemplate === "string" &&
              (p.type === "both" || p.type === type),
          )
          .sort(
            (a: any, b: any) =>
              (Number(a.priority) || 999) - (Number(b.priority) || 999),
          );

        for (const p of providers) {
          const url = expandTemplate(
            p.urlTemplate,
            tmdbId,
            type,
            season,
            episode,
          );

          if (isHttp(url)) {
            all.push({
              url,
              label: p.name || "مصدر",
              kind: p.kind || detectKind(url),
            });
          }
        }

        all.push(...custom);
      } catch (e) {
        console.error("Playback config request failed", e);
      }

      const unique = all.filter(
        (x, i, a) =>
          x.url &&
          !a.slice(0, i).some((y) => y.url.trim() === x.url.trim()),
      );

      if (!alive) return;

      setSources(unique);
      setSelected(0);

      if (!unique.length) {
        setError("لا يوجد مصدر مشاهدة مهيأ لهذا العنوان حالياً.");
      }
    };

    load()
      .catch(() => {
        if (alive) {
          setSources([]);
          setError("تعذر الاتصال بخدمة المشاهدة.");
        }
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

  // Change playback speed without recreating/restarting HLS.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Iframe watchdog.
  // We cannot inspect a cross-origin iframe's internal player state because
  // the browser's same-origin policy prevents access to its DOM/state.
  useEffect(() => {
    if (iframeTimerRef.current) {
      clearTimeout(iframeTimerRef.current);
      iframeTimerRef.current = null;
    }

    setIframeLoading(Boolean(src && iframe));

    if (!src || !iframe) return;

    iframeTimerRef.current = setTimeout(() => {
      setIframeLoading(false);
      setPlayerError(
        "المصدر تأخر في الاستجابة. جاري تجربة المصدر التالي…",
      );

      const next = sources.findIndex(
        (_, index) =>
          index !== selected && !failedRef.current.includes(index),
      );

      if (next >= 0) {
        failedRef.current = [...failedRef.current, selected];
        setSelected(next);
      } else {
        setPlayerError(
          "المصدر الحالي لم يبدأ التشغيل. جرّب مصدراً آخر من القائمة.",
        );
      }
    }, 20000);

    return () => {
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
        iframeTimerRef.current = null;
      }
    };
  }, [src, iframe, selected, sources]);

  useEffect(() => {
    setPlayerError("");

    const v = videoRef.current;
    if (!v || !src || iframe) return;

    let h: Hls | undefined;
    let handled = false;

    const saved = Number(localStorage.getItem(storageKey) || 0);

    const remember = () => {
      try {
        const raw = JSON.parse(
          localStorage.getItem("final-recent") || "[]",
        );

        const item = {
          key: storageKey,
          path: type === "tv" ? `/series/${tmdbId}` : `/movie/${tmdbId}`,
          title: title || "مشاهدة",
          poster: poster || "",
        };

        localStorage.setItem(
          "final-recent",
          JSON.stringify([
            item,
            ...raw.filter((x: any) => x.key !== storageKey),
          ].slice(0, 12)),
        );
      } catch {}
    };

    const restore = () => {
      if (
        saved > 10 &&
        Number.isFinite(v.duration) &&
        saved < v.duration - 20
      ) {
        try {
          v.currentTime = saved;
        } catch {}

        setPlayerError(
          `استأنفنا المشاهدة من ${Math.floor(saved / 60)}:${String(
            Math.floor(saved % 60),
          ).padStart(2, "0")}`,
        );
      }
    };

    const progress = () => {
      if (Number.isFinite(v.currentTime) && v.currentTime > 0) {
        localStorage.setItem(storageKey, String(v.currentTime));
      }
    };

    const fail = () => {
      if (handled) return;
      handled = true;

      failedRef.current = failedRef.current.includes(selected)
        ? failedRef.current
        : [...failedRef.current, selected];

      const next = sources.findIndex(
        (_, index) =>
          index !== selected && !failedRef.current.includes(index),
      );

      if (next >= 0) {
        setPlayerError(
          "المصدر الحالي لم يعمل، جاري تجربة المصدر التالي…",
        );
        setSelected(next);
      } else {
        setPlayerError(
          "تعذر تشغيل المصادر المتاحة لهذا العنوان.",
        );
      }
    };

    const onVideoError = () => fail();

    const onLoadedMetadata = () => {
      restore();
      remember();
    };

    v.addEventListener("error", onVideoError);
    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("timeupdate", progress);

    if (sourceKind === "hls") {
      if (Hls.isSupported()) {
        h = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 4,
          fragLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 1000,
          levelLoadingRetryDelay: 1000,
          fragLoadingRetryDelay: 1000,
        });

        h.on(Hls.Events.MEDIA_ATTACHED, () => {
          try {
            h?.loadSource(src);
          } catch {
            fail();
          }
        });

        h.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            try {
              h?.startLoad(-1);
            } catch {
              fail();
            }
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try {
              h?.recoverMediaError();
            } catch {
              fail();
            }
            return;
          }

          fail();
        });

        h.attachMedia(v);
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = src;
        v.load();
      } else {
        fail();
      }
    } else {
      v.src = src;
      v.load();
    }

    return () => {
      v.removeEventListener("error", onVideoError);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      v.removeEventListener("timeupdate", progress);

      h?.destroy();
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [
    src,
    sourceKind,
    selected,
    storageKey,
    tmdbId,
    type,
    title,
    poster,
    season,
    episode,
  ]);

  return (
    <div className="player">
      <div className="player-video-wrap">
        {loading ? (
          <div className="loading">جاري تجهيز المشغل…</div>
        ) : src ? (
          iframe ? (
            <div className="player-iframe-wrap">
              <iframe
                key={src}
                src={src}
                title={title || "المشغل"}
                loading="eager"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; clipboard-write"
                allowFullScreen
                referrerPolicy="origin-when-cross-origin"
                onLoad={() => {
                  setIframeLoading(false);
                  if (iframeTimerRef.current) {
                    clearTimeout(iframeTimerRef.current);
                    iframeTimerRef.current = null;
                  }
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  display: "block",
                }}
              />

              {iframeLoading && (
                <div className="loading player-iframe-loading">
                  جاري تشغيل المصدر…
                </div>
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              key={src}
              data-final-player
              poster={poster}
              controls
              playsInline
              preload="metadata"
              controlsList="nodownload noplaybackrate"
            />
          )
        ) : (
          <div className="loading">{error}</div>
        )}
      </div>

      {title && (
        <div className="player-title">
          {title}
          {type === "tv" && (
            <span className="episode-label">
              {" "}
              · الموسم {season} · الحلقة {episode}
            </span>
          )}
        </div>
      )}

      <div className="player-tools">
        <span>
          {sources.length
            ? "المصادر المتاحة: " + sources.length
            : "لا يوجد مصدر"}
        </span>

        <label>
          السرعة{" "}
          <select
            value={speed}
            onChange={(e) => {
              const value = Number(e.target.value);
              setSpeed(value);

              if (videoRef.current) {
                videoRef.current.playbackRate = value;
              }
            }}
          >
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

              if (iframeTimerRef.current) {
                clearTimeout(iframeTimerRef.current);
                iframeTimerRef.current = null;
              }

              failedRef.current = [];
              setPlayerError("");
              setSelected(n);
            }}
          >
            {sources.map((x, i) => (
              <option key={x.url + i} value={i}>
                {x.label || `مصدر ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {playerError && (
        <p className="error player-error">{playerError}</p>
      )}

      {src && iframe && sources.length > 1 && (
        <button
          className="player-clear-progress"
          type="button"
          onClick={() => {
            if (iframeTimerRef.current) {
              clearTimeout(iframeTimerRef.current);
              iframeTimerRef.current = null;
            }

            const next = sources.findIndex(
              (_, index) =>
                index !== selected &&
                !failedRef.current.includes(index),
            );

            if (next >= 0) {
              failedRef.current = [...failedRef.current, selected];
              setPlayerError("جاري تجربة المصدر التالي…");
              setSelected(next);
            }
          }}
        >
          تجربة المصدر التالي
        </button>
      )}

      {src && !iframe && (
        <button
          className="player-clear-progress"
          type="button"
          onClick={() => {
            localStorage.removeItem(storageKey);

            if (videoRef.current) {
              videoRef.current.currentTime = 0;
            }

            setPlayerError("تمت إعادة المشاهدة من البداية.");
          }}
        >
          بدء من البداية
        </button>
      )}
    </div>
  );
}
