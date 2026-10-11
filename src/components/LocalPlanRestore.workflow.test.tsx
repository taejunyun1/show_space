// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {Blob as NodeBlob} from 'node:buffer';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {ProjectsDialog} from './ProjectsDialog';
import {PlanView} from './PlanView';
import {createDemoProject} from '../domain/model';
import {sceneProject} from '../domain/sceneProject';
import {startAutosave,captureAutosaveFlush,hydrateEditor,useEditor} from '../state/editor';
import * as libraries from '../lib/projectLibrary';
import {saveNewLocalProject,readDraft} from '../lib/persistence';
import {importProjectPackage,exportProjectPackage} from '../lib/projectPackage';
vi.mock('./CloudProjectsPanel',()=>({CloudProjectsPanel:()=>null}));
let root:Root|undefined,container:HTMLDivElement,stop=()=>{};
afterEach(async()=>{if(root)await act(async()=>root!.unmount());container?.remove();const finish=captureAutosaveFlush();stop();stop=()=>{};await finish().catch(()=>{});vi.restoreAllMocks();vi.unstubAllGlobals();});
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
it('reopens the saved two-plan exhibition through project cards and a fresh IndexedDB connection, restores both Scene images and backs up exact data',async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('Blob',NodeBlob);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 const inputBytes=new Uint8Array(await readFile('docs/validation/scene-plan-2026-10-11/project.gonggan.zip')),input=await importProjectPackage(inputBytes.slice().buffer),p={...input,id:crypto.randomUUID(),name:'두 도면 전시'},other={...createDemoProject(),id:crypto.randomUUID(),name:'다른 전시'};
 const factory=new IDBFactory(),name='two-plan-local-'+crypto.randomUUID(),repo=libraries.createProjectLibrary(factory,name),selectRepo=vi.spyOn(libraries,'projectLibrary').mockReturnValue(repo);
 await repo.save(other,0,false);await saveNewLocalProject(p);useEditor.getState().loadProject(p,true);stop=startAutosave(undefined,60000);
 await act(async()=>{useEditor.getState().renameProject('두 도면 최신 작업');useEditor.getState().patchProject({floorColor:'#445566'});useEditor.getState().patchNote({type:'project'},{text:'PRIVATE_REOPEN_NOTE'});});const latest=structuredClone(useEditor.getState().project);
 container=document.createElement('div');document.body.append(container);root=createRoot(container);const closed=vi.fn();
 async function wait(check:()=>void){await vi.waitFor(async()=>{await act(async()=>{await repo.list();await new Promise(r=>setTimeout(r,0));});check();},{timeout:5000});}
 async function open(projectName:string){await wait(()=>expect(container.querySelector('[role="status"]')).toBeNull());const card=[...container.querySelectorAll('article.project-card')].find(el=>el.querySelector('strong')?.textContent===projectName)!;expect(card).toBeDefined();const button=[...card.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='열기')!;expect(button.disabled).toBe(false);await act(async()=>button.click());}
 await act(async()=>root!.render(<StrictMode><ProjectsDialog key="first" onClose={closed}/></StrictMode>));await open(other.name);await wait(()=>expect(useEditor.getState().project.id).toBe(other.id));expect((await repo.read(p.id))?.project).toEqual(latest);expect(await readDraft()).toEqual(other);
 await act(async()=>root!.render(<StrictMode><ProjectsDialog key="second" onClose={closed}/></StrictMode>));await open(latest.name);await wait(()=>expect(useEditor.getState().project.id).toBe(p.id));expect(useEditor.getState().project).toEqual(latest);expect(closed).toHaveBeenCalledTimes(2);
 const revision=(await repo.read(p.id))!.summary.revision,finish=captureAutosaveFlush();stop();stop=()=>{};await finish();await act(async()=>root!.render(<StrictMode><PlanView/></StrictMode>));
 // Reconnect to the same actual IndexedDB data, then perform startup hydration.
 const reopened=libraries.createProjectLibrary(factory,name);selectRepo.mockReturnValue(reopened);useEditor.setState({project:createDemoProject(),hydrated:false,saveStatus:'loading'});stop=startAutosave(undefined,60000);await act(async()=>hydrateEditor());
 expect(useEditor.getState().project).toEqual(latest);expect((await reopened.read(p.id))?.summary.revision).toBe(revision);expect(useEditor.getState().saveStatus).toBe('saved');
 const scenes=[];for(const scene of latest.scenes){await act(async()=>useEditor.getState().restoreScene(scene.id));const restored=useEditor.getState().project,expected=sceneProject(latest,scene);expect(restored.walls).toEqual(expected.walls);expect(restored.planReference).toEqual(expected.planReference);expect(restored.planImageUrl).toBe(expected.planImageUrl);expect(restored.sourcePlan).toEqual(expected.sourcePlan);expect(restored.note).toBe('PRIVATE_REOPEN_NOTE');expect(container.querySelector('svg.plan-svg image')?.getAttribute('href')).toBe(expected.planImageUrl);scenes.push({name:scene.name,widthPx:restored.planReference!.widthPx,heightPx:restored.planReference!.heightPx,mmPerPixel:restored.planReference!.mmPerPixel,calibrated:restored.planReference!.calibrated,imageSha256:hash(new Uint8Array(Buffer.from(restored.planImageUrl!.split(',')[1],'base64')))});}
 await act(async()=>captureAutosaveFlush()());const final=structuredClone(useEditor.getState().project);expect(await readDraft()).toEqual(final);expect((await reopened.read(p.id))?.project).toEqual(final);
 const backup=await exportProjectPackage(final,async()=>{throw new Error('Unexpected artwork asset');}),backupBytes=new Uint8Array(await backup.arrayBuffer());expect(await importProjectPackage(backupBytes.slice().buffer)).toEqual(final);
 if(process.env.GONGGAN_LOCAL_RESTORE_PROOF==='1'){const dir='docs/validation/local-plan-restore-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/project.gonggan.zip',backupBytes);await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',inputBackupSha256:hash(inputBytes),backupSha256:hash(backupBytes),projectCardOpens:2,freshIndexedDbConnection:true,hydrationDidNotRewrite:true,initialReopenRevision:revision,finalRevision:(await reopened.read(p.id))!.summary.revision,scenes,privateNotePreserved:true,backupExact:true,browserStorageMeasured:false,gpuMeasured:false,limitations:['Actual React/jsdom project cards and PlanView; fake-indexeddb supplies the IndexedDB API','Owned two-JPEG backup; checks exact documents and SVG image references, not browser image/GPU pixels','Cloud project panel excluded; not real account, browser restart or two-device acceptance']},null,2)+'\n');}
},20000);
