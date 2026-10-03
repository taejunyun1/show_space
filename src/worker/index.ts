import {handleShareRequest,type ShareEnv} from './shareApi';
import {handleProjectRequest,type ProjectEnv} from './projectApi';

export default {
  async fetch(request:Request,env:ShareEnv&ProjectEnv):Promise<Response>{
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/auth/')||path==='/api/projects'||path.startsWith('/api/projects/'))return handleProjectRequest(request,env);
    if(new URL(request.url).pathname.startsWith('/api/'))return handleShareRequest(request,env);
    if(!env.ASSETS)return new Response('Static assets unavailable',{status:503});
    return env.ASSETS.fetch(request);
  }
};
