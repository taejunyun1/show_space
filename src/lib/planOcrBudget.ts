/** One shared budget prevents optional OCR passes from delaying import indefinitely. */
export function createPlanOcrBudget(parent:AbortSignal,totalMs=45_000,passMs=12_000) {
 const deadline=Date.now()+totalMs;
 return async function run<T>(task:(signal:AbortSignal)=>Promise<T>):Promise<T> {
  if(parent.aborted)throw new Error('자동 분석을 취소했습니다.');
  const remaining=deadline-Date.now();
  if(remaining<=0)throw new Error('자동 문자 인식 시간 제한에 도달했습니다. 확보한 결과를 유지합니다.');
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort:()=>void=()=>{};
  const stopped=new Promise<never>((_,reject)=>{
   onAbort=()=>{controller.abort();reject(new Error('자동 분석을 취소했습니다.'));};
   parent.addEventListener('abort',onAbort,{once:true});
   timer=setTimeout(()=>{controller.abort();reject(new Error('자동 문자 인식 시간 제한에 도달했습니다. 확보한 결과를 유지합니다.'));},Math.min(passMs,remaining));
  });
  try{return await Promise.race([task(controller.signal),stopped]);}
  finally{clearTimeout(timer);parent.removeEventListener('abort',onAbort);}
 };
}
