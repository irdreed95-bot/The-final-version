export type PlaybackRequest={tmdbId:number;type:"movie"|"tv";season:number;episode:number};
export type PlaybackSource={url:string;label?:string;kind?:"hls"|"mp4";proxiedUrl?:string};

const DIRECT_CATALOG_URL=((import.meta.env.VITE_AUTHORIZED_PLAYBACK_CATALOG_URL as string|undefined)||"").trim();

function isHttp(url:string){try{return /^https?:$/i.test(new URL(url).protocol)}catch{return false}}
function detectKind(url:string):PlaybackSource["kind"]{
  if(/\\.m3u8(?:$|[?#])/i.test(url))return"hls";
  if(/\\.mp4(?:$|[?#])/i.test(url))return"mp4";
  return undefined;
}

export async function getPlaybackSources(request:PlaybackRequest):Promise<PlaybackSource[]>{
  if(!DIRECT_CATALOG_URL)return [];
  const u=new URL(DIRECT_CATALOG_URL);
  u.searchParams.set("tmdbId",String(request.tmdbId));
  u.searchParams.set("type",request.type);
  u.searchParams.set("season",String(request.season));
  u.searchParams.set("episode",String(request.episode));
  const response=await fetch(u.toString(),{headers:{accept:"application/json"}});
  if(!response.ok)throw new Error("تعذر الوصول إلى مصدر التشغيل المباشر.");
  const data=await response.json();
  const raw=Array.isArray(data?.sources)?data.sources:Array.isArray(data)?data:[];
  return raw.flatMap((item:any)=>{
    if(typeof item?.url!=="string"||!isHttp(item.url)||item?.isEmbed)return [];
    const kind=item.kind==="hls"||item.kind==="mp4"?item.kind:detectKind(item.url);
    if(!kind)return [];
    return [{url:item.url,label:item.label||item.name,kind,proxiedUrl:typeof item.proxiedUrl==="string"&&isHttp(item.proxiedUrl)?item.proxiedUrl:undefined}];
  });
}

export async function isDirectPlaybackAvailable(request:PlaybackRequest){
  try{return (await getPlaybackSources(request)).length>0}catch{return false}
}
