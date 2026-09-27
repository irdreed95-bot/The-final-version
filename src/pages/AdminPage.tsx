import {useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import * as adminApi from "../lib/adminApi";
import {defaultSettings} from "../lib/adminApi";
import {supabase} from "../lib/supabase";
import {Save,Plus,Trash2,UploadCloud,Settings2,Download,Megaphone,LayoutGrid,Tv,Layers,Globe,Ticket,Share2,MessageSquare,RefreshCw,LogOut} from "lucide-react";

const tabs=[
  ["general","عام",Settings2],["update","تحديث",Download],["ads","إعلانات",Megaphone],
  ["categories","الفئات",LayoutGrid],["channels","القنوات",Tv],["streams","سيرفرات مخصصة",Layers],
  ["servers","سيرفرات التطبيق",Globe],["tickets","تذاكر الدعم",Ticket],["social","التواصل",Share2],["chat","إدارة الدردشة",MessageSquare]
] as const;

const cats=[["28","أكشن / Action"],["35","كوميديا / Comedy"],["18","دراما / Drama"],["27","رعب / Horror"],["878","خيال علمي / Sci-Fi"],["10751","عائلي / Family"],["16","أنيمي / Anime"],["10749","رومانسي / Romance"],["80","جريمة / Crime"],["99","وثائقي / Documentary"],["10752","حرب / War"],["14","فانتازيا / Fantasy"]];

export default function AdminPage(){
  const [tab,setTab]=useState<string>("general"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [settings,setSettings]=useState<any>(defaultSettings),[error,setError]=useState("");
  const [tickets,setTickets]=useState<any[]>([]),[messages,setMessages]=useState<any[]>([]),[reply,setReply]=useState<Record<string,string>>({});
  const adRef=useRef<HTMLInputElement>(null);

  const load=async()=>{setLoading(true);setError("");try{const s=await adminApi.getAdminSettings();setSettings(s)}catch(e:any){setError(e.message||"تعذر تحميل لوحة التحكم")}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);

  useEffect(()=>{if(tab==="tickets")adminApi.getTickets().then(setTickets).catch(e=>setError(e.message));if(tab==="chat")adminApi.getChatMessages().then(setMessages).catch(e=>setError(e.message))},[tab]);

  const save=async()=>{setSaving(true);setError("");try{await adminApi.saveAdminSettings(settings)}catch(e:any){setError(e.message||"فشل الحفظ")}finally{setSaving(false)}};
  const set=(patch:any)=>setSettings((s:any)=>({...s,...patch}));
  const upload=async(file:File,cb:(url:string)=>void)=>{const key=import.meta.env.VITE_IMGBB_KEY;if(!key){setError("VITE_IMGBB_KEY غير مهيأ");return}const f=new FormData();f.append("image",file);try{const r=await fetch("https://api.imgbb.com/1/upload?key="+encodeURIComponent(key),{method:"POST",body:f});const d=await r.json();if(d.success)cb(d.data.url);else throw new Error("فشل رفع الصورة")}catch(e:any){setError(e.message||"فشل رفع الصورة")}};

  if(loading)return <div className="loading">جاري قراءة بيانات لوحة التحكم من Supabase…</div>;
  if(error&&!supabase)return <section className="auth"><div><h2>لوحة التحكم</h2><p className="error">{error}</p><Link className="primary" to="/auth">تسجيل الدخول</Link></div></section>;
  return <section className="admin page">
    <div className="section-head"><div><span className="pill">REAL ADMIN WORKSPACE</span><h2>لوحة التحكم</h2><p className="hint">هذه اللوحة تقرأ وتكتب البيانات الفعلية في Supabase.</p></div><button className="profile-card" onClick={async()=>{await supabase?.auth.signOut();location.reload()}}><LogOut size={16}/> خروج</button></div>
    {error&&<div className="error" style={{marginBottom:15}}>{error}</div>}
    <div className="admin-tabs">{tabs.map(([id,label,I])=><button className={tab===id?"active":""} onClick={()=>setTab(id)} key={id}><I size={15}/>{label}</button>)}</div>

    {tab==="general"&&<Panel title="الإعدادات العامة"><Toggle label="شريط الإعلانات" value={settings.banner_enabled} onChange={(v:boolean)=>set({banner_enabled:v})}/>{settings.banner_enabled&&<input value={settings.banner_text} onChange={e=>set({banner_text:e.target.value})} placeholder="نص الشريط…"/>}<Toggle label="الإعلانات المدمجة" value={settings.ads_enabled} onChange={(v:boolean)=>set({ads_enabled:v})}/></Panel>}

    {tab==="update"&&<Panel title="نظام التحديث"><Field label="رابط تحميل APK" value={settings.apk_link} onChange={(v:string)=>set({apk_link:v})}/><Field label="رقم الإصدار" value={settings.app_version} onChange={(v:string)=>set({app_version:v})}/><label>ملاحظات الإصدار<textarea value={settings.update_notes} onChange={e=>set({update_notes:e.target.value})}/></label></Panel>}

    {tab==="ads"&&<Panel title="الإعلانات البنرية"><Toggle label="تفعيل الإعلانات" value={settings.ads_enabled} onChange={(v:boolean)=>set({ads_enabled:v})}/>{settings.ad_image&&<img className="admin-preview" src={settings.ad_image}/>}<div className="inline-form"><button className="primary" onClick={()=>adRef.current?.click()}><UploadCloud size={16}/> رفع صورة</button><input value={settings.ad_image} onChange={e=>set({ad_image:e.target.value})} placeholder="أو رابط الصورة المباشر"/></div><input ref={adRef} hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)upload(f,(url)=>set({ad_image:url}))}}/></Panel>}

    {tab==="categories"&&<Panel title="خلفيات الفئات">{cats.map(([id,name])=><div className="admin-item" key={id}><b>{name}</b><div className="inline-form"><input dir="ltr" value={settings.category_images?.[id]||""} onChange={e=>set({category_images:{...settings.category_images,[id]:e.target.value}})} placeholder="رابط صورة الفئة"/><button onClick={()=>set({category_images:{...settings.category_images,[id]:""}})}><Trash2 size={15}/></button></div></div>)}</Panel>}

    {tab==="channels"&&<Panel title="قنوات البث التلفزيوني"><button className="primary" onClick={()=>set({tv_channels:[...(settings.tv_channels||[]),{id:Date.now().toString(),name:"قناة جديدة",logo:"",url:"",category:"عام",country:""}]})}><Plus size={16}/> إضافة قناة</button>{(settings.tv_channels||[]).map((c:any,i:number)=><div className="admin-item" key={c.id}><button onClick={()=>set({tv_channels:settings.tv_channels.filter((_:any,j:number)=>j!==i)})}><Trash2 size={15}/></button><Field label="اسم القناة" value={c.name} onChange={(v:string)=>set({tv_channels:settings.tv_channels.map((x:any,j:number)=>j===i?{...x,name:v}:x)})}/><Field label="رابط M3U8" value={c.url} onChange={(v:string)=>set({tv_channels:settings.tv_channels.map((x:any,j:number)=>j===i?{...x,url:v}:x)})}/><Field label="البلد" value={c.country||""} onChange={(v:string)=>set({tv_channels:settings.tv_channels.map((x:any,j:number)=>j===i?{...x,country:v}:x)})}/><Field label="التصنيف" value={c.category||""} onChange={(v:string)=>set({tv_channels:settings.tv_channels.map((x:any,j:number)=>j===i?{...x,category:v}:x)})}/><Field label="رابط الشعار" value={c.logo||""} onChange={(v:string)=>set({tv_channels:settings.tv_channels.map((x:any,j:number)=>j===i?{...x,logo:v}:x)})}/></div>)}</Panel>}

    {tab==="streams"&&<Panel title="السيرفرات المخصصة"><button className="primary" onClick={()=>set({custom_streams:[...settings.custom_streams,{id:Date.now().toString(),tmdbId:"",type:"movie",label:"سيرفر جديد",url:"",subtitleUrl:""}]})}><Plus size={16}/> إضافة سيرفر</button>{settings.custom_streams.map((s:any,i:number)=><div className="admin-item" key={s.id}><button onClick={()=>set({custom_streams:settings.custom_streams.filter((_:any,j:number)=>j!==i)})}><Trash2 size={15}/></button><Field label="TMDB ID" value={s.tmdbId} onChange={(v:string)=>set({custom_streams:settings.custom_streams.map((x:any,j:number)=>j===i?{...x,tmdbId:v}:x)})}/><Field label="اسم السيرفر" value={s.label} onChange={(v:string)=>set({custom_streams:settings.custom_streams.map((x:any,j:number)=>j===i?{...x,label:v}:x)})}/><Field label="الرابط / IFrame" value={s.url} onChange={(v:string)=>set({custom_streams:settings.custom_streams.map((x:any,j:number)=>j===i?{...x,url:v}:x)})}/><Field label="رابط الترجمة VTT/SRT" value={s.subtitleUrl||""} onChange={(v:string)=>set({custom_streams:settings.custom_streams.map((x:any,j:number)=>j===i?{...x,subtitleUrl:v}:x)})}/></div>)}</Panel>}

    {tab==="servers"&&<Panel title="سيرفرات التطبيق D1 - D10">{Array.from({length:10}).map((_,i)=><div className="server-row" key={i}><b>D{i+1}</b><input dir="ltr" value={settings.server_urls?.[i]||""} onChange={e=>{const a=[...(settings.server_urls||[])];a[i]=e.target.value;set({server_urls:a})}} placeholder="https://..."/></div>)}</Panel>}

    {tab==="tickets"&&<Panel title="تذاكر الدعم"><button onClick={()=>adminApi.getTickets().then(setTickets)}><RefreshCw size={15}/> تحديث</button>{tickets.length===0?<div className="hint">لا توجد تذاكر حالياً.</div>:tickets.map(t=><div className="admin-item" key={t.id}><b>{t.name} · {t.email}</b><p>{t.message}</p><small>الحالة: {t.status}</small>{t.status!=="closed"&&<><textarea value={reply[t.id]||""} onChange={e=>setReply({...reply,[t.id]:e.target.value})} placeholder="اكتب الرد…"/><div className="inline-form"><button className="primary" onClick={async()=>{await adminApi.updateTicket(t.id,{status:"replied",reply:reply[t.id]||""});setTickets(await adminApi.getTickets())}}>إرسال الرد</button><button onClick={async()=>{await adminApi.updateTicket(t.id,{status:"closed"});setTickets(await adminApi.getTickets())}}>إغلاق</button></div></>}</div>)}</Panel>}

    {tab==="social"&&<Panel title="منصات التواصل">{["discord","instagram","telegram","youtube"].map((p)=><Field key={p} label={p} value={settings.social_links?.[p]||""} onChange={(v:string)=>set({social_links:{...settings.social_links,[p]:v}})}/>)}</Panel>}

    {tab==="chat"&&<Panel title="إدارة الدردشة"><button onClick={()=>adminApi.getChatMessages().then(setMessages)}><RefreshCw size={15}/> تحديث</button>{messages.length===0?<div className="hint">لا توجد رسائل.</div>:messages.map(m=><div className="admin-item" key={m.id}><b>{m.user_id}</b><p>{m.message}</p><small>{new Date(m.created_at).toLocaleString()}</small><button onClick={async()=>{await adminApi.deleteChatMessage(m.id);setMessages(messages.filter(x=>x.id!==m.id))}}><Trash2 size={15}/> حذف</button></div>)}</Panel>}

    {!["tickets","chat"].includes(tab)&&<button className="save-admin" disabled={saving} onClick={save}>{saving?<RefreshCw className="spin"/>:<Save/>}{saving?"جاري الحفظ…":"حفظ التغييرات للمستخدمين"}</button>}
  </section>
}

function Panel({title,children}:{title:string;children:any}){return <div className="admin-panel"><h3>{title}</h3>{children}</div>}
function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label>{label}<input value={value} onChange={e=>onChange(e.target.value)}/></label>}
function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}){return <div className="toggle-row"><span>{label}</span><button className={value?"toggle on":"toggle"} onClick={()=>onChange(!value)}>{value?"مفعل":"متوقف"}</button></div>}
