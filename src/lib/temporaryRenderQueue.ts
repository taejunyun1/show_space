let rendering:Promise<unknown>=Promise.resolve();
/** A cancelled GPU job must dispose before a replacement starts. */
export function queueTemporaryRender<T>(signal:AbortSignal,render:()=>Promise<T>):Promise<T>{
 const pending=rendering.catch(()=>{}).then(()=>{signal.throwIfAborted();return render();});
 rendering=pending.then(()=>{},()=>{});
 return pending.then(result=>{signal.throwIfAborted();return result;});
}
