import {expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createProjectLibrary} from './projectLibrary';
import {parseCloudPending,type CloudSavePending} from '../domain/cloudProject';
const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',cloud='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function pending():CloudSavePending{return {requestId:crypto.randomUUID(),link:{userId:userA,localProjectId:'local-project',cloudProjectId:cloud,revision:0,localRevision:1,autoSync:true},file:new Blob([new Uint8Array([80,75,3,4,...Array(26).fill(0)])]),metadata:{name:'전시',venue:'성수',sourceProjectId:'local-project'}};}
it('preserves the exact upload Blob across repository reloads and separates queues by account',async()=>{
 const factory=new IDBFactory(),a=createProjectLibrary(factory),b=createProjectLibrary(factory),job=pending();await a.saveCloudPending(job);const restored=await b.cloudPending(userA,'local-project');expect(restored?.requestId).toBe(job.requestId);expect(await restored!.file.arrayBuffer()).toEqual(await job.file.arrayBuffer());expect(await b.cloudPending(userB,'local-project')).toBeUndefined();expect(await b.cloudLink(userA,'local-project')).toBeUndefined();
 await b.saveCloudLink({...job.link,revision:1},job.requestId);expect(await a.cloudPending(userA,'local-project')).toBeUndefined();expect((await a.cloudLink(userA,'local-project'))?.revision).toBe(1);expect(await a.cloudLink(userB,'local-project')).toBeUndefined();
});
it('does not replace or clear another tab’s pending upload and retains later revisions',async()=>{
 const factory=new IDBFactory(),a=createProjectLibrary(factory),b=createProjectLibrary(factory),job=pending(),second=pending();const results=await Promise.allSettled([a.saveCloudPending(job),b.saveCloudPending(second)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const stored=(await a.cloudPending(userA,'local-project'))!;const loser=stored.requestId===job.requestId?second:job;
 await expect(b.saveCloudLink({...loser.link,revision:1},loser.requestId)).rejects.toThrow('다른 탭');expect((await b.cloudPending(userA,'local-project'))?.requestId).toBe(stored.requestId);await a.saveCloudLink({...stored.link,revision:1},stored.requestId);await expect(a.saveCloudLink({...stored.link,revision:0})).rejects.toThrow('다른 탭');expect((await a.cloudLink(userA,'local-project'))?.revision).toBe(1);
});
it('pauses queued automatic uploads without discarding their exact bytes or reverting a pause on acknowledgement',async()=>{
 const repo=createProjectLibrary(new IDBFactory()),job=pending();await repo.saveCloudPending(job);await repo.setCloudAutoSync(userA,'local-project',false);expect((await repo.cloudPending(userA,'local-project'))?.link.autoSync).toBe(false);await repo.saveCloudLink({...job.link,revision:1},job.requestId);expect((await repo.cloudLink(userA,'local-project'))?.autoSync).toBe(false);
});
it('rejects corrupt queue metadata and invalid identities before writing',async()=>{
 const repo=createProjectLibrary(new IDBFactory()),job=pending();for(const bad of [{...job,requestId:'bad'},{...job,file:new Blob(['bad'])},{...job,metadata:{...job.metadata,sourceProjectId:'wrong'}},{...job,link:{...job.link,userId:'other-account'}},{...job,blocked:'yes'}])expect(()=>parseCloudPending(bad)).toThrow();await expect(repo.saveCloudPending({...job,link:{...job.link,localRevision:-1}})).rejects.toThrow();expect(await repo.cloudPending(userA,'local-project')).toBeUndefined();
});
it('keeps a queued job when acknowledgement storage fails and supports identical retry',async()=>{
 const repo=createProjectLibrary(new IDBFactory()),job=pending();await repo.saveCloudPending(job);const put=IDBObjectStore.prototype.put,spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(String(key).startsWith('cloud-link:'))throw new DOMException('Quota exceeded','QuotaExceededError');return put.call(this,value,key);});
 try{await expect(repo.saveCloudLink({...job.link,revision:1},job.requestId)).rejects.toThrow('Quota');}finally{spy.mockRestore();}expect((await repo.cloudPending(userA,'local-project'))?.requestId).toBe(job.requestId);expect(await repo.cloudLink(userA,'local-project')).toBeUndefined();await repo.saveCloudLink({...job.link,revision:1},job.requestId);expect(await repo.cloudPending(userA,'local-project')).toBeUndefined();
});
