import {createClient} from '@supabase/supabase-js';
import {parseAuthConfig} from '../domain/authConfig';
import {uuidPattern} from '../domain/cloudProject';
export interface AuthEnv {SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;SUPABASE_GOOGLE_ENABLED?:string}
export const authConfig=(env:AuthEnv,cloudEnabled=false)=>parseAuthConfig(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,env.SUPABASE_GOOGLE_ENABLED==='true',cloudEnabled);
export type AuthFetch=typeof fetch;
export async function authenticatedUser(request:Request,env:AuthEnv,fetcher:AuthFetch=fetch,requireVerifiedEmail=false):Promise<{id:string;email:string}|null>{
 const config=authConfig(env),match=/^Bearer ([^\s]+)$/.exec(request.headers.get('authorization')??'');if(!config||!match||match[1].length>8192)return null;
 const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetcher(input,{...init,signal:AbortSignal.timeout(8000)})}});
 const {data,error}=await client.auth.getUser(match[1]);if(error){if(!error.status||error.status>=500)throw new Error('인증 서비스를 연결하지 못했습니다.');return null;}
 const user=data.user;if(!user||!uuidPattern.test(user.id)||user.role!=='authenticated'||user.is_anonymous)return null;
 if(requireVerifiedEmail&&(!user.email||!user.email_confirmed_at))return null;
 return {id:user.id,email:user.email??''};
}
