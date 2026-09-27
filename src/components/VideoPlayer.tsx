import {useEffect,useRef} from "react"; import Hls from "hls.js";
export default function VideoPlayer({src,poster}:{src:string;poster?:string}){const ref=useRef<HTMLVideoElement>(null);
useEffect(()=>{const v=ref.current;if(!v||!src)return;let h:Hls|undefined;if(src.includes(".m3u8")&&Hls.isSupported()){h=new Hls({enableWorker:true});h.loadSource(src);h.attachMedia(v)}else v.src=src;return()=>{h?.destroy();v.pause();}},[src]);
return <div className="player"><video ref={ref} poster={poster} controls playsInline preload="metadata"/></div>}