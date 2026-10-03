import {describe,it,expect,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createProjectLibrary,ProjectConflictError} from './projectLibrary';
import {createDemoProject} from '../domain/model';
import {copyProject,newProject} from '../domain/projects';

describe('project library with IndexedDB transactions',()=>{
 it('stores separate projects, small summaries and an active project without replacing prior work',async()=>{
  const factory=new IDBFactory(),repo=createProjectLibrary(factory),p=createDemoProject();p.note='비공개 설치';p.scenes=[{id:'scene-1',name:'배치 A',artworks:structuredClone(p.artworks),wallVisibility:{}}];
  await repo.save(p,0,true);p.name='저장 후 변경';const copy=copyProject((await repo.read(p.id))!.project);await repo.save(copy,0,true);
  expect(await repo.activeId()).toBe(copy.id);const list=await repo.list();expect(list).toHaveLength(2);expect(list[0]).not.toHaveProperty('project');expect((await repo.read('project-1'))!.project.name).toBe('여백의 기록');
  const restored=(await repo.read(copy.id))!.project;expect(restored.note).toBe('비공개 설치');expect(restored.scenes[0].artworks).toEqual(createDemoProject().artworks);restored.artworks[0].name='복사본 수정';await repo.save(restored,1);expect((await repo.read('project-1'))!.project.artworks[0].name).toBe('고요한 면');
 });
 it('rejects stale and simultaneous saves from independent tabs and allows recovery as a separate project',async()=>{
  const factory=new IDBFactory(),a=createProjectLibrary(factory),b=createProjectLibrary(factory),p=createDemoProject();await a.save(p,0,true);
  const left=(await a.read(p.id))!,right=(await b.read(p.id))!;left.project.name='탭 A 수정';right.project.name='탭 B 수정';
  const results=await Promise.allSettled([a.save(left.project,left.summary.revision),b.save(right.project,right.summary.revision)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(rejected.reason).toBeInstanceOf(ProjectConflictError);
  const latest=(await a.read(p.id))!;expect(latest.summary.revision).toBe(2);const lost=latest.project.name===left.project.name?right.project:left.project,recovery=copyProject(lost);await b.save(recovery,0,true);expect((await a.read(recovery.id))!.project.name).toBe(lost.name+' 복사본');expect((await a.read(p.id))!.project.name).toBe(latest.project.name);
  await expect(b.save(right.project,1)).rejects.toBeInstanceOf(ProjectConflictError);expect((await b.read(p.id))!.summary.revision).toBe(2);
 });
 it('archives and restores documents without deleting assets and protects the current project',async()=>{
  const repo=createProjectLibrary(new IDBFactory()),p=createDemoProject(),copy=copyProject(p);await repo.save(p,0,true);await repo.save(copy,0,true);
  await expect(repo.archive(copy.id,true,1)).rejects.toThrow('현재 프로젝트');await repo.archive(p.id,true,1);await expect(repo.activate(p.id)).rejects.toThrow('열 수 있는');expect((await repo.read(p.id))!.project).toEqual(p);await expect(repo.save(p,2)).rejects.toBeInstanceOf(ProjectConflictError);await repo.archive(p.id,false,2);await repo.activate(p.id);expect(await repo.activeId()).toBe(p.id);expect((await repo.read(p.id))!.summary.revision).toBe(3);
 });
 it('validates before mutation and keeps previous active document intact',async()=>{
  const repo=createProjectLibrary(new IDBFactory()),p=createDemoProject();await repo.save(p,0,true);await expect(repo.save({...p,walls:[]},1,true)).rejects.toThrow();expect((await repo.read(p.id))!.project).toEqual(p);expect((await repo.read(p.id))!.summary.revision).toBe(1);expect(await repo.activeId()).toBe(p.id);
 });
 it('rolls back the document and revision together when the summary write fails',async()=>{
  const repo=createProjectLibrary(new IDBFactory()),p=createDemoProject();await repo.save(p,0,true);
  const put=IDBObjectStore.prototype.put,spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(this.name==='summaries')throw new DOMException('저장 공간 부족','QuotaExceededError');return put.call(this,value,key);});
  try{await expect(repo.save({...p,name:'실패할 저장'},1,true)).rejects.toThrow('저장 공간 부족');}finally{spy.mockRestore();}
  expect((await repo.read(p.id))!.project).toEqual(p);expect((await repo.read(p.id))!.summary.revision).toBe(1);expect(await repo.activeId()).toBe(p.id);await expect(repo.save({...p,name:'재시도 성공'},1)).resolves.toEqual(expect.objectContaining({revision:2}));
 });
 it('migrates the original single draft once and resumes selected projects on reload',async()=>{
  vi.stubGlobal('indexedDB',new IDBFactory());
  try{const {set}=await import('idb-keyval'),{readDraft,writeDraft,saveNewLocalProject,openLocalProject,DRAFT_KEY}=await import('./persistence'),p=createDemoProject();p.name='기존 사용자 전시';p.note='원래 메모';await set(DRAFT_KEY,p);
   expect(await readDraft()).toEqual(p);const updated={...p,name:'기존 전시 수정'};await writeDraft(updated);const next=newProject({name:'새 전시',venue:'별관',widthMm:15000,depthMm:10000,heightMm:4500});await saveNewLocalProject(next);expect(await readDraft()).toEqual(next);expect(await openLocalProject(p.id)).toEqual(updated);expect(await readDraft()).toEqual(updated);await set(DRAFT_KEY,{...p,name:'오래된 단일 초안'});expect(await readDraft()).toEqual(updated);
  }finally{vi.unstubAllGlobals();}
 });
});
