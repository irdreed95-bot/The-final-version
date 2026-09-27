import {useState} from "react";
import {searchMedia,img,Media} from "../lib/tmdb";
import {Link} from "react-router-dom";

function localAnswer(q:string){
  const x=q.toLowerCase();
  if(x.includes("اكشن")||x.includes("action")) return "أقدر أبحث لك عن أعمال أكشن من مكتبة TMDB.";
  if(x.includes("رعب")||x.includes("horror")) return "أقدر أبحث لك عن أفلام ومسلسلات رعب من مكتبة TMDB.";
  if(x.includes("كوميديا")||x.includes("comedy")) return "أقدر أبحث لك عن أعمال كوميدية من مكتبة TMDB.";
  if(x.includes("مسلسل")||x.includes("series")) return "اكتب اسم المسلسل أو جزءاً من اسمه وسأبحث عنه مباشرة.";
  if(x.includes("فيلم")||x.includes("movie")) return "اكتب اسم الفيلم أو جزءاً من اسمه وسأبحث عنه مباشرة.";
  return "اكتب اسم فيلم أو مسلسل، أو كلمة مثل أكشن، رعب، كوميديا، وسأبحث لك داخل مكتبة TMDB.";
}

export default function AIPage(){
  const [q,setQ]=useState("");
  const [answer,setAnswer]=useState("");
  const [results,setResults]=useState<Media[]>([]);
  const [loading,setLoading]=useState(false);

  const ask=async(e:any)=>{
    e.preventDefault();
    const query=q.trim();
    if(!query)return;
    setLoading(true); setResults([]); setAnswer("");
    try{
      const looksLikeName=!/^(مرحبا|هلا|السلام|اكشن|رعب|كوميديا|دراما|فيلم|مسلسل|ساعدني|اقتراح)$/i.test(query);
      if(looksLikeName){
        const data=await searchMedia(query);
        const found=(data.results||[]).filter((x:any)=>x.media_type==="movie"||x.media_type==="tv").slice(0,8);
        setResults(found);
        setAnswer(found.length?"لقيت "+found.length+" نتائج مرتبطة بـ «"+query+"». اختار العمل حتى تفتح صفحته.":"ما لكيت نتيجة مطابقة. جرّب الاسم بالعربي أو الإنكليزي.");
      }else{
        setAnswer(localAnswer(query));
        if(/اكشن|رعب|كوميديا/i.test(query)){
          const data=await searchMedia(query);
          setResults((data.results||[]).filter((x:any)=>x.media_type==="movie"||x.media_type==="tv").slice(0,8));
        }
      }
    }catch(err:any){setAnswer("تعذر الاتصال بمكتبة الأفلام حالياً. تأكد من إعداد TMDB API في Vercel.");}
    finally{setLoading(false);}
  };

  return <section className="page">
    <span className="pill">SMART ASSISTANT</span>
    <h2>مساعد THE FINAL</h2>
    <p className="hint">ابحث باسم فيلم أو مسلسل، أو اسأل عن نوع معيّن. المساعد مرتبط بمكتبة TMDB داخل التطبيق.</p>
    <form className="search" onSubmit={ask}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="مثلاً: The Last of Us أو فيلم رعب…" />
      <button className="primary" disabled={loading}>{loading?"جاري البحث…":"اسأل"}</button>
    </form>
    {answer&&<article className="admin-grid"><div><h3>المساعد</h3><p>{answer}</p></div></article>}
    {results.length>0&&<div className="media-grid" style={{marginTop:18}}>{results.map(item=>{
      const type=item.media_type==="tv"||item.name?"series":"movie";
      return <Link className="card" key={type+item.id} to={"/"+type+"/"+item.id}>
        <div className="poster">{item.poster_path?<img src={img(item.poster_path)} alt={item.title||item.name||""}/>:<div className="no-poster">NO POSTER</div>}</div>
        <b>{item.title||item.name}</b>
        <small>★ {(item.vote_average||0).toFixed(1)}</small>
      </Link>;
    })}</div>}
  </section>
}