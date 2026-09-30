import {isDirectPlaybackAvailable,getPlaybackSources} from "./playback";
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
const discover=(type:"movie"|"tv",o:DiscoverOptions={})=>{const p=new URLSearchParams({language:"ar",page:"1",sort_by:o.sort||"popularity.desc",include_adult:"false"});if(o.year)p.set(type==="movie"?"primary_release_year":"first_air_date_year",o.year);if(o.minRating)p.set("vote_average.gte",o.minRating);return get<{results:Media[]}>("/discover/"+type+"?"+p.toString())};
export const discoverMovies=(o:DiscoverOptions={})=>discover("movie",o);
export const discoverSeries=(o:DiscoverOptions={})=>discover("tv",o);


const playbackCache=new Map<string,{value:boolean;at:number}>();
const seriesSummaryCache=new Map<string,{value:boolean;at:number}>();
const seriesReportCache=new Map<string,{value:SeriesAvailabilityReport;at:number}>();
const CACHE_MS=10*60*1000;
const SERIES_BATCH_SIZE=200;
const SERIES_METADATA_CONCURRENCY=4;

export type EpisodeAvailability={
  season:number;
  episode:number;
  id?:number;
  name?:string;
  airDate?:string;
  available:boolean|null;
  sourceCount:number;
};

export type SeasonAvailability={
  seasonNumber:number;
  name:string;
  declaredEpisodeCount:number;
  fetchedEpisodeCount:number;
  checkedEpisodeCount:number;
  availableEpisodeCount:number;
  coverage:number|null;
  state:"available"|"partial"|"empty"|"declared-empty"|"unknown"|"missing";
  isSpecials:boolean;
  episodes:EpisodeAvailability[];
};

export type SeriesAvailabilityReport={
  tmdbId:number;
  totalMetadataEpisodes:number;
  checkedEpisodes:number;
  availableEpisodes:number;
  coverage:number|null;
  mainEpisodes:number;
  availableMainEpisodes:number;
  mainCoverage:number|null;
  specialEpisodes:number;
  availableSpecialEpisodes:number;
  specialCoverage:number|null;
  seasons:SeasonAvailability[];
};

async function readPlaybackJson(url:string,init?:RequestInit){
  const response=await fetch(url,{...init,headers:{accept:"application/json",...(init?.headers||{})}});
  let data:any=null;
  try{data=await response.json()}catch{}
  return {response,data};
}

async function checkSeriesSummary(id:number):Promise<boolean>{
 const key="series-summary:"+id; const memory=seriesSummaryCache.get(key); if(memory&&Date.now()-memory.at<CACHE_MS)return memory.value;
 try{
  const details=await series(id); const episodes=Array.isArray(details?.seasons)?details.seasons.filter((s:any)=>Number(s?.season_number)>0).map((s:any)=>Number(s.episode_count)||0).reduce((a:number,b:number)=>a+b,0):0;
  if(!episodes){seriesSummaryCache.set(key,{value:false,at:Date.now()});return false;}
  const probe=await isDirectPlaybackAvailable({tmdbId:id,type:"tv",season:1,episode:1});
  seriesSummaryCache.set(key,{value:probe,at:Date.now()}); return probe;
 }catch{seriesSummaryCache.set(key,{value:false,at:Date.now()});return false;}
}

export async function isPlayable(id:number,type:"movie"|"tv",seasonNumber=1,episodeNumber=1):Promise<boolean>{
 const key=type+":"+id+":"+seasonNumber+":"+episodeNumber; const memory=playbackCache.get(key); if(memory&&Date.now()-memory.at<CACHE_MS)return memory.value;
 try{const value=await isDirectPlaybackAvailable({tmdbId:id,type,season:seasonNumber,episode:episodeNumber}); const at=Date.now(); playbackCache.set(key,{value,at}); return value;}
 catch{playbackCache.set(key,{value:false,at:Date.now()});return false;}
}

async function checkSeriesEpisodePlayable(id:number,seasonNumber:number,episodeNumber:number):Promise<boolean>{return isPlayable(id,"tv",seasonNumber,episodeNumber);}

async function fetchSeasonMetadata(id:number,seasonNumber:number){
  try{
    const value=await season(id,seasonNumber);
    return {ok:true,value};
  }catch{
    return {ok:false,value:null};
  }
}

export async function getSeriesAvailability(
  id:number,
  seriesData?:Media&{seasons?:any[]},
):Promise<SeriesAvailabilityReport>{
  const cacheKey="series-report:"+id;
  const memory=seriesReportCache.get(cacheKey);
  if(memory&&Date.now()-memory.at<CACHE_MS)return memory.value;
  try{
    const details=seriesData||await series(id);
    const seasonMeta=Array.isArray(details?.seasons)
      ? details.seasons.filter((s:any)=>Number.isInteger(Number(s?.season_number))&&Number(s.season_number)>=0)
      : [];
    const uniqueSeasons=new Map<number,any>();
    for(const item of seasonMeta)uniqueSeasons.set(Number(item.season_number),item);
    const seasons=Array.from(uniqueSeasons.values()).sort((a,b)=>Number(a.season_number)-Number(b.season_number));

    const loaded=new Map<number,any>();
    let cursor=0;
    const worker=async()=>{
      while(true){
        const index=cursor++;
        if(index>=seasons.length)return;
        const meta=seasons[index];
        const sn=Number(meta.season_number);
        const result=await fetchSeasonMetadata(id,sn);
        loaded.set(sn,result);
      }
    };
    await Promise.all(Array.from({length:Math.min(SERIES_METADATA_CONCURRENCY,seasons.length)},()=>worker()));

    const allEpisodes:Array<{season:number;episode:number;id?:number}>=[];
    const seasonStates:SeasonAvailability[]=[];

    for(const meta of seasons){
      const sn=Number(meta.season_number);
      const declared=Math.max(0,Number(meta.episode_count)||0);
      const result=loaded.get(sn);
      const episodes=Array.isArray(result?.value?.episodes)?result.value.episodes:[];
      const uniqueEpisodeIds=new Set<string>();
      const normalizedEpisodes:any[]=[];
      for(const ep of episodes){
        const episodeNumber=Number(ep?.episode_number);
        if(!Number.isFinite(episodeNumber)||episodeNumber<0)continue;
        const identity=ep?.id!=null?"id:"+String(ep.id):"coord:"+sn+":"+episodeNumber+":"+String(ep?.air_date||"")+":"+String(ep?.name||"");
        if(uniqueEpisodeIds.has(identity))continue;
        uniqueEpisodeIds.add(identity);
        normalizedEpisodes.push(ep);
        allEpisodes.push({season:sn,episode:episodeNumber,id:Number(ep?.id)||undefined});
      }

      const isSpecials=sn===0;
      let state:SeasonAvailability["state"];
      if(!result?.ok)state="unknown";
      else if(normalizedEpisodes.length===0&&declared===0)state="empty";
      else if(normalizedEpisodes.length===0&&declared>0)state="declared-empty";
      else if(declared>0&&normalizedEpisodes.length<declared)state="partial";
      else state="available";

      seasonStates.push({
        seasonNumber:sn,
        name:String(meta.name||("الموسم "+sn)),
        declaredEpisodeCount:declared,
        fetchedEpisodeCount:normalizedEpisodes.length,
        checkedEpisodeCount:0,
        availableEpisodeCount:0,
        coverage:null,
        state,
        isSpecials,
        episodes:normalizedEpisodes.map((ep:any)=>({season:sn,episode:Number(ep.episode_number),id:Number(ep?.id)||undefined,name:String(ep?.name||"حلقة "+ep.episode_number),airDate:ep?.air_date||undefined,available:null,sourceCount:0})),
      });
    }

    const announcedMainSeasons=new Set(seasonStates.filter(s=>!s.isSpecials).map(s=>s.seasonNumber));
    const maxMainSeason=Math.max(0,...announcedMainSeasons);
    for(let missingSeason=1;missingSeason<=maxMainSeason;missingSeason++){
      if(announcedMainSeasons.has(missingSeason))continue;
      seasonStates.push({
        seasonNumber:missingSeason,
        name:"الموسم "+missingSeason,
        declaredEpisodeCount:0,
        fetchedEpisodeCount:0,
        checkedEpisodeCount:0,
        availableEpisodeCount:0,
        coverage:null,
        state:"missing",
        isSpecials:false,
        episodes:[],
      });
    }
    seasonStates.sort((a,b)=>a.seasonNumber-b.seasonNumber);

    const uniqueRefs=new Map<string,{season:number;episode:number}>();
    for(const ep of allEpisodes)uniqueRefs.set(ep.season+":"+ep.episode,{season:ep.season,episode:ep.episode});
    const refs=Array.from(uniqueRefs.values());

    const availabilityMap=new Map<string,EpisodeAvailability>();
    if(refs.length){
      const cursor={value:0};
      const worker=async()=>{while(true){const index=cursor.value++;if(index>=refs.length)return;const ref=refs[index];const available=await checkSeriesEpisodePlayable(id,ref.season,ref.episode);availabilityMap.set(ref.season+":"+ref.episode,{season:ref.season,episode:ref.episode,available,sourceCount:available?1:0});}};
      await Promise.all(Array.from({length:Math.min(6,refs.length)},()=>worker()));
    }

    for(const seasonReport of seasonStates){
      const updated=seasonReport.episodes.map(ep=>{const status=availabilityMap.get(seasonReport.seasonNumber+":"+ep.episode);return status?{...ep,...status}:ep;});
      const checked=updated.filter(ep=>ep.available!==null).length;
      const available=updated.filter(ep=>ep.available===true).length;
      seasonReport.episodes=updated;
      seasonReport.checkedEpisodeCount=checked;
      seasonReport.availableEpisodeCount=available;
      seasonReport.coverage=checked?available/checked:null;
    }

    const totalMetadataEpisodes=seasonStates.reduce((sum,s)=>sum+s.fetchedEpisodeCount,0);
    const checkedEpisodes=seasonStates.reduce((sum,s)=>sum+s.checkedEpisodeCount,0);
    const availableEpisodes=seasonStates.reduce((sum,s)=>sum+s.availableEpisodeCount,0);
    const mainEpisodes=seasonStates.filter(s=>!s.isSpecials).reduce((sum,s)=>sum+s.checkedEpisodeCount,0);
    const availableMainEpisodes=seasonStates.filter(s=>!s.isSpecials).reduce((sum,s)=>sum+s.availableEpisodeCount,0);
    const specialEpisodes=seasonStates.filter(s=>s.isSpecials).reduce((sum,s)=>sum+s.checkedEpisodeCount,0);
    const availableSpecialEpisodes=seasonStates.filter(s=>s.isSpecials).reduce((sum,s)=>sum+s.availableEpisodeCount,0);
    const report:SeriesAvailabilityReport={
      tmdbId:id,
      totalMetadataEpisodes,
      checkedEpisodes,
      availableEpisodes,
      coverage:checkedEpisodes?availableEpisodes/checkedEpisodes:null,
      mainEpisodes,
      availableMainEpisodes,
      mainCoverage:mainEpisodes?availableMainEpisodes/mainEpisodes:null,
      specialEpisodes,
      availableSpecialEpisodes,
      specialCoverage:specialEpisodes?availableSpecialEpisodes/specialEpisodes:null,
      seasons:seasonStates,
    };
    const at=Date.now();
    seriesReportCache.set(cacheKey,{value:report,at});
    return report;
  }catch{
    const empty:SeriesAvailabilityReport={tmdbId:id,totalMetadataEpisodes:0,checkedEpisodes:0,availableEpisodes:0,coverage:null,mainEpisodes:0,availableMainEpisodes:0,mainCoverage:null,specialEpisodes:0,availableSpecialEpisodes:0,specialCoverage:null,seasons:[]};
    seriesReportCache.set(cacheKey,{value:empty,at:Date.now()});
    return empty;
  }
}

export async function filterPlayableMedia(items:Media[],limit=18):Promise<Media[]>{
  const candidates=items.filter(x=>x.media_type==="movie"||x.media_type==="tv").slice(0,Math.max(limit*3,30));
  const results:boolean[]=new Array(candidates.length).fill(false);
  let cursor=0;
  const worker=async()=>{
    while(true){
      const index=cursor++;
      if(index>=candidates.length)return;
      const item=candidates[index];
      results[index]=item.media_type==="tv"
        ? await checkSeriesSummary(item.id)
        : await isPlayable(item.id,"movie",1,1);
    }
  };
  await Promise.all(Array.from({length:Math.min(6,candidates.length)},()=>worker()));
  return candidates.filter((_,i)=>results[i]).slice(0,limit);
}
