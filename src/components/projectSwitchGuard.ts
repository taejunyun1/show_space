import {useEditor} from '../state/editor';
import type {Project} from '../domain/types';

/** A project replacement must never discard an edit or an active preview. */
export function requireProjectSwitchReady(snapshot:Project){
 const state=useEditor.getState();
 if(!state.hydrated)throw new Error('저장된 작업을 불러온 뒤 프로젝트를 여세요.');
 if(state.project!==snapshot)throw new Error('작업이 변경돼 프로젝트 전환을 중단했습니다. 다시 시도하세요.');
 if(state.previewProject||state.wallGesture||state.artworkGesture||state.lightGesture||state.modelArtworkGesture||state.outdoorGesture||state.rotatingArtworkId)throw new Error('이동·회전을 마친 뒤 프로젝트를 여세요.');
}
