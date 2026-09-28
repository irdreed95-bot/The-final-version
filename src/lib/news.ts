const API=(import.meta.env.VITE_PLAYBACK_API_URL as string|undefined)?.trim().replace(/\/$/,'');

export type NewsItem={id:string;title:string;link:string;description:string;publishedAt:string;source:string;image?:string};

export async function fetchNews(category='world'){
  if(!API) throw new Error('VITE_PLAYBACK_API_URL is not configured');
  const r=await fetch(API+'/news/real?category='+encodeURIComponent(category),{headers:{accept:'application/json'}});
  if(!r.ok) throw new Error('NEWS_REQUEST_FAILED');
  return r.json() as Promise<{category:string;updatedAt:string;count:number;items:NewsItem[]}>;
}
