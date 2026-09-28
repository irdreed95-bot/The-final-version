import {useState} from "react";
import {Search,SlidersHorizontal,X} from "lucide-react";
import {searchMedia,discoverMovies,discoverSeries,Media} from "../lib/tmdb";
import MediaCard from "../components/MediaCard";

export default function SearchPage(){
  const [q,setQ]=useState(""),[items,setItems]=useState<Media[]>([]),[loading,setLoading]=useState(false);
  const [type,setType]=useState<"all"|"movie"|"tv">("all");
  const [year,setYear]=useState(""),[minRating,setMinRating]=useState(""),[sort,setSort]=useState("popularity.desc");
  const [advanced,setAdvanced]=useState(false),[searched,setSearched]=useState(false);

  const go=async(e?:any)=>{
    e?.preventDefault();setLoading(true);setSearched(true);
    try{
      if(q.trim()){
        const r=await searchMedia(q.trim());
        let next=(r.results||[]).filter(x=>x.media_type==="movie"||x.media_type==="tv");
        if(type!=="all")next=next.filter(x=>x.media_type===type);
        if(year)next=next.filter(x=>(x.release_date||x.first_air_date||"").startsWith(year));
        if(minRating)next=next.filter(x=>(x.vote_average||0)>=Number(minRating));
        if(sort==="vote_average.desc")next.sort((a,b)=>(b.vote_average||0)-(a.vote_average||0));
        if(sort==="first_air_date.desc")next.sort((a,b)=>(b.release_date||b.first_air_date||"").localeCompare(a.release_date||a.first_air_date||""));
        setItems(next);
      }else{
        const options={year:year||undefined,minRating:minRating||undefined,sort};
        const rs=type==="movie"?[await discoverMovies(options)]:type==="tv"?[await discoverSeries(options)]:await Promise.all([discoverMovies(options),discoverSeries(options)]);
        setItems(rs.flatMap((x:any)=>x.results||[]).map((x:any)=>({...x,media_type:x.media_type||(type==="tv"?"tv":"movie")})));
      }
    }catch{setItems([])}finally{setLoading(false)}
  };

  const clear=()=>{setQ("");setType("all");setYear("");setMinRating("");setSort("popularity.desc");setItems([]);setSearched(false)};

  return <section className="page">
    <div className="page-head"><span className="pill">المكتبة الذكية</span><h2>ابحث واكتشف</h2></div>
    <form className="search search-main" onSubmit={go}><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="اكتب اسم الفيلم أو المسلسل…"/><button>بحث</button></form>
    <div className="filter-bar">
      <div className="type-filters">{[["all","الكل"],["movie","أفلام"],["tv","مسلسلات"]].map(([v,t])=><button type="button" className={type===v?"active":""} onClick={()=>setType(v as any)} key={v}>{t}</button>)}</div>
      <button type="button" className="filter-toggle" onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={16}/> فلاتر متقدمة</button>
      {(q||year||minRating||type!=="all")&&<button type="button" className="clear-filter" onClick={clear}><X size={15}/> مسح</button>}
    </div>
    {advanced&&<div className="advanced-filters">
      <label>السنة<input inputMode="numeric" maxLength={4} value={year} onChange={e=>setYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="2026"/></label>
      <label>التقييم الأدنى<select value={minRating} onChange={e=>setMinRating(e.target.value)}><option value="">الكل</option><option value="5">5+</option><option value="6">6+</option><option value="7">7+</option><option value="8">8+</option></select></label>
      <label>الترتيب<select value={sort} onChange={e=>setSort(e.target.value)}><option value="popularity.desc">الأكثر شعبية</option><option value="vote_average.desc">الأعلى تقييماً</option><option value="first_air_date.desc">الأحدث</option></select></label>
      <button className="primary apply-filter" type="button" onClick={()=>go()}>تطبيق الفلاتر</button>
    </div>}
    {loading?<div className="loading">جاري تجهيز النتائج…</div>:searched?<>{items.length?<div className="results-head"><b>{items.length} نتيجة</b><span>{q?"نتائج: "+q:"اكتشاف حسب الفلاتر"}</span></div>:<div className="empty-state">ما لقينا نتائج بهذه الخيارات.<button onClick={clear}>مسح الفلاتر</button></div>}<div className="cards">{items.map(x=><MediaCard key={x.id+"-"+(x.media_type||"")} item={x}/>)}</div></>:<div className="search-hint">اكتب اسم عمل أو استخدم الفلاتر حتى نجيب لك النتائج.</div>}
  </section>
}