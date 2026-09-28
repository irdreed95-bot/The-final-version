const key=import.meta.env.VITE_TMDB_API_KEY as string|undefined;
const base="https://api.themoviedb.org/3";

async function get<T>(path:string){
  const token=key?.trim();
  if(!token) throw new Error("TMDB API key is not configured");

  const url=new URL(base+path);
  if(!url.searchParams.has("language")) url.searchParams.set("language","ar");

  const headers:Record<string,string>={accept:"application/json"};
  if(token.startsWith("eyJ")){
    headers.Authorization="Bearer "+token;
  }else{
    url.searchParams.set("api_key",token);
  }

  const r=await fetch(url.toString(),{headers});
  if(!r.ok){
    let detail="";
    try{detail=await r.text()}catch{}
    throw new Error("TMDB request failed ("+r.status+")"+(detail?" — "+detail.slice(0,180):""));
  }
  return r.json() as Promise<T>;
}

export type Media={
  id:number;title?:string;name?:string;overview?:string;
  poster_path?:string|null;backdrop_path?:string|null;
  vote_average?:number;release_date?:string;first_air_date?:string;
  media_type?:string
};

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
