import {expect,it,vi} from 'vitest';
import {commentFixture} from '../worker/commentApi.fixture';
import {createReviewClient} from './reviewClient';
import {publishPublicShare} from './shareClient';
import {createDemoProject} from '../domain/model';
it('round trips real API/SQLite records through author and public clients without Project Note or layout mutation',async()=>{
 const f=commentFixture();try{const {id}=await f.publish(),b=createReviewClient(id,'account-b',f.bridge),c=createReviewClient(id,'account-c',f.bridge),publicClient=createReviewClient(id,undefined,f.bridge),draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'검토자',text:'의견',anchor:{kind:'wall' as const,id:'wall-a',sceneId:null}},created=await b.create(draft);
  expect(created.items[0].anchor.label).toBe('벽 A');expect(created.items[0].posts[0].mine).toBe(true);const reply={action:'reply' as const,id:crypto.randomUUID(),name:'참여자',text:'답글'};const response=await c.change(draft.id,1,reply);expect(response!.items[0].posts).toHaveLength(2);expect((await publicClient.list()).items[0].posts.every(p=>!p.mine)).toBe(true);
  await expect(b.change(draft.id,1,{action:'resolve',resolved:true})).rejects.toMatchObject({status:409});expect((await b.change(draft.id,2,{action:'resolve',resolved:true}))!.items[0].resolved).toBe(true);expect(await b.change(draft.id,3,{action:'deleteThread'})).toBeNull();expect((await b.list()).items).toEqual([]);
 }finally{f.close();}
});
it('opts in through a separate author header and leaves default view-only publications unchanged',async()=>{
 const p=createDemoProject();p.artworks=[];for(const allowComments of [false,true]){let header:string|null=null;const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{if(url==='/api/shares')return Response.json({id:'a'.repeat(48)},{status:201});header=new Headers(init?.headers).get('x-review-comments');expect(JSON.stringify(JSON.parse(String(init?.body)))).not.toContain('commentsEnabled');return Response.json({id:'a'.repeat(48)},{status:201});});await publishPublicShare(p,{includeDimensions:false,allowComments},'test-token',undefined,fetcher,'https://example.test');expect(header).toBe(allowComments?'true':null);}
});
it('forwards AbortSignal, bounds IDs and rejects wrong or malformed write acknowledgments',async()=>{
 const c=new AbortController(),fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{expect(init?.signal).toBe(c.signal);return Response.json({enabled:false});}),client=createReviewClient('a'.repeat(48),'token',fetcher,c.signal),draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'a',text:'b',anchor:{kind:'project' as const,sceneId:null}};
 await expect(client.create(draft)).rejects.toMatchObject({status:503});expect(()=>createReviewClient('invalid')).toThrow();await expect(client.list('invalid')).rejects.toThrow();await expect(client.change('bad',1,{action:'deleteThread'})).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
});
