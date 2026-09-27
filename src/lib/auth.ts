import {supabase} from "./supabase";
export async function signIn(email:string,password:string){if(!supabase) throw new Error("Supabase غير مهيأ"); const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; return data.user}
export async function signUp(email:string,password:string,name:string){if(!supabase) throw new Error("Supabase غير مهيأ"); const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name}}}); if(error) throw error; return data.user}
export async function signOut(){await supabase?.auth.signOut()}
