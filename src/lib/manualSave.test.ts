import {afterEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {createDemoProject} from '../domain/model';
import {saveCurrentDraft,startAutosave,useEditor} from '../state/editor';
import {useCloudSync} from '../state/cloudSync';
import * as libraries from './projectLibrary';
import {saveNewLocalProject,writeDraft} from './persistence';
import {saveEditorDraft} from './manualSave';
let stop=()=>{};
afterEach(()=>{stop();stop=()=>{};vi.restoreAllMocks();});
async function setup(){
 const library=libraries.createProjectLibrary(new IDBFactory(),'manual-save-test');vi.spyOn(libraries,'projectLibrary').mockReturnValue(library);const p=createDemoProject();p.id=crypto.randomUUID();await saveNewLocalProject(p);useEditor.setState({project:p,hydrated:true,saveStatus:'saved',message:null,past:[],future:[],previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,rotatingArtworkId:null});return {library,p};
}
it('saves immediately through actual IndexedDB without waiting for debounce, preserves assets/history and does not claim cloud delivery',async()=>{
 const {library,p}=await setup();stop=startAutosave(writeDraft,60000);useEditor.getState().renameProject('바로 저장');useEditor.getState().patchArtwork(p.artworks[0].id,{note:'비공개 설치 메모',widthMm:1500});const before=useEditor.getState(),cloud={projectId:p.id,userId:'synthetic',status:'queued' as const,message:'offline'};useCloudSync.setState({current:cloud});await saveEditorDraft();const stored=await library.read(p.id);expect(stored?.project).toEqual(before.project);expect(stored?.project.artworks[0].imageUrl).toBe(p.artworks[0].imageUrl);expect(stored?.summary.revision).toBe(2);expect(useEditor.getState().saveStatus).toBe('saved');expect(useEditor.getState().message).toBe('현재 작업을 로컬에 저장했습니다.');expect(useEditor.getState().past).toBe(before.past);expect(useEditor.getState().project).toBe(before.project);expect(useCloudSync.getState().current).toBe(cloud);
 await saveEditorDraft();expect((await library.read(p.id))?.summary.revision).toBe(2);
});
it('coalesces repeated save commands while an actual write is pending',async()=>{
 const {library,p}=await setup();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),writer=vi.fn(async(project:typeof p)=>{await gate;await writeDraft(project);});stop=startAutosave(writer,60000);useEditor.getState().renameProject('한 번만 저장');const a=saveEditorDraft(),b=saveEditorDraft();expect(a).toBe(b);await Promise.resolve();expect(writer).toHaveBeenCalledTimes(1);expect(useEditor.getState().message??'').not.toContain('로컬에 저장했습니다');release();await a;expect((await library.read(p.id))?.project.name).toBe('한 번만 저장');expect((await library.read(p.id))?.summary.revision).toBe(2);expect(writer).toHaveBeenCalledTimes(1);
});
it('retries a settled failed queue on the same guarded writer and never overwrites another tab revision',async()=>{
 const {library,p}=await setup();let available=false;stop=startAutosave(async project=>{if(!available)throw new Error('저장 공간 부족');await writeDraft(project);},60000);useEditor.getState().renameProject('보존할 초안');await saveEditorDraft();expect(useEditor.getState().saveStatus).toBe('error');expect(useEditor.getState().message).toContain('저장 공간 부족');expect((await library.read(p.id))?.project.name).toBe(p.name);
 available=true;await saveEditorDraft();expect((await library.read(p.id))?.project.name).toBe('보존할 초안');expect(useEditor.getState().saveStatus).toBe('saved');await library.save({...p,name:'다른 탭 수정'},2);useEditor.getState().renameProject('이 탭 수정');await saveEditorDraft();expect(useEditor.getState().saveStatus).toBe('error');expect(useEditor.getState().message).toContain('다른 탭');expect((await library.read(p.id))?.project.name).toBe('다른 탭 수정');expect(useEditor.getState().project.name).toBe('이 탭 수정');
});
it('does not acknowledge the new draft while an earlier save finishes',async()=>{
 const {library,p}=await setup();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});stop=startAutosave(async project=>{await gate;await writeDraft(project);},60000);useEditor.getState().renameProject('첫 초안');const job=saveEditorDraft();await Promise.resolve();useEditor.getState().renameProject('저장 중 추가 수정');release();await job;expect((await library.read(p.id))?.project.name).toBe('첫 초안');expect(useEditor.getState().saveStatus).toBe('saving');expect(useEditor.getState().message).toContain('작업이 변경');await saveEditorDraft();expect((await library.read(p.id))?.project.name).toBe('저장 중 추가 수정');expect(useEditor.getState().saveStatus).toBe('saved');
});
it('rejects loading, an active transform and a stopped writer without changing the current layout',async()=>{
 const {p}=await setup();stop=startAutosave(writeDraft,60000);useEditor.setState({hydrated:false});await expect(saveCurrentDraft()).rejects.toThrow('불러오');useEditor.setState({hydrated:true,previewProject:{...p}});await expect(saveCurrentDraft()).rejects.toThrow('마친 뒤');expect(useEditor.getState().project).toBe(p);useEditor.setState({previewProject:null});stop();stop=()=>{};await expect(saveCurrentDraft()).rejects.toThrow('사용할 수 없습니다');
});

it('does not show a stale success message on a different project',async()=>{
 await setup();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});stop=startAutosave(async project=>{await gate;await writeDraft(project);},60000);useEditor.getState().renameProject('저장할 이전 전시');const job=saveEditorDraft();await Promise.resolve();const other={...createDemoProject(),id:crypto.randomUUID(),name:'다음 전시'};await saveNewLocalProject(other);useEditor.getState().loadProject(other,true);release();await job;expect(useEditor.getState().project.id).toBe(other.id);expect(useEditor.getState().message??'').not.toContain('로컬에 저장했습니다');expect(useEditor.getState().saveStatus).toBe('saved');
});
