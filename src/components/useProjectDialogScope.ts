import {useEffect,useRef} from 'react';
import {useEditor} from '../state/editor';

/** Retire a delivery dialog on every project transition, including batched A→B→A. */
export function useProjectDialogScope(projectId:string,onClose:()=>void){
 const close=useRef(onClose);close.current=onClose;
 const scope=useRef({mounted:false,valid:false,version:0});
 useEffect(()=>{
  scope.current.mounted=true;scope.current.valid=useEditor.getState().project.id===projectId;
  const unsubscribe=useEditor.subscribe((next,previous)=>{
   if(next.project.id===previous.project.id||!scope.current.valid)return;
   scope.current.valid=false;scope.current.version++;close.current();
  });
  return()=>{unsubscribe();scope.current.mounted=false;scope.current.valid=false;scope.current.version++;};
 },[projectId]);
 return {
  begin:()=>scope.current.mounted&&scope.current.valid&&useEditor.getState().project.id===projectId?scope.current.version:undefined,
  current:(version:number)=>scope.current.mounted&&scope.current.valid&&scope.current.version===version&&useEditor.getState().project.id===projectId,
 };
}
