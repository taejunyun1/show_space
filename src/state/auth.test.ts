import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({createClient:vi.fn(),getSession:vi.fn(),signOut:vi.fn(),unsubscribe:vi.fn(),listener:undefined as undefined|((event:string,session:unknown)=>void)}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.createClient}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();mocks.listener=undefined;mocks.getSession.mockResolvedValue({data:{session:null},error:null});mocks.signOut.mockResolvedValue({error:null});mocks.createClient.mockImplementation(()=>({auth:{getSession:mocks.getSession,signOut:mocks.signOut,onAuthStateChange:(cb:(event:string,session:unknown)=>void)=>{mocks.listener=cb;return {data:{subscription:{unsubscribe:mocks.unsubscribe}}};}}}));});
afterEach(()=>vi.unstubAllGlobals());
const enabled={enabled:true,url:'https://testing.supabase.co',publishableKey:'sb_publishable_only_public_test_key',cloudEnabled:true,googleEnabled:false};
it('does not initialize an auth provider or upload local drafts before configuration',async()=>{
 const fetcher=vi.fn(async()=>Response.json({enabled:false}));vi.stubGlobal('fetch',fetcher);const {initializeAuth,useAuth,authClient}=await import('./auth');await Promise.all([initializeAuth(),initializeAuth()]);expect(fetcher).toHaveBeenCalledTimes(1);expect(mocks.createClient).not.toHaveBeenCalled();expect(useAuth.getState().status).toBe('disabled');await expect(authClient()).rejects.toThrow('아직');
});
it('uses standard PKCE session persistence and signs out only the current device',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(enabled)));const {initializeAuth,useAuth,cloudSession,signOut}=await import('./auth');await initializeAuth();expect(mocks.createClient).toHaveBeenCalledWith(enabled.url,enabled.publishableKey,expect.objectContaining({auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}));expect(useAuth.getState().status).toBe('signedOut');
 const session={access_token:'test-token',user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test'}};mocks.listener!('SIGNED_IN',session);mocks.getSession.mockResolvedValue({data:{session},error:null});expect(await cloudSession()).toEqual({token:'test-token',userId:session.user.id});expect(useAuth.getState().user?.email).toBe('a@example.test');await signOut();expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});expect(useAuth.getState().user).toBeNull();
});
it('rejects a mistakenly configured secret and allows a failed connection to retry',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...enabled,publishableKey:'sb_secret_private'})).mockResolvedValueOnce(Response.json(enabled));vi.stubGlobal('fetch',fetcher);const {initializeAuth,useAuth}=await import('./auth');await initializeAuth();expect(useAuth.getState().status).toBe('error');expect(useAuth.getState().config).toBeNull();expect(mocks.createClient).not.toHaveBeenCalled();await initializeAuth();expect(useAuth.getState().status).toBe('signedOut');
});
it('cleans up failed SDK initialization listeners before a new attempt',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(enabled)));mocks.getSession.mockResolvedValueOnce({data:{session:null},error:new Error('session read failed')});const {initializeAuth,useAuth}=await import('./auth');await initializeAuth();expect(useAuth.getState().status).toBe('error');expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);await initializeAuth();expect(useAuth.getState().status).toBe('signedOut');expect(mocks.createClient).toHaveBeenCalledTimes(2);
});
