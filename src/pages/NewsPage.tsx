import {useEffect,useState} from "react";
import {ExternalLink,RefreshCw,Newspaper} from "lucide-react";
import {fetchNews,NewsItem} from "../lib/news";

const cats=[["world","العالم"],["iraq","العراق"],["technology","تكنولوجيا"],["sports","رياضة"]];

export default function NewsPage(){
  const [category,setCategory]=useState("world");
  const [items,setItems]=useState<NewsItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=async()=>{setLoading(true);setError("");try{const r=await fetchNews(category);setItems(r.items||[])}catch{setItems([]);setError("تعذر جلب الأخبار حالياً. حاول مرة ثانية.")}finally{setLoading(false)}};
  useEffect(()=>{load()},[category]);
  return <section className="page">
    <div className="page-head"><span className="pill">أخبار مباشرة</span><h2><Newspaper size={25}/> آخر الأخبار</h2><p>عناوين حقيقية تُجلب مباشرة من خلاصات الأخبار، مع فتح الخبر من مصدره الأصلي.</p></div>
    <div className="filter-bar news-tabs">{cats.map(([v,t])=><button type="button" className={category===v?"active":""} onClick={()=>setCategory(v)} key={v}>{t}</button>)}<button type="button" className="filter-toggle" onClick={load}><RefreshCw size={15}/> تحديث</button></div>
    {loading?<div className="loading">جاري جلب الأخبار الحقيقية…</div>:error?<div className="empty-state">{error}<button onClick={load}>إعادة المحاولة</button></div>:<div className="news-grid">{items.map(x=><article className="news-card" key={x.id}><div className="news-source">{x.source}<span>{x.publishedAt?new Date(x.publishedAt).toLocaleString("ar-IQ"):"الآن"}</span></div><h3>{x.title}</h3>{x.description&&<p>{x.description}</p>}<a href={x.link} target="_blank" rel="noreferrer">قراءة الخبر من المصدر <ExternalLink size={15}/></a></article>)}</div>}
  </section>
}
