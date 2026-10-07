import {uuidPattern} from '../domain/cloudProject';
import {parseReviewPage,reviewId,type ReviewAnchor,type ReviewMutation,type ReviewPage} from '../domain/reviewComments';
export class ReviewClientError extends Error {constructor(message:string,public status:number){super(message);}}
export interface ReviewDraft {id:string;postId:string;name:string;text:string;anchor:Pick<ReviewAnchor,'kind'|'sceneId'|'id'|'point'>}
export function createReviewClient(shareId:string,token?:string,fetcher:(url:string,init?:RequestInit)=>Promise<Response>=fetch,signal?:AbortSignal,scope:'public'|'project'='public'){
 if(!(scope==='project'?uuidPattern.test(shareId):/^[0-9a-f]{48}$/.test(shareId)))throw new Error('공유 링크 주소가 올바르지 않습니다.');const path=scope==='project'?`/api/projects/${shareId}/comments`:`/api/public/${shareId}/comments`;
 async function request(url:string,init:RequestInit={}):Promise<ReviewPage|null>{const r=await fetcher(url,{...init,cache:'no-store',signal,headers:{...(token?{authorization:'Bearer '+token}:{}),...(init.body?{'content-type':'application/json'}:{}),...init.headers}});if(!r.ok){let message=`댓글 요청에 실패했습니다 (${r.status}).`;try{const body=await r.json();if(typeof body.error==='string')message=body.error;}catch{/* Keep status. */}throw new ReviewClientError(message,r.status);}if(r.status===204)return null;return parseReviewPage(await r.json());}
 const written=(page:ReviewPage|null,id:string)=>{if(!page?.enabled||page.items.length!==1||page.items[0].id!==id)throw new ReviewClientError('댓글 저장 응답이 올바르지 않습니다. 입력을 유지하고 새로고침해 주세요.',503);return page;};
 return {
  async list(before?:string){if(before&&!/^[1-9]\d{0,15}$/.test(before))throw new Error('댓글 목록 위치가 올바르지 않습니다.');const page=await request(path+(before?'?before='+before:''));if(!page)throw new ReviewClientError('댓글 목록 응답이 올바르지 않습니다.',503);return page;},
  async create(draft:ReviewDraft){reviewId(draft.id);reviewId(draft.postId);return written(await request(path,{method:'POST',body:JSON.stringify(draft)}),draft.id);},
  async change(id:string,expectedRevision:number,change:ReviewMutation){reviewId(id);const page=await request(path+'/'+id,{method:'PATCH',body:JSON.stringify({...change,expectedRevision})});if(change.action==='deleteThread'){if(page!==null)throw new ReviewClientError('삭제 결과를 확인하지 못했습니다.',503);return null;}return written(page,id);},
 };
}
