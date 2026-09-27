import {handleShareRequest,type ShareEnv} from './shareApi';

export default {
  async fetch(request:Request,env:ShareEnv):Promise<Response>{
    if(new URL(request.url).pathname.startsWith('/api/'))return handleShareRequest(request,env);
    if(!env.ASSETS)return new Response('Static assets unavailable',{status:503});
    return env.ASSETS.fetch(request);
  }
};
