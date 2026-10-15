import {useEffect,useRef,useState} from 'react';
import {useProjectDialogScope} from './useProjectDialogScope';

/** Retire delivery immediately; encoders release their resources at the next checkpoint. */
export function useOutputJob(projectId:string,onClose:()=>void){
 const mounted=useRef(false),closed=useRef(false),active=useRef<{controller:AbortController;version:number}|undefined>(undefined);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 function retire(){active.current?.controller.abort();active.current=undefined;}
 const scope=useProjectDialogScope(projectId,()=>{closed.current=true;retire();onClose();},true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;retire();};},[]);
 function cancel(){retire();if(mounted.current){setBusy(false);setProgress('');setError('');setNotice('생성을 취소했습니다. 옵션을 확인하고 다시 저장할 수 있습니다.');}}
 function dismiss(){if(closed.current)return;closed.current=true;retire();onClose();}
 async function run<T>(create:(signal:AbortSignal,report:(message:string)=>void)=>Promise<T>,deliver:(value:T)=>void){
  if(active.current||closed.current||!mounted.current)return;const version=scope.begin();if(version===undefined)return;
  const operation={controller:new AbortController(),version};active.current=operation;setBusy(true);setProgress('');setError('');setNotice('');
  const current=()=>mounted.current&&!closed.current&&active.current===operation&&!operation.controller.signal.aborted&&scope.current(version);
  const report=(message:string)=>{if(!current())throw new DOMException('출력 생성을 취소했습니다.','AbortError');setProgress(message);};
  try{const value=await create(operation.controller.signal,report);if(current())deliver(value);}
  catch(cause){if(current())setError(cause instanceof Error?cause.message:'파일을 만들지 못했습니다.');}
  finally{if(active.current===operation){active.current=undefined;if(mounted.current){setBusy(false);setProgress('');}}}
 }
 return {busy,progress,error,notice,cancel,dismiss,run,setError};
}
