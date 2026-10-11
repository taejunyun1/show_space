import {useEffect,useRef} from 'react';
import {hasEditorGesture} from '../domain/editorGesture';
import {useEditor} from '../state/editor';

type State=ReturnType<typeof useEditor.getState>;
type Kind='wall'|'light'|'model'|'pan';
type CaptureTarget=Pick<Element,'releasePointerCapture'>;
type Scope={kind:Kind;project:State['project'];view:State['view'];tool:State['activeTool'];wallId:string;selection:string;token:unknown;pointerId:number;target:CaptureTarget};
const selection=(state:State)=>state.selected.map(s=>`${s.type}:${s.id}`).sort().join('|');
const token=(state:State,kind:Kind)=>kind==='wall'?state.wallGesture:kind==='light'?state.lightGesture:kind==='model'?state.modelArtworkGesture?.ids:null;
function current(scope:Scope,state:State){
 if(scope.project!==state.project||scope.view!==state.view||scope.tool!==state.activeTool||scope.wallId!==state.activeWallId||scope.selection!==selection(state)||scope.token!==token(state,scope.kind))return false;
 if(scope.kind==='pan')return !hasEditorGesture(state);
 return !state.artworkGesture&&!state.rotatingArtworkId&&!state.outdoorGesture
  &&(scope.kind==='wall'||!state.wallGesture)&&(scope.kind==='light'||!state.lightGesture)&&(scope.kind==='model'||!state.modelArtworkGesture);
}
/** Own one UI pointer; never finish a store gesture started by another surface. */
export function useEditorPointer(onRetire?:(render:boolean)=>void){
 const scope=useRef<Scope|null>(null),retired=useRef(onRetire);retired.current=onRetire;
 function release(owned:Scope){try{owned.target.releasePointerCapture(owned.pointerId);}catch{/* Browser capture loss may have already released it. */}}
 function cancel(render=true){
  const owned=scope.current;scope.current=null;retired.current?.(render);if(!owned)return;
  const state=useEditor.getState();
  if(owned.kind!=='pan'&&token(state,owned.kind)===owned.token){if(owned.kind==='wall')state.finishWallTransform(true);else if(owned.kind==='light')state.finishLightMove(true);else state.finishModelArtworkTransform(true);}
  release(owned);
 }
 function begin(kind:Kind,pointerId:number,target:CaptureTarget){
  const state=useEditor.getState(),identity=token(state,kind);if(kind!=='pan'&&!identity)return false;
  scope.current={kind,project:state.project,view:state.view,tool:state.activeTool,wallId:state.activeWallId,selection:selection(state),token:identity,pointerId,target};return true;
 }
 function owns(pointerId:number){const owned=scope.current;if(!owned||owned.pointerId!==pointerId)return false;if(!current(owned,useEditor.getState())){cancel();return false;}return true;}
 function complete(){const owned=scope.current;scope.current=null;retired.current?.(true);if(owned)release(owned);}
 useEffect(()=>{
  const unsubscribe=useEditor.subscribe(next=>{if(scope.current&&!current(scope.current,next))cancel();});
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};window.addEventListener('keydown',escape);
  return()=>{unsubscribe();window.removeEventListener('keydown',escape);cancel(false);};
 },[]);
 return {scope,begin,owns,cancel,complete,foreign:(pointerId:number)=>!!scope.current&&scope.current.pointerId!==pointerId};
}
