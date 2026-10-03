import {create} from 'zustand';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseAuthConfig,type AuthConfig} from '../domain/authConfig';
interface AuthState {status:'loading'|'disabled'|'signedOut'|'signedIn'|'error';config:AuthConfig|null;user:{id:string;email:string}|null;error:string}
export const useAuth=create<AuthState>(()=>({status:'loading',config:null,user:null,error:''}));
let client:SupabaseClient|undefined,initializing:Promise<void>|undefined,unsubscribe:(()=>void)|undefined;
export function initializeAuth():Promise<void>{return initializing??=(async()=>{
 try{unsubscribe?.();unsubscribe=undefined;client=undefined;const response=await fetch('/api/auth/config',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('계정 연결 정보를 읽지 못했습니다.');const raw=await response.json();if(raw.enabled===false){useAuth.setState({status:'disabled',config:null,user:null,error:''});return;}
  const config=parseAuthConfig(raw.url,raw.publishableKey,raw.googleEnabled===true,raw.cloudEnabled===true);if(!config)throw new Error('계정 연결 설정이 올바르지 않습니다.');
  const {createClient}=await import('@supabase/supabase-js');client=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
  useAuth.setState({config});const listener=client.auth.onAuthStateChange((_event,session)=>{useAuth.setState({status:session?'signedIn':'signedOut',user:session?{id:session.user.id,email:session.user.email??''}:null,error:''});});unsubscribe=()=>listener.data.subscription.unsubscribe();
  const {data,error}=await client.auth.getSession();if(error)throw error;useAuth.setState({status:data.session?'signedIn':'signedOut',user:data.session?{id:data.session.user.id,email:data.session.user.email??''}:null});
 }catch(error){unsubscribe?.();unsubscribe=undefined;client=undefined;useAuth.setState({status:'error',config:null,user:null,error:error instanceof Error?error.message:'계정 연결을 확인하지 못했습니다.'});initializing=undefined;}
})();}
export async function authClient(){await initializeAuth();if(!client)throw new Error('계정 로그인을 아직 사용할 수 없습니다.');return client;}
export async function cloudSession(){const c=await authClient(),{data,error}=await c.auth.getSession();if(error||!data.session)throw new Error('계정 로그인이 필요합니다.');return {token:data.session.access_token,userId:data.session.user.id};}
export async function signOut(){const c=await authClient();const {error}=await c.auth.signOut({scope:'local'});if(error)throw error;useAuth.setState({status:'signedOut',user:null});}
