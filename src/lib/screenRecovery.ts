export interface RecoveryActions {save:()=>Promise<void>;backup:()=>{name:string;json:string}}
let current:RecoveryActions|undefined;
// Retain the handler if React unmounts the failed editor subtree. It reads live state.
export const registerRecoveryActions=(actions:RecoveryActions|undefined)=>{current=actions;};
export const recoveryActions=()=>current;
export function isModuleLoadError(error:unknown){return error instanceof Error&&/failed to fetch dynamically imported module|importing a module script failed|loading chunk .+ failed|failed to load module script/i.test(error.message);}
export function createDraftRecovery<T extends {id:string;name:string}>(io:{snapshot:()=>T;flush:()=>Promise<void>;read:(id:string)=>Promise<T|undefined>;write:(p:T)=>Promise<void>}):RecoveryActions{
 return {
  async save(){
   const project=structuredClone(io.snapshot()),json=JSON.stringify(project),guard=()=>{if(JSON.stringify(io.snapshot())!==json)throw new Error('저장 중 프로젝트가 변경됐습니다. 현재 작업을 백업하거나 다시 시도해주세요.');};
   // Wait for the old queue to settle. A failed queue can be retried through
   // the same revision-checked writer, including after the editor unmounts.
   let failedQueue=false;try{await io.flush();}catch{failedQueue=true;}
   guard();const stored=await io.read(project.id);guard();if(failedQueue||!stored||JSON.stringify(stored)!==json){await io.write(project);guard();}
  },
  backup(){const project=io.snapshot();return {name:project.name,json:JSON.stringify(project)};},
 };
}
