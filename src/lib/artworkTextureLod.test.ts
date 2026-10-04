import {expect,it} from 'vitest';
import {allocateArtworkTextures,stageArtworkTextureSizes,artworkDerivativeLayout,ARTWORK_TEXTURE_BUDGET,textureBytes,type TextureRequest} from './artworkTextureLod';
function request(i:number,overrides:Partial<TextureRequest>={}):TextureRequest{return {id:String(i),key:String(i),visible:true,selected:false,pixels:200,...overrides};}
it('fits 100 high resolution sources into a conservative artwork budget',()=>{
 const requests=Array.from({length:100},(_,i)=>request(i,{pixels:1200,selected:i===99})),r=allocateArtworkTextures(requests);
 expect(r.bytes).toBeLessThanOrEqual(ARTWORK_TEXTURE_BUDGET);expect(r.sizes.get('99')).toBe(2048);expect([...r.sizes.values()].filter(x=>x===2048).length).toBeLessThan(100);
});
it('reduces the base tier for 500 visible images and keeps a selected image detailed',()=>{
 const r=allocateArtworkTextures(Array.from({length:500},(_,i)=>request(i,{selected:i===499})));
 expect(r.bytes).toBeLessThanOrEqual(ARTWORK_TEXTURE_BUDGET);expect(r.sizes.get('499')).toBe(2048);expect(r.sizes.get('0')).toBeLessThan(512);
});
it('shares identical UV assets and reserves only thumbnails for offscreen images',()=>{
 const r=allocateArtworkTextures([request(1,{key:'same',visible:false}),request(2,{key:'same',selected:true}),request(3,{visible:false,selected:true,pixels:2000})]);
 expect(r.sizes.get('1')).toBe(2048);expect(r.sizes.get('2')).toBe(2048);expect(r.sizes.get('3')).toBe(128);expect(r.bytes).toBe(textureBytes(2048)+textureBytes(128));
});
it('retains detail within a hysteresis band and releases it when small again',()=>{
 expect(allocateArtworkTextures([request(1,{pixels:700,previous:2048})]).sizes.get('1')).toBe(2048);
 expect(allocateArtworkTextures([request(1,{pixels:600,previous:2048})]).sizes.get('1')).toBe(1024);
 expect(allocateArtworkTextures([request(1,{pixels:100,previous:2048})]).sizes.get('1')).toBe(512);
});
it('allocates deterministically and handles empty/invalid footprints',()=>{
 const a=[request(1,{pixels:1500}),request(2,{pixels:1500}),request(3,{pixels:NaN})];
 expect([...allocateArtworkTextures(a).sizes].sort()).toEqual([...allocateArtworkTextures([...a].reverse()).sizes].sort());expect(allocateArtworkTextures([]).bytes).toBe(0);expect(allocateArtworkTextures(a).sizes.get('3')).toBe(512);
});
it('crops the sprite panel before sizing and never upscales small images',()=>{
 expect(artworkDerivativeLayout(5000,1000,4,512)).toEqual({x:4000,sourceWidth:1000,sourceHeight:1000,width:512,height:512});
 expect(artworkDerivativeLayout(300,150,null,512)).toEqual({x:0,sourceWidth:300,sourceHeight:150,width:300,height:150});
});
it('waits for old high-detail maps to downgrade before upgrading another image',()=>{
 const target=new Map([['old',128],['new',2048]]);
 expect([...stageArtworkTextureSizes(target,new Map([['old',2048],['new',512]]))]).toEqual([['old',128],['new',512]]);
 expect(stageArtworkTextureSizes(target,new Map([['old',128],['new',512]]))).toBe(target);
});
