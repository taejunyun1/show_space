/** Local synthetic verifier only. Never imported by the production Worker. */
import {handleShareRequest,type ShareEnv} from './shareApi';
import type {AuthFetch} from './auth';
const users:Record<string,string>={'Bearer account-a':'11111111-1111-4111-8111-111111111111','Bearer account-b':'22222222-2222-4222-8222-222222222222'};
const authFetch:AuthFetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url!=='https://testing.supabase.co/auth/v1/user')throw new Error('Unexpected synthetic auth request');
 const id=users[new Headers(init?.headers).get('authorization')??''];return id?Response.json({id,email:'synthetic@example.test',role:'authenticated',aud:'authenticated',is_anonymous:false,created_at:'2026-10-07T00:00:00Z'}):Response.json({message:'invalid JWT'},{status:401});
};
export default {fetch(request:Request,env:ShareEnv&{LOCAL_ACCOUNT_SHARE_FIXTURE?:string}){
 if(env.LOCAL_ACCOUNT_SHARE_FIXTURE!=='1'||!['localhost','127.0.0.1'].includes(new URL(request.url).hostname))return new Response('Local synthetic fixture only',{status:403});
 return handleShareRequest(request,{...env,SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_only_public_test_key'},authFetch);
}};
