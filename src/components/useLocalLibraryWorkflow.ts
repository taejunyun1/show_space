import {useEffect,useRef,useState} from 'react';
import {useEditor} from '../state/editor';
import {useProjectDialogScope} from './useProjectDialogScope';

type EditorState=ReturnType<typeof useEditor.getState>;
/** Keep list responses and deferred actions within the dialog that started them. */
export function useLocalLibraryWorkflow<T>({projectId,onClose,list,channelName,errorMessage,blocked=false,context}:{projectId:string;onClose:()=>void;list:()=>Promise<T[]>;channelName:string;errorMessage:string;blocked?:boolean;context?:(state:EditorState)=>string}){
 const scope=useProjectDialogScope(projectId,onClose),listNow=useRef(list),close=useRef(onClose),contextNow=useRef(context),blockedNow=useRef(blocked);
 listNow.current=list;close.current=onClose;contextNow.current=context;blockedNow.current=blocked;
 const retired=useRef(false),active=useRef<object|null>(null),listRevision=useRef(0),loadingNow=useRef(true),channel=useRef<BroadcastChannel|null>(null);
 const [items,setItems]=useState<T[]>([]),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const current=(version:number)=>!retired.current&&scope.current(version);
 async function refresh(){
  const version=scope.begin();if(version===undefined||retired.current)return;
  const revision=++listRevision.current;loadingNow.current=true;setLoading(true);
  try{const next=await listNow.current();if(current(version)&&revision===listRevision.current)setItems(next);}
  catch(cause){if(current(version)&&revision===listRevision.current)throw cause;}
  finally{if(current(version)&&revision===listRevision.current){loadingNow.current=false;setLoading(false);}}
 }
 function broadcast(){const version=scope.begin();if(version!==undefined&&current(version))channel.current?.postMessage({changed:true});}
 useEffect(()=>{
  retired.current=false;
  const update=()=>{const version=scope.begin();void refresh().catch(cause=>{if(version!==undefined&&current(version))setError(cause instanceof Error?cause.message:errorMessage);});};
  update();
  const unsubscribe=useEditor.subscribe((next,previous)=>{const read=contextNow.current;if(!read||retired.current||scope.begin()===undefined||read(next)===read(previous))return;retired.current=true;close.current();});
  if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel(channelName);channel.current.onmessage=update;}
  window.addEventListener('focus',update);
  return()=>{retired.current=true;active.current=null;listRevision.current++;unsubscribe();channel.current?.close();channel.current=null;window.removeEventListener('focus',update);};
 },[channelName]);
 async function run(action:(guard:()=>void)=>Promise<string|void>){
  const version=scope.begin();if(version===undefined||retired.current||active.current||loadingNow.current||blockedNow.current)return;
  const operation={};active.current=operation;setWorking(true);setError('');setMessage('');
  const guard=()=>{if(active.current!==operation||!current(version))throw new Error('라이브러리 작업이 바뀌어 중단했습니다.');};
  try{guard();const result=await action(guard);guard();if(result)setMessage(result);await refresh();guard();broadcast();}
  catch(cause){if(active.current===operation&&current(version)){setError(cause instanceof Error?cause.message:errorMessage);await refresh().catch(()=>{});}}
  finally{if(active.current===operation){active.current=null;if(current(version))setWorking(false);}}
 }
 return {items,localBusy:loading||working,error,message,run,refresh,broadcast};
}

export function requireLibraryApplyIdle(){
 const state=useEditor.getState();
 if(!state.hydrated)throw new Error('저장된 작업을 불러온 뒤 적용하세요.');
 if(state.previewProject||state.wallGesture||state.artworkGesture||state.lightGesture||state.modelArtworkGesture||state.outdoorGesture||state.rotatingArtworkId)throw new Error('이동·회전을 마친 뒤 라이브러리 항목을 적용하세요.');
}
