import {saveCurrentDraft,useEditor} from '../state/editor';
const jobs=new Map<string,Promise<void>>();
/** Shared button/shortcut command: never acknowledge cloud persistence or mutate the layout. */
export function saveEditorDraft():Promise<void>{
 const snapshot=useEditor.getState().project,existing=jobs.get(snapshot.id);if(existing)return existing;
 const work=(async()=>{
  try{
   await saveCurrentDraft();
   if(useEditor.getState().project===snapshot)useEditor.getState().notify('현재 작업을 로컬에 저장했습니다.');
  }catch(error){
   if(useEditor.getState().project.id===snapshot.id)useEditor.getState().notify(error instanceof Error?error.message:'로컬 저장을 완료하지 못했습니다. 내보내기로 백업하세요.');
  }
 })();jobs.set(snapshot.id,work);void work.finally(()=>{if(jobs.get(snapshot.id)===work)jobs.delete(snapshot.id);});return work;
}
