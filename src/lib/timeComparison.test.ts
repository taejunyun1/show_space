import {expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {DEFAULT_OUTDOOR} from '../domain/outdoor';
import {DEFAULT_COMPARISON_TIMES} from '../domain/timeComparison';
import {renderTimeComparison} from './timeComparison';
const options={sceneId:'',date:'2026-07-21',times:DEFAULT_COMPARISON_TIMES,occurrence:'earlier' as const};
it('validates all times before rendering and reuses the identical camera serially',async()=>{
 const p=createDemoProject(),original=structuredClone(p),signal=new AbortController().signal,camera={view:{position:[1,2,3] as [number,number,number],target:[0,0,0] as [number,number,number],zoom:50},width:800,height:600,cutaway:true};
 let active=0,calls=0;const completed:number[]=[];
 const renderer=async(_frame:unknown,c?:typeof camera)=>{expect(c).toBe(camera);expect(active++).toBe(0);calls++;await Promise.resolve();active--;return new Uint8Array([calls]);};
 await renderTimeComparison(p,options,camera,signal,(_f,png,index)=>{expect(png[0]).toBe(index+1);completed.push(index);},renderer);
 expect(completed).toEqual([0,1,2,3]);expect(p).toEqual(original);
 p.outdoor={...DEFAULT_OUTDOOR,timeZone:'America/New_York'};
 await expect(renderTimeComparison(p,{...options,date:'2026-03-08',times:['01:00','02:30','09:00','13:00']},camera,signal,()=>{},renderer)).rejects.toThrow();expect(calls).toBe(4);
});
it('stops stale callbacks and later frames after a pending render is cancelled',async()=>{
 const controller=new AbortController();let calls=0,callbacks=0;
 await expect(renderTimeComparison(createDemoProject(),options,undefined,controller.signal,()=>callbacks++,async()=>{calls++;controller.abort();return new Uint8Array([1]);})).rejects.toThrow();
 expect(calls).toBe(1);expect(callbacks).toBe(0);
});
it('waits for an active cancelled renderer to dispose before starting its replacement',async()=>{
 let release!:()=>void,started!:()=>void,active=0,peak=0,oldCallbacks=0;
 const start=new Promise<void>(r=>started=r),hold=new Promise<void>(r=>release=r),old=new AbortController();
 const first=renderTimeComparison(createDemoProject(),options,undefined,old.signal,()=>oldCallbacks++,async()=>{active++;peak=Math.max(peak,active);started();await hold;active--;return new Uint8Array([1]);});
 const rejected=expect(first).rejects.toThrow();await start;old.abort();
 const replacement=renderTimeComparison(createDemoProject(),options,undefined,new AbortController().signal,()=>{},async()=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return new Uint8Array([2]);});
 release();await rejected;await replacement;expect(peak).toBe(1);expect(oldCallbacks).toBe(0);
});
