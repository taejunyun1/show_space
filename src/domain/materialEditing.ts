import {parseSurfaceMaterial,type SurfaceMaterial} from './materials';

export const materialFinishes=[
 {id:'matte',label:'무광',roughness:.92,clearcoat:0},
 {id:'satin',label:'새틴 · 은은한 광택',roughness:.45,clearcoat:.15},
 {id:'glossy',label:'유광',roughness:.12,clearcoat:.5},
] as const;
export type MaterialFinishId=typeof materialFinishes[number]['id'];
export type TransparencyMode='opaque'|'opacity'|'transmission';

/** Read-only classification: opening the editor must never normalize saved finishes. */
export function materialFinish(material:SurfaceMaterial):MaterialFinishId|'custom'{
 return materialFinishes.find(f=>f.roughness===material.roughness&&f.clearcoat===material.clearcoat)?.id??'custom';
}
export function patchSurfaceMaterial(material:SurfaceMaterial,patch:Partial<SurfaceMaterial>):SurfaceMaterial{
 const next={...material,...patch};
 if(patch.transmission!==undefined&&patch.transmission>0)next.opacity=1;
 if(patch.opacity!==undefined&&patch.opacity<1)next.transmission=0;
 return parseSurfaceMaterial(next);
}
export function setMaterialFinish(material:SurfaceMaterial,id:MaterialFinishId):SurfaceMaterial{
 const finish=materialFinishes.find(f=>f.id===id);
 if(!finish)throw new Error('지원하지 않는 표면 마감입니다.');
 return patchSurfaceMaterial(material,{roughness:finish.roughness,clearcoat:finish.clearcoat});
}
export function transparencyMode(material:SurfaceMaterial):TransparencyMode{
 return material.transmission>0?'transmission':material.opacity<1?'opacity':'opaque';
}
export function materialTransparency(material:SurfaceMaterial):number{
 return material.transmission>0?material.transmission:1-material.opacity;
}
export function setTransparencyMode(material:SurfaceMaterial,mode:TransparencyMode):SurfaceMaterial{
 if(mode===transparencyMode(material))return material;
 switch(mode){
  case 'opaque':return patchSurfaceMaterial(material,{opacity:1,transmission:0});
  case 'opacity':return patchSurfaceMaterial(material,{opacity:1-(materialTransparency(material)||.5),transmission:0});
  case 'transmission':return patchSurfaceMaterial(material,{transmission:materialTransparency(material)||.9,opacity:1});
 }
}
export function setMaterialTransparency(material:SurfaceMaterial,value:number):SurfaceMaterial{
 if(!Number.isFinite(value)||value<0||value>1)throw new Error('투명도는 0~100% 사이여야 합니다.');
 return transparencyMode(material)==='transmission'?patchSurfaceMaterial(material,{transmission:value,opacity:1}):patchSurfaceMaterial(material,{opacity:1-value,transmission:0});
}
