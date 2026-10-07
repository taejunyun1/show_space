import {expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createDemoProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {projectVersionChanges} from '../domain/projectHistory';
import {exportProjectPackage} from './projectPackage';
import {createProjectHistory} from './projectHistory';
import {createProjectLibrary,ProjectConflictError} from './projectLibrary';
import {restoreProjectVersion,compareProjectHistory} from './projectHistoryActions';
import type {Project} from '../domain/types';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
function fixture(){let p=createDemoProject();p.artworks=p.artworks.slice(0,1);p.artworks[0].imageUrl=png;p.artworks[0].description='공개 작품 설명';p.note='PRIVATE 현장 메모';p.walls[0].material={...materialPreset('wood').material,normal:{imageUrl:png,widthMm:500,heightMm:250,strength:2}};p=appendSceneSnapshot(p,p,'원래 배치');return p;}
const pack=(p:Project)=>exportProjectPackage(p,async()=>png);

it('persists a complete immutable point across connections including notes, artwork and Scene normal maps',async()=>{
 const factory=new IDBFactory(),a=createProjectHistory(factory),b=createProjectHistory(factory),p=fixture(),original=structuredClone(p),point=await a.add(p.id,'설치 전',7,await pack(p));p.note='이후 수정';p.walls[0].material!.normal!.strength=0;
 expect((await b.read(p.id,point.id)).project).toEqual(original);expect(await b.list(p.id)).toEqual([point]);expect(point).toMatchObject({walls:4,artworks:1,scenes:1,sourceRevision:7});expect(point).not.toHaveProperty('project');
 expect((await b.backup(p.id,point.id)).size).toBe(point.bytes);
});
it('deduplicates identical full documents and frees bytes only after the last reference is removed',async()=>{
 const h=createProjectHistory(new IDBFactory()),p=fixture(),a=await h.add(p.id,'하나',1,await pack(p)),used=await h.usage(),b=await h.add(p.id,'둘',2,await pack(p));expect(b.contentHash).toBe(a.contentHash);expect(await h.usage()).toBe(used);
 await h.archive(p.id,a.id,true);expect((await h.list(p.id)).find(x=>x.id===a.id)!.archived).toBe(true);await h.archive(p.id,a.id,false);await h.remove(p.id,a.id);expect(await h.usage()).toBe(used);expect((await h.read(p.id,b.id)).project).toEqual(p);await h.remove(p.id,b.id);expect(await h.usage()).toBe(0);expect(await h.list(p.id)).toEqual([]);
});
it('isolates projects and rejects invalid labels, identity and revisions before mutation',async()=>{
 const h=createProjectHistory(new IDBFactory()),p=fixture(),blob=await pack(p);await expect(h.add('other','잘못된 프로젝트',1,blob)).rejects.toThrow('프로젝트가 다릅니다');for(const label of ['', 'x'.repeat(201)])await expect(h.add(p.id,label,1,blob)).rejects.toThrow('이름');await expect(h.add(p.id,'정상',0,blob)).rejects.toThrow('저장된');expect(await h.list(p.id)).toHaveLength(0);
 const point=await h.add(p.id,'정상',1,blob);await expect(h.read('other',point.id)).rejects.toThrow('이 프로젝트');await expect(h.remove('other',point.id)).rejects.toThrow();expect(await h.list(p.id)).toHaveLength(1);
});
it('enforces concurrent point limits atomically and keeps the existing archive on quota failures',async()=>{
 const factory=new IDBFactory(),a=createProjectHistory(factory,'limit',{bytes:200000,points:1}),b=createProjectHistory(factory,'limit',{bytes:200000,points:1}),p=fixture(),blob=await pack(p);
 const results=await Promise.allSettled([a.add(p.id,'A',1,blob),b.add(p.id,'B',1,blob)]);expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(await a.list(p.id)).toHaveLength(1);expect(await a.usage()).toBe(blob.size);
 const tiny=createProjectHistory(new IDBFactory(),'tiny',{bytes:1,points:50});await expect(tiny.add(p.id,'한도',1,blob)).rejects.toThrow('저장 한도');expect(await tiny.usage()).toBe(0);expect(await tiny.list(p.id)).toHaveLength(0);
});
it('rolls back archive, summary and usage together when a write fails',async()=>{
 const h=createProjectHistory(new IDBFactory()),p=fixture(),blob=await pack(p),add=IDBObjectStore.prototype.add,spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,value,key){if(this.name==='points')throw new DOMException('full','QuotaExceededError');return add.call(this,value,key);});
 try{await expect(h.add(p.id,'실패',1,blob)).rejects.toThrow('full');}finally{spy.mockRestore();}expect(await h.list(p.id)).toHaveLength(0);expect(await h.usage()).toBe(0);await h.add(p.id,'재시도',1,blob);expect(await h.usage()).toBe(blob.size);
});
it('detects damaged archive bytes instead of returning a partial restored project',async()=>{
 const f=new IDBFactory(),h=createProjectHistory(f,'corrupt'),p=fixture(),point=await h.add(p.id,'정상',1,await pack(p));const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=f.open('corrupt',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('archives','readwrite'),store=tx.objectStore('archives'),r=store.get(point.contentHash);r.onsuccess=()=>{const archive=r.result;new Uint8Array(archive.data)[0]^=255;store.put(archive);};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();await expect(h.read(p.id,point.id)).rejects.toThrow('손상');await expect(h.backup(p.id,point.id)).rejects.toThrow('손상');
});
it('restores only the acknowledged revision and keeps a durable copy of the pre-restore document',async()=>{
 const f=new IDBFactory(),history=createProjectHistory(f),projects=createProjectLibrary(f),p=fixture();await projects.save(p,0,true);const point=await history.add(p.id,'이전 배치',1,await pack(p)),later={...p,name:'수정한 전시',note:'최근 메모'};await projects.save(later,1,true);
 const save=vi.fn(async(value:Project,revision:number)=>{await projects.save(value,revision,true);return value;}),deps={history,readCurrent:(id:string)=>projects.read(id),saveCurrent:save,pack,verify:async()=>{}};
 await expect(restoreProjectVersion(p.id,point.id,1,deps)).rejects.toBeInstanceOf(ProjectConflictError);expect(save).not.toHaveBeenCalled();expect(await history.list(p.id)).toHaveLength(1);
 expect(await restoreProjectVersion(p.id,point.id,2,deps)).toEqual(p);expect((await projects.read(p.id))!.summary.revision).toBe(3);const rescue=(await history.list(p.id)).find(x=>x.label.startsWith('복원 전'))!;expect((await history.read(p.id,rescue.id)).project).toEqual(later);
});
it('does not replace current work if the safety point cannot be saved or an image cannot be verified',async()=>{
 const f=new IDBFactory(),history=createProjectHistory(f,'one',{bytes:200000,points:1}),projects=createProjectLibrary(f),p=fixture();await projects.save(p,0,true);const point=await history.add(p.id,'전',1,await pack(p));await projects.save({...p,note:'현재'},1,true);
 const save=vi.fn(async()=>p),deps={history,readCurrent:(id:string)=>projects.read(id),saveCurrent:save,pack,verify:async()=>{}};await expect(restoreProjectVersion(p.id,point.id,2,deps)).rejects.toThrow('버전은');expect(save).not.toHaveBeenCalled();expect((await projects.read(p.id))!.project.note).toBe('현재');
 await expect(restoreProjectVersion(p.id,point.id,2,{...deps,verify:async()=>{throw new Error('broken image');}})).rejects.toThrow('broken image');expect(await history.list(p.id)).toHaveLength(1);
});
it('does not overwrite another tab even if it changes the project during safety backup generation',async()=>{
 const f=new IDBFactory(),history=createProjectHistory(f),projects=createProjectLibrary(f),p=fixture();await projects.save(p,0,true);const point=await history.add(p.id,'전',1,await pack(p));
 const deps={history,readCurrent:(id:string)=>projects.read(id),saveCurrent:async(value:Project,revision:number)=>{await projects.save(value,revision,true);return value;},verify:async()=>{},pack:async(value:Project)=>{await projects.save({...value,note:'다른 탭 변경'},1);return pack(value);}};
 await expect(restoreProjectVersion(p.id,point.id,1,deps)).rejects.toBeInstanceOf(ProjectConflictError);expect((await projects.read(p.id))!.project.note).toBe('다른 탭 변경');expect((await history.list(p.id)).some(x=>x.label.startsWith('복원 전'))).toBe(true);
});
it('compares same-count geometry, normal strength, notes and saved Scenes without mutating either version',()=>{
 const p=fixture(),next=structuredClone(p);next.walls[0].start.x+=10;next.walls[0].material!.normal!.strength=0;next.note='다른 메모';next.scenes[0].name='다른 Scene';const original=structuredClone(next);expect(projectVersionChanges(next,p)).toEqual(expect.arrayContaining(['벽','프로젝트 메모','Scene']));expect(projectVersionChanges(p,p)).toEqual([]);expect(next).toEqual(original);
});

it('compares bundled sample artwork and Scene images by their embedded content, avoiding false file-path changes',async()=>{const p=createDemoProject(),restored=await (await import('./projectPackage')).importProjectPackage(await (await pack(p)).arrayBuffer());expect(await compareProjectHistory(p,restored,pack)).toEqual([]);const next=structuredClone(p);next.walls[0].heightMm+=100;expect(await compareProjectHistory(next,restored,pack)).toEqual(['벽']);});
