import {useEditor,captureAutosaveFlush} from '../state/editor';
import {projectLibrary} from './projectLibrary';
import {writeDraft} from './persistence';
import {createDraftRecovery} from './screenRecovery';
export function editorRecoveryActions(){const actions=createDraftRecovery({
 snapshot:()=>{const s=useEditor.getState();if(!s.hydrated)throw new Error('저장된 작업을 아직 불러오지 못했습니다.');return s.project;},
 flush:captureAutosaveFlush(),
 read:async(id:string)=>{const stored=await projectLibrary().read(id);if(stored?.summary.archived)throw new Error('다른 탭에서 이 프로젝트를 보관했습니다. 현재 작업을 백업해주세요.');return stored?.project;},
 write:writeDraft,
});return {...actions,async save(){await actions.save();useEditor.setState({saveStatus:'saved'});}};}
