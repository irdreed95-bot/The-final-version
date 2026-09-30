export type LiveNewsChannel={name:string;url:string;logo?:string;group?:string;language:"ar"|"en"|"es"};

const PLAYLISTS=[
 {language:"ar" as const,url:"https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_zz_news_ar.m3u8"},
 {language:"en" as const,url:"https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_zz_news_en.m3u8"},
 {language:"es" as const,url:"https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_zz_news_es.m3u8"}
];

function attr(line:string,key:string){const m=line.match(new RegExp(key+'="([^"]*)"','i'));return m?.[1]||undefined}
function parse(text:string,language:LiveNewsChannel["language"]){
 const lines=text.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean),out:LiveNewsChannel[]=[];
 for(let i=0;i<lines.length;i++){
  if(!lines[i].startsWith('#EXTINF'))continue;
  const info=lines[i],url=lines[i+1];
  if(!url||url.startsWith('#')||!/^https?:\\/\\//i.test(url))continue;
  const comma=info.indexOf(','),name=(comma>=0?info.slice(comma+1):'').trim();
  if(!name)continue;
  out.push({name,url,language,logo:attr(info,'tvg-logo'),group:attr(info,'group-title')});
 }
 return out;
}

let cache:{items:LiveNewsChannel[];at:number}|null=null;
export async function fetchFreeTvNews(){
 if(cache&&Date.now()-cache.at<10*60*1000)return cache.items;
 const results=await Promise.allSettled(PLAYLISTS.map(async p=>{const r=await fetch(p.url,{cache:"no-store"});if(!r.ok)throw new Error(String(r.status));return parse(await r.text(),p.language)}));
 const items=results.flatMap(x=>x.status==="fulfilled"?x.value:[]);
 const seen=new Set<string>();
 const unique=items.filter(x=>{const key=x.name+'|'+x.url;if(seen.has(key))return false;seen.add(key);return true});
 cache={items:unique,at:Date.now()};return unique;
}
