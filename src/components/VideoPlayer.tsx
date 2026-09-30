import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {getPlaybackSources,type PlaybackSource} from "../lib/playback";
type Props={tmdbId:number;type:"movie"|"tv";season?:number;episode?:number;poster?:string;title?:string};

export default function VideoPlayer({tmdbId,type,season=1,episode=1,poster,title}:Props){
 const [sources,setSources]=useState<PlaybackSource[]>([]),[selected,setSelected]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[speed]=useState(1),[playerError,setPlayerError]=useState("");
 const videoRef=useRef<HTMLVideoElement>(null);
 const storageKey="final-progress:"+type+":"+tmdbId+":"+season+":"+episode;
 useEffect(()=>{let alive=true;setLoading(true);setError("");setSelected(0);setPlayerError("");
  getPlaybackSources({tmdbId,type,season,episode}).then(value=>{if(!alive)return;if(value.length)setSources(value);else setError("لا يوجد مصدر تشغيل مباشر مهيأ لهذا العنوان.");}).catch((err:any)=>{if(alive)setError(err?.message||"تعذر الوصول إلى مصدر التشغيل.");}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[tmdbId,type,season,episode]);
 const currentSource=sources[selected],playbackSrc=currentSource?.proxiedUrl||currentSource?.url||"";
 useEffect(()=>{setPlayerError("");const v=videoRef.current;if(!v||!playbackSrc)return;let hlsInstance:Hls|undefined;const savedTime=Number(localStorage.getItem(storageKey)||0);
  const handleLoadedMetadata=()=>{if(savedTime>10&&Number.isFinite(v.duration)&&savedTime<v.duration-20)v.currentTime=savedTime};
  const handleTimeUpdate=()=>{if(Number.isFinite(v.currentTime)&&v.currentTime>0)localStorage.setItem(storageKey,String(v.currentTime))};
  v.addEventListener("loadedmetadata",handleLoadedMetadata);v.addEventListener("timeupdate",handleTimeUpdate);
  if(currentSource?.kind==="hls"){if(Hls.isSupported()){hlsInstance=new Hls({enableWorker:true});hlsInstance.loadSource(playbackSrc);hlsInstance.attachMedia(v);hlsInstance.on(Hls.Events.ERROR,(_e,data)=>{if(data?.fatal){setPlayerError("تعذر تشغيل مصدر HLS الحالي.");hlsInstance?.destroy()}})}else if(v.canPlayType("application/vnd.apple.mpegurl"))v.src=playbackSrc;else setPlayerError("هذا المتصفح لا يدعم تشغيل HLS.");}
  else{v.src=playbackSrc;v.onerror=()=>setPlayerError("تعذر تشغيل ملف MP4 الحالي.");}
  return()=>{v.removeEventListener("loadedmetadata",handleLoadedMetadata);v.removeEventListener("timeupdate",handleTimeUpdate);hlsInstance?.destroy()};
 },[playbackSrc,currentSource,storageKey]);
 return <div className="player"><div className="player-video-wrap">{loading?<div className="loading">جاري تجهيز التشغيل المباشر…</div>:playbackSrc?<video ref={videoRef} key={playbackSrc} poster={poster} controls playsInline preload="metadata" style={{width:"100%",height:"100%"}} onLoadedData={()=>{if(videoRef.current)videoRef.current.playbackRate=speed}}/>:<div className="loading">{error}</div>}</div>{title&&<div className="player-title">{title} {type==="tv"&&(" · الموسم "+season+" · الحلقة "+episode)}</div>}{sources.length>0&&<div className="player-tools"><span>مصادر مباشرة: {sources.length}</span>{sources.length>1&&<select value={selected} onChange={e=>{setSelected(Number(e.target.value));setPlayerError("")}}>{sources.map((x,i)=><option key={i} value={i}>{x.label||("مصدر "+(i+1))} ({x.kind?.toUpperCase()})</option>)}</select>}</div>}{playerError&&<p className="error player-error">{playerError}</p>}{error&&!loading&&<p className="error player-error">{error}</p>}</div>
}
