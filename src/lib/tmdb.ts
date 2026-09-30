const key=import.meta.env.VITE_TMDB_API_KEY as string|undefined;
const base="https://api.themoviedb.org/3";
async function get<T>(path:string){
  const token=key?.trim();
  if(!token) throw new Error("TMDB API key is not configured");
  const url=new URL(base+path);
  if(!url.searchParams.has("language")) url.searchParams.set("language","ar");
  const headers:Record<string,string>={accept:"application/json"};
  if(token.startsWith("eyJ")) headers.Authorization="Bearer "+token; else url.searchParams.set("api_key",token);
  const r=await fetch(url.toString(),{headers});
  if(!r.ok){let detail="";try{detail=await r.text()}catch{}throw new Error("TMDB request failed ("+r.status+")"+(detail?" — "+detail.slice(0,180):""));}
  return r.json() as Promise<T>;
}
export type Media={id:number;title?:string;name?:string;overview?:string;poster_path?:string|null;backdrop_path?:string|null;vote_average?:number;release_date?:string;first_air_date?:string;media_type?:string};
export const img=(p?:string|null,size="w500")=>p?"https://image.tmdb.org/t/p/"+size+p:"";
export const trending=()=>get<{results:Media[]}>("/trending/all/week?language=ar");
export const popularMovies=()=>get<{results:Media[]}>("/movie/popular?language=ar&page=1");
export const popularSeries=()=>get<{results:Media[]}>("/tv/popular?language=ar&page=1");
export const searchMedia=(q:string)=>get<{results:Media[]}>("/search/multi?language=ar&query="+encodeURIComponent(q)+"&include_adult=false&page=1");
export const movie=(id:number)=>get<Media&{credits?:any;genres?:any[]}>("/movie/"+id+"?language=ar&append_to_response=credits");
export const series=(id:number)=>get<Media&{credits?:any;seasons?:any[];genres?:any[]}>("/tv/"+id+"?language=ar&append_to_response=credits");
export const season=(id:number,s:number)=>get<any>("/tv/"+id+"/season/"+s+"?language=ar");
export type WatchProvider={provider_id:number;provider_name:string;logo_path?:string|null;display_priority?:number};
export type WatchProviders={results?:Record<string,{link?:string;flatrate?:WatchProvider[];rent?:WatchProvider[];buy?:WatchProvider[];free?:WatchProvider[];ads?:WatchProvider[]}>};
export const watchProviders=(id:number,type:"movie"|"tv")=>get<WatchProviders>("/"+type+"/"+id+"/watch/providers");
export type DiscoverOptions={year?:string;minRating?:string;sort?:string};
const discover=(type:"movie"|"tv",o:DiscoverOptions={})=>{const p=new URLSearchParams({language:"ar",page:"1",sort_by:o.sort||"popularity.desc",include_adult:"false"});if(o.year)p.set(type==="movie"?"primary_release_year":"first_air_date_year",o.year);if(o.minRating)p.set("vote_average.gte",o.minRating);return get<{results:Media[]}>(`/discover/${type}?${p.toString()}`)};
export const discoverMovies=(o:DiscoverOptions={})=>discover("movie",o);
export const discoverSeries=(o:DiscoverOptions={})=>discover("tv",o);

const playbackCache=new Map<string,boolean>();
const getPlaybackApi=()=>((import.meta.env.VITE_PLAYBACK_API_URL as string|undefined)||"").trim().replace(/\/$/,"");
async function checkPlayable(id:number,type:"movie"|"tv",season=1,episode=1):Promise<boolean>{
  const api=getPlaybackApi(); if(!api)return false;
  const key=`${type}:${id}:${season}:${episode}`;
  if(playbackCache.has(key))return playbackCache.get(key)!;
  const cached=sessionStorage.getItem("playable:"+key);
  if(cached==="1"||cached==="0"){const value=cached==="1";playbackCache.set(key,value);return value;}
  try{
    const url=new URL(api.endsWith("/resolve")?api:api+"/resolve");
    url.searchParams.set("tmdbId",String(id));url.searchParams.set("type",type);url.searchParams.set("season",String(season));url.searchParams.set("episode",String(episode));
    const r=await fetch(url.toString(),{headers:{accept:"application/json"}});
    if(!r.ok){playbackCache.set(key,false);sessionStorage.setItem("playable:"+key,"0");return false;}
    const data=await r.json();
    const playable=Boolean(data?.ok&&Array.isArray(data?.sources)&&data.sources.some((s:any)=>typeof s?.url==="string"&&(s?.kind==="hls"||s?.kind==="mp4"||/\.m3u8(?:$|[?#])/i.test(s.url)||/\.mp4(?:$|[?#])/i.test(s.url))));
    playbackCache.set(key,playable);sessionStorage.setItem("playable:"+key,playable?"1":"0");return playable;
  }catch{playbackCache.set(key,false);sessionStorage.setItem("playable:"+key,"0");return false;}
}
export async function filterPlayableMedia(items:Media[],limit=18):Promise<Media[]>{
  const candidates=items.filter(x=>x.media_type==="movie"||x.media_type==="tv").slice(0,limit*2);
  const output:Media[]=[];let cursor=0;
  const worker=async()=>{while(true){const index=cursor++;if(index>=candidates.length||output.length>=limit)return;const item=candidates[index];const playable=await checkPlayable(item.id,item.media_type==="tv"?"tv":"movie",1,1);if(playable&&output.length<limit)output.push(item);}};
  await Promise.all(Array.from({length:Math.min(6,candidates.length)},()=>worker()));
  return output;
}
