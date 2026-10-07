import {expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {renderSceneThumbnail} from './sceneThumbnail';
import {renderTimeComparison} from './timeComparison';
import {DEFAULT_COMPARISON_TIMES} from '../domain/timeComparison';
const preview={imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',widthPx:1,heightPx:1,view:'3d' as const};
it('renders detached geometry and exact camera framing without mutating the editing state',async()=>{
 const p=createDemoProject(),original=structuredClone(p),camera={view:{position:[1,2,3] as [number,number,number],target:[0,1,0] as [number,number,number],zoom:50},width:813,height:622,cutaway:false};
 const result=await renderSceneThumbnail(p,camera,new AbortController().signal,async(source,c)=>{expect(c).toEqual(camera);expect(c).not.toBe(camera);expect(source).not.toBe(p);source.walls[0].color='#123456';return new Uint8Array([1,2,3]);},async(blob,view)=>{expect(view).toBe('3d');expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));return preview;});
 expect(result).toEqual(preview);expect(p).toEqual(original);
});
it('cancels stale thumbnail encoding and serializes against the time comparison renderer',async()=>{
 let release!:()=>void,started!:()=>void,active=0,peak=0,encodes=0;
 const hold=new Promise<void>(r=>release=r),start=new Promise<void>(r=>started=r),controller=new AbortController();
 const first=renderSceneThumbnail(createDemoProject(),undefined,controller.signal,async()=>{active++;peak=Math.max(active,peak);started();await hold;active--;return new Uint8Array([1]);},async()=>{encodes++;return preview;});
 const rejected=expect(first).rejects.toThrow();await start;controller.abort();
 const second=renderTimeComparison(createDemoProject(),{sceneId:'',date:'2026-07-21',times:DEFAULT_COMPARISON_TIMES,occurrence:'earlier'},undefined,new AbortController().signal,()=>{},async()=>{active++;peak=Math.max(active,peak);await Promise.resolve();active--;return new Uint8Array([2]);});
 release();await rejected;await second;expect(peak).toBe(1);expect(encodes).toBe(0);
});
