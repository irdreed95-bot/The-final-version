import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {supabase} from "../lib/supabase";

const labels:any={pending:"قيد المراجعة",approved:"مقبول",rejected:"مرفوض",in_progress:"قيد التنفيذ",completed:"مكتمل"};

export default function RequestsPage(){
  const [rows,setRows]=useState<any[]>([]),[type,setType]=useState(""),[message,setMessage]=useState(""),[msg,setMsg]=useState(""),[loading,setLoading]=useState(true);
  const load=async()=>{if(!supabase){setLoading(false);return}const {data:{user}}=await supabase.auth.getUser();if(!user){setRows([]);setLoading(false);return}const {data,error}=await supabase.from("project_requests").select("*").eq("user_id",user.id).order("created_at",{ascending:false});if(error)setMsg("تعذر تحميل الطلبات حالياً");setRows(data||[]);setLoading(false)};
  useEffect(()=>{load()},[]);
  const send=async(e:any)=>{e.preventDefault();setMsg("");if(!supabase){setMsg("Supabase غير مهيأ");return}const {data:{user}}=await supabase.auth.getUser();if(!user){setMsg("سجّل الدخول أولاً");return}if(!type.trim()||!message.trim()){setMsg("اكتب نوع الطلب والتفاصيل أولاً");return}const {error}=await supabase.from("project_requests").insert({user_id:user.id,project_type:type.trim(),message:message.trim(),status:"pending"});if(error){setMsg(error.message);return}setType("");setMessage("");setMsg("تم إرسال الطلب بنجاح");load()};
  return <section className="page"><span className="pill">REQUESTS</span><h2>طلباتي</h2><p className="hint">تابع حالة كل طلب أرسلته من هنا.</p>
    <form className="request-form" onSubmit={send}><input value={type} onChange={e=>setType(e.target.value)} placeholder="نوع الطلب / اسم المشروع"/><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب تفاصيل طلبك…" rows={5}/><button className="primary">إرسال طلب</button></form>
    {msg&&<p className="hint">{msg}</p>}
    {loading?<div className="loading">جاري تحميل طلباتك…</div>:!rows.length?<div className="empty-state">لا توجد طلبات حتى الآن.<Link className="primary" to="/requests">إرسال أول طلب</Link></div>:<div className="request-list">{rows.map(r=><article key={r.id}><div className="request-head"><b>{r.project_type||"طلب مشروع"}</b><span className={"status-"+r.status}>{labels[r.status]||r.status}</span></div><p>{r.message}</p><small>{new Date(r.created_at).toLocaleString("ar-IQ")}</small>{r.admin_note&&<div className="admin-note">ملاحظة الإدارة: {r.admin_note}</div>}</article>)}</div>}
  </section>
}