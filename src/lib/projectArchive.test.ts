import {expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createProjectLibrary} from './projectLibrary';
import {readLocalArchiveProject,readCloudArchiveProject,saveArchiveCopy} from './projectArchive';
import {createCloudProjectClient,cloudPackageHash} from './cloudProjectClient';
import {exportProjectPackage} from './projectPackage';
import {createDemoProject} from '../domain/model';
import {copyProject} from '../domain/projects';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {materialPreset} from '../domain/materials';
import {newLight} from '../domain/lighting';
import {presentationLayout} from '../domain/presentation';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
function fixture(){let p=createDemoProject();p.artworks=p.artworks.map(a=>({...a,imageUrl:png}));p.note='비공개 아카이브 메모';p.noteDetails={checklist:[{id:'print',text:'출력 확인',done:true}],images:[{id:'photo',name:'현장.png',imageUrl:png}]};p.floorMaterial=materialPreset('wood').material;p.walls[0].material=materialPreset('concrete').material;p.lights=[newLight(p,'spot')];p=appendSceneSnapshot(p,p,'지난 전시',{position:[8,8,8],target:[0,1,0],zoom:1});return p;}
it('reads archived full records without activation and stages a complete reusable copy without changing the source',async()=>{
 const repo=createProjectLibrary(new IDBFactory()),p=fixture(),active=copyProject(p,'작업 중');await repo.save(p,0,true);await repo.save(active,0,true);await repo.archive(p.id,true,1);const before=await repo.read(p.id);
 const record=await readLocalArchiveProject(p.id,2,repo);expect(record.summary.archived).toBe(true);expect(await repo.activeId()).toBe(active.id);
 const saved=await saveArchiveCopy(record.project,'  재사용 전시  ',repo);expect(saved.project.id).not.toBe(p.id);expect(saved.project.name).toBe('재사용 전시');expect({...saved.project,id:p.id,name:p.name}).toEqual(p);expect(saved.summary).toMatchObject({revision:1,archived:false});expect(await repo.activeId()).toBe(active.id);expect(await repo.read(p.id)).toEqual(before);expect((await repo.read(saved.project.id))!.project).toEqual(saved.project);
 // Local archive contains private notes; detached 3D/public allowlist still excludes them.
 expect(JSON.stringify(presentationLayout(saved.project,null).snapshot)).not.toContain('비공개 아카이브 메모');
});
it('rejects stale local metadata, mismatched records and invalid names before staging any copy',async()=>{
 const repo=createProjectLibrary(new IDBFactory()),p=fixture();await repo.save(p,0,true);await expect(readLocalArchiveProject(p.id,2,repo)).rejects.toThrow('다른 탭');await expect(readLocalArchiveProject('missing',1,repo)).rejects.toThrow('찾을 수');
 const saved=(await repo.read(p.id))!;await expect(readLocalArchiveProject(p.id,1,{...repo,read:async()=>({...saved,summary:{...saved.summary,name:'잘못된 이름'}})})).rejects.toThrow('일치하지');
 await expect(saveArchiveCopy(p,' ',repo)).rejects.toThrow('1~200');await expect(saveArchiveCopy(p,'a'.repeat(201),repo)).rejects.toThrow('1~200');expect(await repo.list()).toHaveLength(1);expect(await repo.activeId()).toBe(p.id);
});
it('rolls back archive copy storage failures and never advances the active source',async()=>{
 const repo=createProjectLibrary(new IDBFactory()),p=fixture();await repo.save(p,0,true);const original=IDBObjectStore.prototype.put,spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(this.name==='summaries')throw new DOMException('저장 공간 부족','QuotaExceededError');return original.call(this,value,key);});
 try{await expect(saveArchiveCopy(p,'실패할 복사본',repo)).rejects.toThrow('저장 공간 부족');}finally{spy.mockRestore();}
 expect(await repo.list()).toHaveLength(1);expect((await repo.read(p.id))!.project).toEqual(p);expect(await repo.activeId()).toBe(p.id);
});
async function cloudFixture(){
 const p=fixture(),bytes=await (await exportProjectPackage(p,async()=>png)).arrayBuffer(),id='12345678-1234-1234-1234-123456789012';
 const summary={id,sourceProjectId:p.id,name:p.name,venue:p.venue,revision:3,bytes:bytes.byteLength,sha256:await cloudPackageHash(bytes),createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',archived:true};
 const fetcher=vi.fn(async(path:string)=>path.endsWith('/meta')?Response.json(summary):new Response(bytes,{headers:{'x-project-revision':'3','x-project-sha256':summary.sha256}}));
 return {p,id,summary,fetcher,client:createCloudProjectClient('synthetic-test-token',fetcher)};
}
it('reads an actual ZIP through the cloud client hash/revision checks and validates private media before returning',async()=>{
 const {p,id,client,summary,fetcher}=await cloudFixture(),verify=vi.fn(async()=>{}),record=await readCloudArchiveProject(client,id,3,()=>{},verify);
 expect(record.project).toEqual(p);expect(record.summary).toEqual(summary);expect(verify).toHaveBeenCalledWith(p);expect(fetcher).toHaveBeenCalledTimes(2);
 await expect(readCloudArchiveProject(client,id,2,()=>{},verify)).rejects.toThrow('다른 기기');
 await expect(readCloudArchiveProject(client,id,3,()=>{},async()=>{throw new Error('손상된 이미지');})).rejects.toThrow('손상된 이미지');
 summary.name='메타데이터 불일치';await expect(readCloudArchiveProject(client,id,3,()=>{},verify)).rejects.toThrow('일치하지');
});
it('cancels identity changes before read, after media verification and before any copy storage',async()=>{
 const {id,client,fetcher}=await cloudFixture(),error=new Error('계정 변경');await expect(readCloudArchiveProject(client,id,3,()=>{throw error;})).rejects.toThrow('계정 변경');expect(fetcher).not.toHaveBeenCalled();
 let current=true;await expect(readCloudArchiveProject(client,id,3,()=>{if(!current)throw error;},async()=>{current=false;})).rejects.toThrow('계정 변경');
 const repo=createProjectLibrary(new IDBFactory());await expect(saveArchiveCopy(fixture(),'새 전시',repo,()=>{throw error;})).rejects.toThrow('계정 변경');expect(await repo.list()).toHaveLength(0);expect(await repo.activeId()).toBeUndefined();
});
