import React, { useState, useEffect } from 'react';

interface Source {
  url: string;
  quality: string;
  isM3U8: boolean;
  isEmbed: boolean;
  provider: string;
}

interface VideoPlayerProps {
  tmdbId: string;
  type?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  tmdbId,
  type = 'movie',
  season = 1,
  episode = 1,
  title,
}) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideoSources = async () => {
      setLoading(true);
      setError(null);

      try {
        // يمكنك استدعاء Cloudflare Worker مباشرة من هنا أو استدعاء سيرفرك
        const targetUrl = `https://my-stream-proxy.irdreed95.workers.dev/?tmdbId=${tmdbId}&type=${type}&season=${season}&episode=${episode}`;
        const res = await fetch(targetUrl);
        const data = await res.json();

        if (data.ok && data.sources && data.sources.length > 0) {
          // فلترة إضافية لحجب الروابط التالفة
          const validSources = data.sources.filter((s: Source) => s.url && s.url.startsWith('http'));
          setSources(validSources);
          setSelectedSource(validSources[0]);
        } else {
          setError('عذراً، لا تتوفر مصادر بث لهذا الفيلم/المسلسل حالياً.');
        }
      } catch (err) {
        setError('تعذر الاتصال بخادم البث، يرجى المحاولة لاحقاً.');
      } finally {
        setLoading(false);
      }
    };

    if (tmdbId) {
      fetchVideoSources();
    }
  }, [tmdbId, type, season, episode]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm">جاري جلب السيرفرات والتجهيز...</p>
        </div>
      </div>
    );
  }

  if (error || !selectedSource) {
    return (
      <div className="w-full aspect-video bg-gray-900 flex items-center justify-center rounded-lg text-red-400 p-4">
        <p className="text-center font-medium">{error || 'تعذر تشغيل الفيديو.'}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {/* إطار تشغيل الفيديو */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
        {selectedSource.isEmbed ? (
          <iframe
            src={selectedSource.url}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            title={title || 'Sarad Player'}
          />
        ) : (
          <video
            src={selectedSource.url}
            controls
            autoPlay
            className="w-full h-full"
          />
        )}
      </div>

      {/* شريط اختيار السيرفر في حال وجود أكثر من سيرفر */}
      {sources.length > 1 && (
        <div className="flex gap-2 overflow-x-auto py-1">
          {sources.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSource(src)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                selectedSource.url === src.url
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              سيرفر {idx + 1} ({src.provider})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


export default VideoPlayer;
