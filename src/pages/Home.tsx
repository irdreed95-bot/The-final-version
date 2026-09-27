import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {Media,popularMovies,popularSeries,trending} from "../lib/tmdb";
import MediaRow from "../components/MediaRow";

export default function Home(){
  const [trend,setTrend]=useState<Media[]>([]);
  const [movies,setMovies]=useState<Media[]>([]);
  const [series,setSeries]=useState<Media[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    Promise.allSettled([trending(),popularMovies(),popularSeries()]).then(results=>{
      if(!alive)return;
      const messages:string[]=[];
      if(results[0].status==="fulfilled") setTrend(results[0].value.results||[]);
      else messages.push("المحتوى الرائج");
      if(results[1].status==="fulfilled") setMovies((results[1].value.results||[]).map(x=>({...x,media_type:"movie"})));
      else messages.push("الأفلام");
      if(results[2].status==="fulfilled") setSeries((results[2].value.results||[]).map(x=>({...x,media_type:"tv"})));
      else messages.push("المسلسلات");
      if(messages.length) setError("تعذر تحميل: "+messages.join("، ")+" — تأكد من VITE_TMDB_API_KEY في Vercel ثم أعد النشر.");
      setLoading(false);
    });
    return ()=>{alive=false};
  },[]);

  const hero=trend[0];
  return <div>
    {hero&&<section className="hero-media" style={{backgroundImage:"linear-gradient(90deg,#08090c 10%,#08090cb5 48%,#08090c30),url("+(hero.backdrop_path?"https://image.tmdb.org/t/p/original"+hero.backdrop_path:"")+")"}}>
      <div><span className="pill">مختارات هذا الأسبوع</span><h1>{hero.title||hero.name}</h1><p>{hero.overview||"اكتشف أحدث الأفلام والمسلسلات في مكان واحد."}</p><Link className="primary" to={"/"+(hero.media_type==="tv"||hero.name?"series":"movie")+"/"+hero.id}>التفاصيل والمشاهدة</Link></div>
    </section>}
    {loading?<div className="loading">جاري تحميل الأفلام والمسلسلات…</div>:<>
      {error&&<div className="tmdb-error">{error}</div>}
      <MediaRow title="الأكثر تداولاً" items={trend}/>
      <MediaRow title="أفلام" items={movies}/>
      <MediaRow title="مسلسلات" items={series}/>
      {!trend.length&&!movies.length&&!series.length&&!error&&<div className="loading">لا يوجد محتوى حالياً.</div>}
    </>}
  </div>
}
