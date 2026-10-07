import {expect,it} from 'vitest';
import {materialPresetIds,materialPreset,parseSurfaceMaterial} from './materials';
import {materialFinish,materialFinishes,setMaterialFinish,materialTransparency,transparencyMode,setTransparencyMode,setMaterialTransparency,patchSurfaceMaterial} from './materialEditing';

it('reads existing finishes without normalizing and changes only the two finish properties',()=>{
 for(const id of materialPresetIds){
  const original={...materialPreset(id).material,texture:{imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEmkAAAAASUVORK5CYII=',widthMm:2000,heightMm:1000}};
  const before=structuredClone(original);
  materialFinish(original);transparencyMode(original);materialTransparency(original);
  expect(original).toEqual(before);
  for(const finish of materialFinishes){
   const next=setMaterialFinish(original,finish.id);
   expect(materialFinish(next)).toBe(finish.id);
   expect({...next,roughness:original.roughness,clearcoat:original.clearcoat}).toEqual(original);
   expect(parseSurfaceMaterial(next)).toEqual(next);
  }
 }
 expect(materialFinish(materialPreset('white-paint').material)).toBe('custom');
});
it('represents glass transmission accurately and preserves all unrelated properties when changing modes',()=>{
 const glass=materialPreset('glass').material;
 expect(transparencyMode(glass)).toBe('transmission');expect(materialTransparency(glass)).toBe(1);
 expect(setTransparencyMode(glass,'transmission')).toBe(glass);
 const clear=setMaterialTransparency(glass,.7);expect(clear.transmission).toBe(.7);expect(clear.opacity).toBe(1);
 const alpha=setTransparencyMode(clear,'opacity');expect(alpha.opacity).toBeCloseTo(.3);expect(alpha.transmission).toBe(0);
 expect({...alpha,opacity:glass.opacity,transmission:glass.transmission}).toEqual(glass);
 const opaque=setTransparencyMode(alpha,'opaque');expect(materialTransparency(opaque)).toBe(0);
 const again=setTransparencyMode(opaque,'transmission');expect(again.transmission).toBe(.9);expect(again.opacity).toBe(1);
 const fromSolid=setMaterialTransparency(opaque,.35);expect(transparencyMode(fromSolid)).toBe('opacity');expect(materialTransparency(fromSolid)).toBeCloseTo(.35);
 for(const value of [-.1,1.1,NaN,Infinity])expect(()=>setMaterialTransparency(glass,value)).toThrow();
 expect(glass).toEqual(materialPreset('glass').material);
});
it('keeps advanced opacity and transmission edits compatible with project serialization',()=>{
 const glass=materialPreset('glass').material;
 const alpha=patchSurfaceMaterial(glass,{opacity:.4});expect(alpha.transmission).toBe(0);
 const transmission=patchSurfaceMaterial(alpha,{transmission:.8});expect(transmission.opacity).toBe(1);
 expect(parseSurfaceMaterial(transmission)).toEqual(transmission);
 expect(()=>patchSurfaceMaterial(transmission,{roughness:Infinity})).toThrow();
});
