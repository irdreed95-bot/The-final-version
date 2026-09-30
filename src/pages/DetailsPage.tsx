import {useEffect,useMemo,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {img,movie,series,watchProviders,getSeriesAvailability,type SeriesAvailabilityReport} from "../lib/tmdb";
import VideoPlayer from "../components/VideoPlayer";

function seasonStateLabel(state:SeriesAvailabilityReport["seasons"][number]["state"]){
  if(state==="available")return"مكتمل";
  if(state==="partial")return"غير مكتمل";
  if(state==="declared-empty")return"معلن ولم تُرفع حلقاته";
  if(state==="empty")return"بدون حلقات";
  if(state==="missing")return"الموسم مفقود من بيانات TMDB";
  return"تعذر جلب بيانات الموسم";
}

export default function DetailsPage({kind}:{kind:"movie"|"series"}){
  const {id}=useParams();
  const [data,setData]=useState<any>();
  const [sn,setSn]=useState(1);
  const [episode,setEpisode]=useState(1);
  const [providers,setProviders]=useState<any>(null);
  const [availability,setAvailability]=useState<SeriesAvailabilityReport|null>(null);
  const [checkingAvailability,setCheckingAvailability]=useState(kind==="series");

  useEffect(()=>{
    let alive=true;
    if(!id)return;
    if(kind==="movie"){
      movie(+id).then(value=>{if(alive)setData(value)}).catch(()=>{if(alive)setData(null)});
    }else{
      setCheckingAvailability(true);
      series(+id)
        .then(async value=>{
          if(!alive)return;
          setData(value);
          const report=await getSeriesAvailability(+id,value);
          if(!alive)return;
          setAvailability(report);
          const firstSeason=report.seasons.find(s=>s.seasonNumber>0)||report.seasons[0];
          if(firstSeason){
            setSn(firstSeason.seasonNumber);
            const firstEpisode=firstSeason.episodes[0];
            setEpisode(firstEpisode?.episode||1);
          }
          setCheckingAvailability(false);
        })
        .catch(()=>{if(alive){setData(null);setAvailability(null);setCheckingAvailability(false)}});
    }
    return()=>{alive=false};
  },[id,kind]);

  useEffect(()=>{
    if(id){
      watchProviders(+id,kind==="series"?"tv":"movie")
        .then(x=>setProviders(x.results?.IQ||x.results?.AE||x.results?.US||null))
        .catch(()=>setProviders(null));
    }
  },[id,kind]);

  const currentSeason=useMemo(
    ()=>availability?.seasons.find(s=>s.seasonNumber===sn)||null,
    [availability,sn],
  );
  const selectedEpisode=useMemo(
    ()=>currentSeason?.episodes.find(e=>e.episode===episode)||null,
    [currentSeason,episode],
  );

  if(!data)return <div className="loading">جاري تحميل التفاصيل…</div>;

  const title=data.title||data.name;
  const cast=(data.credits?.cast||[]).slice(0,10);
  const mainSeasons=(availability?.seasons||[]).filter(s=>!s.isSpecials);
  const specialSeason=(availability?.seasons||[]).find(s=>s.isSpecials);
  const displaySeasons=[...mainSeasons,...(specialSeason?[specialSeason]:[])];
  const overallCoverage=availability?.coverage==null?null:Math.round(availability.coverage*100);

  return <div className="details">
    <div className="backdrop" style={{backgroundImage:"linear-gradient(180deg,#08090c00,#08090c),url("+(data.backdrop_path?"https://image.tmdb.org/t/p/original"+data.backdrop_path:"")+")"}}/>
    <div className="detail-body"><img className="detail-poster" src={img(data.poster_path,"w500")}/><div><span className="pill">{kind==="movie"?"فيلم":"مسلسل"}</span><h2>{title}</h2><p>{data.overview||"لا توجد قصة مترجمة حالياً."}</p><div className="meta">★ {(data.vote_average||0).toFixed(1)} · {data.release_date||data.first_air_date||"—"}</div></div></div>

    {kind==="series"&&<section className="episodes">
      <div className="section-head">
        <div>
          <h3>المواسم والحلقات</h3>
          {checkingAvailability
            ? <p className="hint">جاري فحص كل موسم وكل حلقة بشكل مستقل…</p>
            : availability
              ? <p className="hint">التوفر المباشر: {overallCoverage==null?"غير محسوب":overallCoverage+"%"} · المتاح {availability.availableEpisodes} من {availability.checkedEpisodes} حلقة تم التحقق منها · المواسم الأساسية {availability.mainCoverage==null?"—":Math.round(availability.mainCoverage*100)+"%"} · الـSpecials {availability.specialCoverage==null?"—":Math.round(availability.specialCoverage*100)+"%"}</p>
              : <p className="hint">تعذر بناء تقرير توفر الحلقات.</p>}
        </div>
        <select
          value={sn}
          onChange={e=>{
            const next=Number(e.target.value);
            setSn(next);
            const nextSeason=availability?.seasons.find(s=>s.seasonNumber===next);
            setEpisode(nextSeason?.episodes[0]?.episode||1);
          }}
          disabled={checkingAvailability||displaySeasons.length===0}
        >
          {displaySeasons.map(s=><option key={s.seasonNumber} value={s.seasonNumber}>
            {s.name} · {s.availableEpisodeCount}/{s.checkedEpisodeCount} · {seasonStateLabel(s.state)}
          </option>)}
        </select>
      </div>

      {checkingAvailability
        ? <div className="loading">جاري تحميل جميع المواسم والحلقات والتحقق من مصادر التشغيل…</div>
        : currentSeason
          ? <div>
              <div className="meta">
                {currentSeason.isSpecials?"Specials / الموسم 0":"الموسم "+currentSeason.seasonNumber}
                {" · "}{seasonStateLabel(currentSeason.state)}
                {" · "}{currentSeason.coverage==null?"نسبة التوفر غير محسوبة":Math.round(currentSeason.coverage*100)+"% متاح"}
              </div>
              {currentSeason.declaredEpisodeCount>currentSeason.fetchedEpisodeCount&&<p className="hint">
                TMDB يعلن {currentSeason.declaredEpisodeCount} حلقة، لكن بيانات {currentSeason.fetchedEpisodeCount} فقط وصلت حالياً؛ الحلقات غير المُرجعة لا تُحسب كغير متاحة حتى لا نعطي نسبة مضللة.
              </p>}
              {currentSeason.episodes.length===0
                ? <div className="empty-state">
                    {currentSeason.state==="declared-empty"
                      ?"الموسم معلن لكنه لا يحتوي حلقات مرفوعة/مرجعة بعد."
                      :currentSeason.state==="unknown"
                        ?"تعذر جلب حلقات هذا الموسم من TMDB حالياً."
                        :currentSeason.state==="missing"
                          ?"هذا رقم الموسم مفقود من بيانات TMDB ولا توجد حلقات يمكن فحصها."
                          :"هذا الموسم لا يحتوي حلقات."}
                  </div>
                : <div className="episode-grid">
                    {currentSeason.episodes.map((e:any,i:number)=><article key={currentSeason.seasonNumber+":"+e.episode+":"+i} className={episode===e.episode?"selected-episode":""}>
                      <div>
                        <b>{e.episode}. {e.name||("الحلقة "+e.episode)}</b>
                        <p>{e.available===true?"متاح للتشغيل المباشر":e.available===false?"غير متاح حالياً من المصادر المهيأة":"لم يكتمل التحقق من هذه الحلقة"}</p>
                      </div>
                      <button
                        disabled={e.available!==true}
                        onClick={()=>{
                          setEpisode(e.episode);
                          document.getElementById("watch")?.scrollIntoView({behavior:"smooth"});
                        }}
                      >{e.available?"مشاهدة":"غير متاح"}</button>
                    </article>)}
                  </div>}
            </div>
          : <div className="empty-state">لا توجد مواسم أو حلقات يمكن فحصها حالياً.</div>}
    </section>}

    <section className="cast"><h3>طاقم العمل</h3><div className="cast-grid">{cast.map((c:any)=><div key={c.id}><img src={img(c.profile_path,"w185")} alt={c.name}/><b>{c.name}</b><small>{c.character}</small></div>)}</div></section>

    <section className="watch-options"><h3>طرق المشاهدة الرسمية</h3><p className="hint">إذا كان العنوان متاحاً عبر خدمة بث أو شراء رسمية في منطقتك، ستظهر هنا.</p>{providers?.link&&<a className="primary" href={providers.link} target="_blank" rel="noreferrer">عرض خيارات المشاهدة</a>}{providers?.flatrate?.length>0&&<div className="provider-list">{providers.flatrate.map((p:any)=><span key={p.provider_id}>{p.provider_name}</span>)}</div>}</section>

    <section id="watch" className="watch">
      <h3>المشغل</h3>
      {kind==="movie"
        ? <VideoPlayer tmdbId={Number(id)} type="movie" poster={img(data.backdrop_path,"w1280")} title={title}/>
        : checkingAvailability
          ? <div className="loading">جاري التحقق الشامل من المواسم والحلقات…</div>
          : selectedEpisode?.available
            ? <VideoPlayer tmdbId={Number(id)} type="tv" season={sn} episode={episode} poster={img(data.backdrop_path,"w1280")} title={title}/>
            : <div className="empty-state">هذه الحلقة غير متاحة للتشغيل حالياً من المصادر المهيأة.</div>}
      <p className="hint">التقرير يعتمد على فحص مستقل لكل حلقة مرجعة من TMDB، ثم مطابقة الموسم/الحلقة مع المصادر المباشرة المصرح بها. لا يتم اعتبار الحلقة الأولى ممثلةً للموسم.</p>
    </section>

    <Link className="back" to="/">← العودة</Link>
  </div>
}