export interface AuthConfig {url:string;publishableKey:string;googleEnabled:boolean;cloudEnabled:boolean}
export const authReturnPath=(value:unknown)=>typeof value==='string'&&(/^\/s\/[0-9a-f]{48}$/.test(value)||/^\/join\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))?value:'/auth/callback';
/** Never serialize a secret/service-role key as browser configuration. Hosted Supabase projects only. */
export function parseAuthConfig(url:unknown,key:unknown,googleEnabled=false,cloudEnabled=false):AuthConfig|undefined{
 if(typeof url!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||typeof key!=='string')return undefined;
 let publicKey=/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(key);
 if(!publicKey&&key.length<2048){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));publicKey=key.split('.').length===3&&payload.role==='anon';}catch{/* Invalid or secret credentials leave authentication disabled. */}}
 return publicKey?{url:url.replace(/\/$/,''),publishableKey:key,googleEnabled,cloudEnabled}:undefined;
}
