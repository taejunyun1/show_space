import {flushAutosave,hydrateEditor,useEditor} from '../state/editor';
import {requireProjectSwitchReady} from '../components/projectSwitchGuard';
import {openEditableCloudProject} from './openCloudProject';
import type {createCloudProjectClient} from './cloudProjectClient';

/** The join route has no editor mounted; restore its existing local draft before switching. */
export async function openInvitedProject(client:ReturnType<typeof createCloudProjectClient>,id:string,userId:string,guard:()=>void){
 guard();if(!useEditor.getState().hydrated){await hydrateEditor();guard();}
 const snapshot=useEditor.getState().project,version=useEditor.getState().projectContextVersion,switchGuard=()=>{guard();if(useEditor.getState().projectContextVersion!==version)throw new Error('전시 배치가 바뀌어 프로젝트 전환을 중단했습니다. 다시 시도하세요.');requireProjectSwitchReady(snapshot);};switchGuard();
 await flushAutosave();switchGuard();if(useEditor.getState().saveStatus!=='saved')throw new Error('현재 로컬 작업을 저장하지 못했습니다. 편집기에서 저장한 뒤 다시 열어주세요.');
 const next=await openEditableCloudProject(client,id,userId,switchGuard);switchGuard();useEditor.getState().loadProject(next,true);return next;
}
