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
 const callbacks:Array<(t:Texture)=>void>=[];const acquire=createArtworkTexturePool((_url,ready)=>callbacks.push(ready));const old=acquire('pending');old.release();const fresh=acquire('pending');
 const stale=new Texture(),current=new Texture(),disposed=vi.spyOn(stale,'dispose'),currentDisposed=vi.spyOn(current,'dispose');callbacks[0](stale);callbacks[1](current);
 expect(await old.promise).toBe(stale);expect(disposed).toHaveBeenCalledOnce();expect(await fresh.promise).toBe(current);expect(currentDisposed).not.toHaveBeenCalled();fresh.release();expect(currentDisposed).toHaveBeenCalledOnce();
});
it('allows a clean retry after a failed load and does not delete another lease',async()=>{
 let attempts=0;const acquire=createArtworkTexturePool((_url,ready,failed)=>{if(++attempts===1)failed(new Error('broken'));else ready(new Texture());});const a=acquire('retry');await expect(a.promise).rejects.toThrow('broken');const b=acquire('retry'),c=acquire('retry');a.release();expect(await b.promise).toBe(await c.promise);expect(attempts).toBe(2);b.release();c.release();
});
