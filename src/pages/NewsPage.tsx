import {useEffect,useMemo,useState} from "react";
import {ExternalLink,RefreshCw,Newspaper,Radio,Play} from "lucide-react";
import {fetchNews,NewsItem} from "../lib/news";
import {fetchFreeTvNews,LiveNewsChannel} from "../lib/freeTvNews";
import VideoPlayer from "../components/VideoPlayer";

const cats=[["world","العالم"],["iraq","العراق"],["technology","تكنولوجيا"],["sports","رياضة"]];

export default function NewsPage(){
 const [category,setCategory]=useState("world"),[items,setItems]=useState<NewsItem[]>([]),[channels,setChannels]=useState<LiveNewsChannel[]>([]);
 const [mode,setMode]=useState<"articles"|"live">("articles"),[language,setLanguage]=useState<"all"|"ar"|"en"|"es">("all");
 const [selected,setSelected]=useState<LiveNewsChannel|null>(null),[loading,setLoading]=useState(true),[channelsLoading,setChannelsLoading]=useState(false),[error,setError]=useState("");
 const load=async()=>{setLoading(true);setError("");try{const r=await fetchNews(category);setItems(r.items||[])}catch{setItems([]);setError("تعذر جلب الأخبار حالياً. حاول مرة ثانية.")}finally{setLoading(false)}};
 const loadChannels=async()=>{setChannelsLoading(true);try{setChannels(await fetchFreeTvNews())}catch{setChannels([])}finally{setChannelsLoading(false)}};
 useEffect(()=>{load();loadChannels()},[category]);
 const visible=useMemo(()=>language==="all"?channels:channels.filter(x=>x.language===language),[channels,language]);
 return <section className="page">
  <div className="page-head"><span className="pill">{mode==="live"?"قنوات أخبار مباشرة":"أخبار مباشرة"}</span><h2><Newspaper size={25}/> الأخبار</h2><p>أخبار نصية مع قنوات أخبار مباشرة مجانية من قوائم Free-TV/IPTV.</p></div>
  <div className="filter-bar news-tabs">
   <button type="button" className={mode==="articles"?"active":""} onClick={()=>setMode("articles")}>الأخبار</button>
   <button type="button" className={mode==="live"?"active":""} onClick={()=>setMode("live")}><Radio size={15}/> قنوات مباشرة</button>
   {mode==="articles"&&cats.map(([v,t])=><button type="button" className={category===v?"active":""} onClick={()=>setCategory(v)} key={v}>{t}</button>)}
   <button type="button" className="filter-toggle" onClick={()=>mode==="live"?loadChannels():load()}><RefreshCw size={15}/> تحديث</button>
  </div>
  {mode==="articles"?(loading?<div className="loading">جاري جلب الأخبار الحقيقية…</div>:error?<div className="empty-state">{error}<button onClick={load}>إعادة المحاولة</button></div>:<div className="news-grid">{items.map(x=><article className="news-card" key={x.id}><div className="news-source">{x.source}<span>{x.publishedAt?new Date(x.publishedAt).toLocaleString("ar-IQ"):"الآن"}</span></div><h3>{x.title}</h3>{x.description&&<p>{x.description}</p>}<a href={x.link} target="_blank" rel="noreferrer">قراءة الخبر من المصدر <ExternalLink size={15}/></a></article>)}</div>)
  :<>{channelsLoading?<div className="loading">جاري تحميل كل قنوات الأخبار…</div>:<><div className="filter-bar news-tabs"><button className={language==="all"?"active":""} onClick={()=>setLanguage("all")}>الكل ({channels.length})</button><button className={language==="ar"?"active":""} onClick={()=>setLanguage("ar")}>العربية ({channels.filter(x=>x.language==="ar").length})</button><button className={language==="en"?"active":""} onClick={()=>setLanguage("en")}>English ({channels.filter(x=>x.language==="en").length})</button><button className={language==="es"?"active":""} onClick={()=>setLanguage("es")}>Español ({channels.filter(x=>x.language==="es").length})</button></div><div className="news-grid">{visible.map((x,i)=><article className="news-card" key={x.name+"|"+x.url}><div className="news-source"><span>{x.language.toUpperCase()}</span></div>{x.logo&&<img src={x.logo} alt="" loading="lazy" style={{width:56,height:56,objectFit:"contain",marginBottom:10}}/>}<h3>{x.name}</h3><button type="button" className="primary" onClick={()=>setSelected(x)}><Play size={15}/> مشاهدة مباشرة</button></article>)}</div></>}</>}
  {selected&&<div className="news-live-modal" role="dialog" aria-modal="true"><div className="news-live-panel"><button type="button" className="filter-toggle" onClick={()=>setSelected(null)}>إغلاق</button><VideoPlayer tmdbId={0} type="movie" directUrl={selected.url} title={selected.name}/></div></div>}
 </section>;
}
