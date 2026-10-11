import {useEffect,useRef} from 'react';
import {useEditor} from '../state/editor';

/** Retire on project transitions, optionally also on same-ID document/Scene/history restoration. */
export function useProjectDialogScope(projectId:string,onClose:()=>void,retireOnRestore=false){
 const close=useRef(onClose);close.current=onClose;
 const scope=useRef({mounted:false,valid:false,version:0});
 useEffect(()=>{
  scope.current.mounted=true;scope.current.valid=useEditor.getState().project.id===projectId;
  const unsubscribe=useEditor.subscribe((next,previous)=>{
   if(!scope.current.valid||next.project.id===previous.project.id&&(!retireOnRestore||next.projectContextVersion===previous.projectContextVersion))return;
   scope.current.valid=false;scope.current.version++;close.current();
  });
  return()=>{unsubscribe();scope.current.mounted=false;scope.current.valid=false;scope.current.version++;};
 },[projectId,retireOnRestore]);
 return {
  begin:()=>scope.current.mounted&&scope.current.valid&&useEditor.getState().project.id===projectId?scope.current.version:undefined,
  current:(version:number)=>scope.current.mounted&&scope.current.valid&&scope.current.version===version&&useEditor.getState().project.id===projectId,
 };
}
