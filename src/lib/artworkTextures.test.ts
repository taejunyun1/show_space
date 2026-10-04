import {expect,it,vi} from 'vitest';
import {Texture,SRGBColorSpace} from 'three';
import {createArtworkTexturePool} from './artworkTextures';
it('shares one GPU texture for reused images and releases it only after the last view',async()=>{
 const texture=new Texture(),dispose=vi.spyOn(texture,'dispose'),load=vi.fn((_url:string,ready:(t:Texture)=>void)=>ready(texture));const acquire=createArtworkTexturePool(load);
 const a=acquire('same'),b=acquire('same');expect(await a.promise).toBe(await b.promise);expect(load).toHaveBeenCalledTimes(1);expect(texture.colorSpace).toBe(SRGBColorSpace);
 a.release();a.release();expect(dispose).not.toHaveBeenCalled();b.release();expect(dispose).toHaveBeenCalledOnce();
 acquire('same');expect(load).toHaveBeenCalledTimes(2);
});
it('keeps sprite panels independent while sharing matching UV variants',async()=>{
 const acquire=createArtworkTexturePool((_url,ready)=>ready(new Texture()));const a=acquire('sprite',0),b=acquire('sprite',4),c=acquire('sprite',4);
 const first=await a.promise,last=await b.promise;expect(first).not.toBe(last);expect(await c.promise).toBe(last);expect(last.repeat.toArray()).toEqual([.2,1]);expect(last.offset.toArray()).toEqual([.8,0]);expect(first.offset.x).toBe(0);a.release();b.release();c.release();
});
it('disposes a late image after unmount without poisoning a newer acquisition',async()=>{
 const callbacks:Array<(t:Texture)=>void>=[];const acquire=createArtworkTexturePool((_url,ready)=>{callbacks.push(ready);});const old=acquire('pending');old.release();const fresh=acquire('pending');
 const stale=new Texture(),current=new Texture(),disposed=vi.spyOn(stale,'dispose'),currentDisposed=vi.spyOn(current,'dispose');callbacks[0](stale);callbacks[1](current);
 expect(await old.promise).toBe(stale);expect(disposed).toHaveBeenCalledOnce();expect(await fresh.promise).toBe(current);expect(currentDisposed).not.toHaveBeenCalled();fresh.release();expect(currentDisposed).toHaveBeenCalledOnce();
});
it('allows a clean retry after a failed load and does not delete another lease',async()=>{
 let attempts=0;const acquire=createArtworkTexturePool((_url,ready,failed)=>{if(++attempts===1)failed(new Error('broken'));else ready(new Texture());});const a=acquire('retry');await expect(a.promise).rejects.toThrow('broken');const b=acquire('retry'),c=acquire('retry');a.release();expect(await b.promise).toBe(await c.promise);expect(attempts).toBe(2);b.release();c.release();
});
it('shares each resolution independently and keeps a replacement alive after releasing its old tier',async()=>{
 const load=vi.fn((_url:string,ready:(t:Texture)=>void,_failed:(error:unknown)=>void,_maxSide?:number)=>{ready(new Texture());});const acquire=createArtworkTexturePool(load);
 const low=acquire('original',null,128),high=acquire('original',null,2048),shared=acquire('original',null,2048);
 const small=await low.promise,large=await high.promise;expect(await shared.promise).toBe(large);expect(large).not.toBe(small);expect(load).toHaveBeenCalledTimes(2);
 expect(load.mock.calls[1][3]).toBe(2048);const smallDisposed=vi.spyOn(small,'dispose'),largeDisposed=vi.spyOn(large,'dispose');low.release();expect(smallDisposed).toHaveBeenCalledOnce();expect(largeDisposed).not.toHaveBeenCalled();high.release();shared.release();expect(largeDisposed).toHaveBeenCalledOnce();
});
it('uses full panel UVs for a cropped derivative and original sprite UVs for original loads',async()=>{
 const acquire=createArtworkTexturePool((_url,ready)=>ready(new Texture()));
 const original=acquire('sprite',4),derivative=acquire('sprite',4,512);
 expect((await original.promise).repeat.x).toBe(.2);expect((await derivative.promise).repeat.x).toBe(1);expect((await derivative.promise).offset.x).toBe(0);original.release();derivative.release();
});
it('cancels unused queued work at the last lease without cancelling a shared consumer',async()=>{
 const cancel=vi.fn();const acquire=createArtworkTexturePool((_url,_ready,failed)=>()=>{cancel();failed(new Error('cancelled'));});
 const a=acquire('queued',null,2048),b=acquire('queued',null,2048);
 const rejected=expect(a.promise).rejects.toThrow('cancelled');a.release();expect(cancel).not.toHaveBeenCalled();b.release();await rejected;expect(cancel).toHaveBeenCalledOnce();b.release();expect(cancel).toHaveBeenCalledOnce();
});
