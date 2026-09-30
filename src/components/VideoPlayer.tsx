import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
type Props={tmdbId:number;type:"movie"|"tv";season?:number;episode?:number;poster?:string;title?:string};
type Source={url:string;proxiedUrl?:string;label?:string;kind?:"hls"|"mp4"};
function isHttp(url:string){try{return /^https?:$/i.test(new URL(url).protocol)}catch{return false}}
function detectKind(url:string):Source["kind"]{if(/\.m3u8(?:$|[?#])/i.test(url))return"hls";if(/\.mp4(?:$|[?#])/i.test(url))return"mp4";return undefined}
export default function VideoPlayer({tmdbId,type,season=1,episode=1,poster,title}:Props){
 const [sources,setSources]=useState<Source[]>([]),[selected,setSelected]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[speed,setSpeed]=useState(1),[playerError,setPlayerError]=useState("");
 const videoRef=useRef<HTMLVideoElement>(null);
 const storageKey="final-progress:"+type+":"+tmdbId+":"+season+":"+episode;
 useEffect(()=>{let alive=true;setLoading(true);setError("");setSelected(0);setPlayerError("");
  const fetchSources=async()=>{const api=(import.meta.env.VITE_PLAYBACK_API_URL as string|undefined)?.trim();if(!api)throw new Error("VITE_PLAYBACK_API_URL is not configured");
   try{const endpoint=api.endsWith("/resolve")?api:api.replace(/\/$/,"")+"/resolve";const u=new URL(endpoint);u.searchParams.set("tmdbId",String(tmdbId));u.searchParams.set("type",type);u.searchParams.set("season",String(season));u.searchParams.set("episode",String(episode));
    const response=await fetch(u.toString(),{headers:{accept:"application/json"}});
    if(!response.ok){let details:any=null;try{details=await response.json()}catch{}throw new Error((details?.error||"فشل الجلب من السيرفر ("+response.status+")")+(details?.code?" ["+details.code+"]":""))}
    const data=await response.json();const raw=Array.isArray(data?.sources)?data.sources:Array.isArray(data)?data:[];const parsed:Source[]=[];
    for(const item of raw){if(typeof item?.url==="string"&&isHttp(item.url)&&!item?.isEmbed){const kind=item.kind==="hls"||item.kind==="mp4"?item.kind:detectKind(item.url);if(kind!=="hls"&&kind!=="mp4")continue;parsed.push({url:item.url,proxiedUrl:typeof item?.proxiedUrl==="string"&&isHttp(item.proxiedUrl)?item.proxiedUrl:undefined,label:item.label||item.name||("مصدر "+(parsed.length+1)),kind});}}
    if(!alive)return;if(parsed.length)setSources(parsed);else setError("لا توجد مصادر HLS أو MP4 مباشرة صالحة لهذا العنوان.");
   }catch(err:any){if(alive)setError(err?.message||"تعذر الاتصال بسيرفر التشغيل.");}finally{if(alive)setLoading(false)}};fetchSources();return()=>{alive=false};
 },[tmdbId,type,season,episode]);
 const currentSource=sources[selected],src=currentSource?.url||"",playbackSrc=currentSource?.proxiedUrl||src;
 useEffect(()=>{setPlayerError("");const v=videoRef.current;if(!v||!playbackSrc)return;let hlsInstance:Hls|undefined;const savedTime=Number(localStorage.getItem(storageKey)||0);
  const handleLoadedMetadata=()=>{if(savedTime>10&&Number.isFinite(v.duration)&&savedTime<v.duration-20)v.currentTime=savedTime};const handleTimeUpdate=()=>{if(Number.isFinite(v.currentTime)&&v.currentTime>0)localStorage.setItem(storageKey,String(v.currentTime));
  v.addEventListener("loadedmetadata",handleLoadedMetadata);v.addEventListener("timeupdate",handleTimeUpdate);
  if(currentSource?.kind==="hls"){if(Hls.isSupported()){hlsInstance=new Hls({enableWorker:true});hlsInstance.loadSource(playbackSrc);hlsInstance.attachMedia(v);hlsInstance.on(Hls.Events.ERROR,(_event,data)=>{if(data?.fatal){setPlayerError("تعذر تشغيل مصدر HLS الحالي.");hlsInstance?.destroy();}})}else if(v.canPlayType("application/vnd.apple.mpegurl"))v.src=playbackSrc;else setPlayerError("هذا المتصفح لا يدعم تشغيل HLS.");}
  else{v.src=playbackSrc;v.onerror=()=>setPlayerError("تعذر تشغيل ملف MP4 الحالي.");}
  return()=>{v.removeEventListener("loadedmetadata",handleLoadedMetadata);v.removeEventListener("timeupdate",handleTimeUpdate);hlsInstance?.destroy()};
 },[playbackSrc,currentSource,storageKey]);
 return <div className="player"><div className="player-video-wrap">{loading?<div className="loading">جاري جلب روابط البث المباشرة من الـ API…</div>:playbackSrc?<video ref={videoRef} key={playbackSrc} poster={poster} controls playsInline preload="metadata" style={{width:"100%",height:"100%"}} onLoadedData={()=>{if(videoRef.current)videoRef.current.playbackRate=speed}}/>:<div className="loading">{error}</div>}</div>{title&&<div className="player-title">{title} {type==="tv"&&(" · الموسم "+season+" · الحلقة "+episode)}</div>}{sources.length>0&&<div className="player-tools"><span>مصادر مباشرة: {sources.length}</span>{sources.length>1&&<select value={selected} onChange={e=>{setSelected(Number(e.target.value));setPlayerError("")}}>{sources.map((x,i)=><option key={i} value={i}>{x.label} ({x.kind?.toUpperCase()})</option>)}</select>}</div>}{playerError&&<p className="error player-error">{playerError}</p>}{error&&!loading&&<p className="error player-error">{error}</p>}</div>
}