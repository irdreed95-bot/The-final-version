import {useEffect,useState} from "react";
import {Routes,Route,Link} from "react-router-dom";
import {Home as HomeIcon,Search,MessageCircle,User,Settings,LogIn,Sparkles,ClipboardList} from "lucide-react";
import {supabase} from "./lib/supabase";
import Home from "./pages/Home"; import SearchPage from "./pages/SearchPage"; import ChatPage from "./pages/ChatPage"; import ProfilePage from "./pages/ProfilePage"; import AdminPage from "./pages/AdminPage"; import AuthPage from "./pages/AuthPage"; import DetailsPage from "./pages/DetailsPage"; import RequestsPage from "./pages/RequestsPage"; import AIPage from "./pages/AIPage";

const baseNav=[["/","الرئيسية",HomeIcon],["/search","بحث",Search],["/chat","الدردشة",MessageCircle],["/requests","طلباتي",ClipboardList],["/ai","AI",Sparkles],["/profile","حسابي",User]] as const;
const ADMIN_EMAIL="draeddraed75@gmail.com";

export default function App(){
  const [isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>setIsAdmin((data.user?.email||"").toLowerCase()===ADMIN_EMAIL));
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>setIsAdmin((session?.user?.email||"").toLowerCase()===ADMIN_EMAIL));
    return()=>data.subscription.unsubscribe();
  },[]);
  const nav=isAdmin?[...baseNav,["/admin","الإدارة",Settings] as const]:baseNav;
  return <div className="app" dir="rtl"><header><Link to="/" className="logo">THE FINAL <span>VERSION</span></Link><nav>{nav.map(([p,t,I])=><Link key={p} to={p}><I size={17}/><span>{t}</span></Link>)}</nav><Link className="login-mini" to="/auth"><LogIn size={16}/> دخول</Link></header><main><Routes><Route path="/" element={<Home/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/chat" element={<ChatPage/>}/><Route path="/requests" element={<RequestsPage/>}/><Route path="/ai" element={<AIPage/>}/><Route path="/profile" element={<ProfilePage/>}/><Route path="/auth" element={<AuthPage/>}/><Route path="/movie/:id" element={<DetailsPage kind="movie"/>}/><Route path="/series/:id" element={<DetailsPage kind="series"/>}/><Route path="/admin" element={<AdminPage/>}/><Route path="*" element={<Home/>}/></Routes></main><footer>THE FINAL VERSION · منصة مشاهدة حديثة</footer></div>
}