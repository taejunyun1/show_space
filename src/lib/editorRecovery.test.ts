import {afterEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {createDemoProject} from '../domain/model';
import {startAutosave,useEditor} from '../state/editor';
import * as libraries from './projectLibrary';
import {saveNewLocalProject,writeDraft} from './persistence';
import {editorRecoveryActions} from './editorRecovery';

let stop=()=>{};
afterEach(()=>{stop();stop=()=>{};vi.restoreAllMocks();});
async function setup(){
 const library=libraries.createProjectLibrary(new IDBFactory(),'recovery-test');vi.spyOn(libraries,'projectLibrary').mockReturnValue(library);
 const project=createDemoProject();project.id=crypto.randomUUID();await saveNewLocalProject(project);useEditor.setState({project,hydrated:true,saveStatus:'saved',past:[],future:[]});return {library,project};
}
it('saves the latest draft to IndexedDB after a failed queue and editor unmount, then clears the unload guard state',async()=>{
 const {library,project}=await setup();stop=startAutosave(async()=>{throw new Error('transient quota failure');},10000);const actions=editorRecoveryActions();
 useEditor.getState().renameProject('복구할 최신 초안');stop();stop=()=>{};await actions.save();
 const stored=await library.read(project.id);expect(stored?.project.name).toBe('복구할 최신 초안');expect(stored?.summary.revision).toBe(2);expect(useEditor.getState().saveStatus).toBe('saved');
});
it('preserves another tab revision and the current JSON backup instead of acknowledging a failed stale write',async()=>{
 const {library,project}=await setup();stop=startAutosave(writeDraft,10000);const actions=editorRecoveryActions();
 useEditor.getState().renameProject('이 탭의 수정');await library.save({...project,name:'다른 탭의 수정'},1);stop();stop=()=>{};
 await expect(actions.save()).rejects.toThrow('다른 탭');expect((await library.read(project.id))?.project.name).toBe('다른 탭의 수정');expect(JSON.parse(actions.backup().json).name).toBe('이 탭의 수정');expect(useEditor.getState().saveStatus).toBe('error');
});
