import {expect,it} from 'vitest';
import {applyMaterialTemplate,builtinMaterials,parseMaterialTemplate} from './materialLibrary';
import {createDemoProject} from './model';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const design=()=>({...builtinMaterials[0],name:'반복 벽',material:{...builtinMaterials[0].material,texture:{imageUrl:png,widthMm:2000,heightMm:1000}}});
it('validates portable material fields and embedded image headers while removing private and geometry data',()=>{
 expect(parseMaterialTemplate({...design(),note:'private',position:123})).toEqual(design());
 for(const patch of [{name:''},{category:'bad'},{color:'url(x)'},{material:{...design().material,roughness:2}},{material:{...design().material,texture:{imageUrl:'https://external.test/t.png',widthMm:2000,heightMm:1000}}},{material:{...design().material,texture:{imageUrl:'data:image/png;base64,YWJj',widthMm:2000,heightMm:1000}}}])expect(()=>parseMaterialTemplate({...design(),...patch})).toThrow();
});
it('applies to wall and floor without changing dimensions, placements, notes or scenes',()=>{
 const p=createDemoProject(),next=applyMaterialTemplate(p,{type:'wall',id:p.walls[0].id},design(),p.id);
 expect(next.walls[0]).toEqual({...p.walls[0],color:design().color,material:design().material});
 expect(next.artworks).toEqual(p.artworks);expect(next.scenes).toEqual(p.scenes);expect(next.walls.slice(1)).toEqual(p.walls.slice(1));
 const floor=applyMaterialTemplate(next,{type:'floor'},design(),p.id);expect(floor).toEqual({...next,floorColor:design().color,floorMaterial:design().material});
 next.walls[0].material!.texture!.widthMm=500;expect(design().material.texture.widthMm).toBe(2000);expect(p.walls[0].material).toBeUndefined();
});
it('preserves artwork image, dimensions and frame while applying finish only',()=>{
 const p=createDemoProject(),t=design(),next=applyMaterialTemplate(p,{type:'artwork',id:p.artworks[0].id},t,p.id),{texture:_,...finish}=t.material;
 expect(next.artworks[0]).toEqual({...p.artworks[0],material:finish});expect(next.walls).toEqual(p.walls);expect(next.artworks[0].material).not.toHaveProperty('texture');
});
it('rejects stale projects, missing objects and locked targets including async lock changes',()=>{
 const p=createDemoProject();expect(()=>applyMaterialTemplate(p,{type:'floor'},design(),'another-project')).toThrow('프로젝트');
 expect(()=>applyMaterialTemplate(p,{type:'wall',id:'missing'},design(),p.id)).toThrow('찾을');
 p.walls[0].locked=true;expect(()=>applyMaterialTemplate(p,{type:'wall',id:p.walls[0].id},design(),p.id)).toThrow('잠긴');
 p.artworks[0].locked=true;expect(()=>applyMaterialTemplate(p,{type:'artwork',id:p.artworks[0].id},design(),p.id)).toThrow('잠긴');
});
