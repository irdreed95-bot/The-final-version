import {supabase} from "./supabase";

export type AdminSettings={
  banner_enabled:boolean; banner_text:string; ads_enabled:boolean; ad_image:string;
  apk_link:string; app_version:string; update_notes:string;
  custom_streams:Array<{id:string;tmdbId:string;type:"movie"|"tv";label:string;url:string;subtitleUrl?:string}>;
  tv_channels:Array<{id:string;name:string;logo:string;url:string;category:string;country?:string}>;
  category_images:Record<string,string>; server_urls:string[];
  social_links:{discord:string;instagram:string;telegram:string;youtube:string};
};

export const defaultSettings:AdminSettings={
  banner_enabled:false,banner_text:"",ads_enabled:false,ad_image:"",
  apk_link:"",app_version:"",update_notes:"",custom_streams:[],tv_channels:[],
  category_images:{},server_urls:[],social_links:{discord:"",instagram:"",telegram:"",youtube:""}
};

export async function requireAdmin(){
  if(!supabase) throw new Error("Supabase غير مهيأ");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("يجب تسجيل الدخول أولاً");
  const {data,error}=await supabase.from("profiles").select("is_admin").eq("id",user.id).single();
  if(error||!data?.is_admin) throw new Error("هذا الحساب ليس مديراً");
  return user;
}

export async function getAdminSettings(){
  await requireAdmin();
  const {data,error}=await supabase!.from("admin_settings").select("settings_data").eq("id",1).maybeSingle();
  if(error) throw error;
  return {...defaultSettings,...(data?.settings_data||{})} as AdminSettings;
}

export async function saveAdminSettings(settings:AdminSettings){
  await requireAdmin();
  const {error}=await supabase!.from("admin_settings").upsert({id:1,settings_data:settings,updated_at:new Date().toISOString()});
  if(error) throw error;
  return settings;
}

export async function getTickets(){
  await requireAdmin();
  const {data,error}=await supabase!.from("support_tickets").select("*").order("created_at",{ascending:false});
  if(error) throw error;
  return data||[];
}

export async function updateTicket(id:string,patch:{status?:string;reply?:string}){
  await requireAdmin();
  const {error}=await supabase!.from("support_tickets").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
  if(error) throw error;
}

export async function getChatMessages(){
  await requireAdmin();
  const {data,error}=await supabase!.from("public_chat_messages").select("*").order("created_at",{ascending:false}).limit(100);
  if(error) throw error;
  return data||[];
}

export async function deleteChatMessage(id:string){
  await requireAdmin();
  const {error}=await supabase!.from("public_chat_messages").delete().eq("id",id);
  if(error) throw error;
}
