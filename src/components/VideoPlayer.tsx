import {useEffect,useState} from "react";
import {getPublicPlaybackConfig} from "../lib/adminApi";
import Hls from "hls.js";

type Props={tmdbId:number;type:"movie"|"tv";season?:number;episode?:number;poster?:string;title?:string};
type Source={url:string;label?:string;kind?:"iframe"|"hls"|"mp4"};

function expandTemplate(template:string,tmdbId:number,type:"movie"|"tv",season:number,episode:number){
  return template.replaceAll("{tmdbId}",String(tmdbId)).replaceAll("{type}",type).replaceAll("{season}",String(season)).replaceAll("{episode}",String(episode));
}
function isHttp(url:string){try{return /^https?:$/i.test(new URL(url).protocol)}catch{return false}}
function isIframe(url:string){return /\/embed(?:\/|\?|$)|iframe/i.test(url)}
function isHls(url:string){return /\.m3u8(?:$|[?#])/i.test(url)}

export default function VideoPlayer({tmdbId,type,season=1,episode=1,poster,title}:Props){
  const [sources,setSources]=useState<Source[]>([]);
  const [selected,setSelected]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [speed,setSpeed]=useState(1);
  const [playerError,setPlayerError]=useState("");\n  const [failed,setFailed]=useState<number[]>([]);

  useEffect(()=>{
    let alive=true;
    setLoading(true); setError(""); setSelected(0); setFailed([]);
    const load=async()=>{
      const all:Source[]=[];
      const api=(import.meta.env.VITE_PLAYBACK_API_URL as string|undefined)?.trim();
      if(api){
        try{
          const u=new URL(api);
          u.searchParams.set("tmdbId",String(tmdbId)); u.searchParams.set("type",type);
          u.searchParams.set("season",String(season)); u.searchParams.set("episode",String(episode));
          const r=await fetch(u.toString(),{headers:{accept:"application/json"}});
          if(r.ok){
            const d=await r.json();
            for(const x of Array.isArray(d?.sources)?d.sources:[]) if(typeof x?.url==="string"&&isHttp(x.url)) all.push({url:x.url,label:x.label||"Cloudflare",kind:x.kind});
          }
        }catch{}
      }
      try{
        const cfg=await getPublicPlaybackConfig();
        const custom=(cfg.custom_streams||[])
          .filter((x:any)=>String(x.tmdbId)===String(tmdbId)&&x.type===type&&typeof x.url==="string"&&isHttp(x.url))
          .map((x:any)=>({url:String(x.url),label:x.label||"سيرفر مخصص"}));
        const providers=(cfg.source_providers||[])
          .filter((p:any)=>p&&p.enabled!==false&&typeof p.urlTemplate==="string"&&(p.type==="both"||p.type===type))
          .sort((a:any,b:any)=>(Number(a.priority)||999)-(Number(b.priority)||999));
        for(const p of providers){
          const url=expandTemplate(p.urlTemplate,tmdbId,type,season,episode);
          if(isHttp(url)) all.push({url,label:p.name||"مصدر",kind:p.kind});
        }
        all.push(...custom);
      }catch{ if(!all.length) throw new Error("config"); }
      const unique=all.filter((x,i,a)=>x.url&&!a.slice(0,i).some(y=>y.url===x.url));
      if(!alive)return;
      setSources(unique);
      if(!unique.length)setError("لا يوجد مصدر مشاهدة مرخّص ومهيأ لهذا العنوان حالياً.");
    };
    load().catch(()=>{if(alive)setError("تعذر تحميل إعدادات المشاهدة.");}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[tmdbId,type,season,episode]);

  const src=sources[selected]?.url||"";
  const iframe=isIframe(src);

  useEffect(()=>{
    setPlayerError("");
    setSelected(activeIndex);
    if(!src||iframe)return;
    const v=document.querySelector<HTMLVideoElement>("[data-final-player]");
    if(!v)return;
    v.playbackRate=speed;
    let h:Hls|undefined;
    const fail=()=>setFailed(prev=>prev.includes(activeIndex)?prev:[...prev,activeIndex]);
    const onError=()=>{fail();setPlayerError("تعذر تشغيل هذا المصدر. جاري تجربة المصدر التالي…");};
    v.addEventListener("error",onError);
    if(isHls(src)&&Hls.isSupported()){
      h=new Hls({enableWorker:true});
      h.on(Hls.Events.ERROR,(_:any,d:any)=>{if(d.fatal){fail();setPlayerError("تعذر تشغيل هذا المصدر. جاري تجربة المصدر التالي…");}});
      h.loadSource(src); h.attachMedia(v);
    }else if(v.canPlayType("application/vnd.apple.mpegurl")) v.src=src;
    else v.src=src;
    return()=>{v.removeEventListener("error",onError);h?.destroy();v.pause();};
  },[src,speed,iframe,activeIndex]);

  return <div className="player">
    <div className="player-video-wrap">
      {loading?<div className="loading">جاري تجهيز المشغل…</div>
      :src?(iframe
        ?<iframe key={src} src={src} title={title||"المشغل"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/>
        :<video key={src} data-final-player poster={poster} controls playsInline preload="metadata"/>)
      :<div className="loading">{error}</div>}
    </div>
    {title&&<div className="player-title">{title}</div>}
    <div className="player-tools">
      <span>{sources.length?"المصادر المتاحة: "+sources.length:"لا يوجد مصدر"}</span>
      <label>السرعة <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,.75,1,1.25,1.5,2].map(x=><option key={x} value={x}>{x}x</option>)}</select></label>
      {sources.length>1&&<select value={activeIndex} onChange={e=>setSelected(Number(e.target.value))}>{sources.map((x,i)=><option key={x.url} value={i}>{x.label||`مصدر ${i+1}`}</option>)}</select>}
    </div>
    {playerError&&<p className="error">{playerError}</p>}
  </div>;
}
