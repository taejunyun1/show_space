import {beforeEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {createProjectLibrary} from './projectLibrary';
import {createDemoProject} from '../domain/model';
import {copyProject} from '../domain/projects';
import {exportProjectPackage} from './projectPackage';
import {createCloudProjectClient,cloudPackageHash} from './cloudProjectClient';
import {openEditableCloudProject} from './openCloudProject';
const mocks=vi.hoisted(()=>({repo:undefined as ReturnType<typeof createProjectLibrary>|undefined}));
vi.mock('./projectLibrary',async load=>({...await load<typeof import('./projectLibrary')>(),projectLibrary:()=>mocks.repo!}));
vi.mock('./persistence',()=>({openLocalProject:async(id:string)=>{await mocks.repo!.activate(id);return (await mocks.repo!.read(id))!.project;}}));
let repo:ReturnType<typeof createProjectLibrary>;
beforeEach(()=>{repo=createProjectLibrary(new IDBFactory());mocks.repo=repo;});
async function fixture(role='editor',downgrade=false){const p=createDemoProject();p.artworks=[];p.note='비공개 공동 메모';const bytes=await(await exportProjectPackage(p,async()=>{throw new Error('No images');})).arrayBuffer(),id=crypto.randomUUID();let reads=0;const summary={id,name:p.name,venue:p.venue,sourceProjectId:p.id,revision:2,sha256:await cloudPackageHash(bytes),bytes:bytes.byteLength,createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',archived:false,role};const client=createCloudProjectClient('test',async(path)=>path.endsWith('/meta')?Response.json({...summary,role:downgrade&&++reads>1?'viewer':role}):new Response(bytes,{headers:{'x-project-revision':'2','x-project-sha256':summary.sha256}}));return {p,id,client};}
it('opens an editor-authorized new local draft linked to the original cloud ID while preserving the active local work',async()=>{
 const f=await fixture(),current=copyProject(f.p,'현재 작업');await repo.save(current,0,true);const user=crypto.randomUUID(),opened=await openEditableCloudProject(f.client,f.id,user,()=>{});expect(opened.id).not.toBe(f.p.id);expect({...opened,id:f.p.id}).toEqual(f.p);expect((await repo.read(current.id))!.project).toEqual(current);expect(await repo.activeId()).toBe(opened.id);expect(await repo.cloudLink(user,opened.id)).toMatchObject({cloudProjectId:f.id,revision:2,autoSync:true});
});
it('rejects viewer access and permissions changed during package import before staging or activating an editable copy',async()=>{
 const first=await fixture('viewer'),current=copyProject(first.p,'현재 작업');await repo.save(current,0,true);await expect(openEditableCloudProject(first.client,first.id,crypto.randomUUID(),()=>{})).rejects.toThrow('현재 역할');const second=await fixture('editor',true);await expect(openEditableCloudProject(second.client,second.id,crypto.randomUUID(),()=>{})).rejects.toThrow('편집 권한');expect(await repo.list()).toHaveLength(1);expect(await repo.activeId()).toBe(current.id);
});
