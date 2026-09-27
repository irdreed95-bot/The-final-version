const key=import.meta.env.VITE_TMDB_API_KEY as string|undefined;
const base="https://api.themoviedb.org/3";
async function get<T>(path:string){if(!key) throw new Error("TMDB API key is not configured"); const sep=path.includes("?")?"&":"?"; const r=await fetch(base+path+sep+"api_key="+encodeURIComponent(key)+"&language=ar",{headers:{accept:"application/json"}}); if(!r.ok) throw new Error("TMDB request failed"); return r.json() as Promise<T>}
export type Media={id:number;title?:string;name?:string;overview?:string;poster_path?:string|null;backdrop_path?:string|null;vote_average?:number;release_date?:string;first_air_date?:string;media_type?:string};
export const img=(p?:string|null,size="w500")=>p?"https://image.tmdb.org/t/p/"+size+p:"";
export const trending=()=>get<{results:Media[]}>("/trending/all/week?language=ar");
export const popularMovies=()=>get<{results:Media[]}>("/movie/popular?language=ar&page=1");
export const popularSeries=()=>get<{results:Media[]}>("/tv/popular?language=ar&page=1");
export const searchMedia=(q:string)=>get<{results:Media[]}>("/search/multi?language=ar&query="+encodeURIComponent(q)+"&include_adult=false&page=1");
export const movie=(id:number)=>get<Media&{credits?:any;genres?:any[]}>("/movie/"+id+"?language=ar&append_to_response=credits");
export const series=(id:number)=>get<Media&{credits?:any;seasons?:any[];genres?:any[]}>("/tv/"+id+"?language=ar&append_to_response=credits");
export const season=(id:number,s:number)=>get<any>("/tv/"+id+"/season/"+s+"?language=ar");
