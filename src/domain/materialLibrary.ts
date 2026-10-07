import {materialPresets,parseSurfaceMaterial,type SurfaceMaterial,type MaterialPresetId} from './materials';
import {libraryImageBytes} from './artworkLibrary';
import {updateArtwork,updateWall} from './model';
import type {Project} from './types';

export const materialCategories=['architecture','artwork','floor','glass','metal','fabric','custom'] as const;
export type MaterialCategory=typeof materialCategories[number];
export const materialCategoryLabels:Record<MaterialCategory,string>={architecture:'벽·건축',artwork:'작품',floor:'바닥',glass:'유리',metal:'금속',fabric:'천',custom:'사용자 재질'};
export interface MaterialTemplate {name:string;category:MaterialCategory;color:string;material:SurfaceMaterial}
export type MaterialTarget={type:'wall'|'artwork';id:string}|{type:'floor'};
export function parseMaterialTemplate(input:unknown):MaterialTemplate{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('재질 형식이 올바르지 않습니다.');
 const t=input as MaterialTemplate;
 if(typeof t.name!=='string'||!t.name.trim()||t.name.length>100)throw new Error('재질 이름은 1~100자로 입력하세요.');
 if(!materialCategories.includes(t.category))throw new Error('재질 분류가 올바르지 않습니다.');
 if(typeof t.color!=='string'||!/^#[0-9a-f]{6}$/i.test(t.color))throw new Error('재질 색상이 올바르지 않습니다.');
 const material=parseSurfaceMaterial(t.material);
 if(material.texture)libraryImageBytes(material.texture.imageUrl);
 return {name:t.name.trim(),category:t.category,color:t.color.toLowerCase(),material};
}
const presetCategory=(id:MaterialPresetId):MaterialCategory=>['glass','acrylic','mirror'].includes(id)?'glass':['metal','stainless-steel'].includes(id)?'metal':id==='fabric'?'fabric':id==='epoxy-floor'?'floor':['matte-photo-paper','glossy-photo-paper','baryta','canvas'].includes(id)?'artwork':'architecture';
export const builtinMaterials:MaterialTemplate[]=materialPresets.map(p=>({name:p.label,category:presetCategory(p.id),color:p.color,material:{...p.material}}));
/** Apply one portable finish without altering geometry, identity or private notes. */
export function applyMaterialTemplate(project:Project,target:MaterialTarget,input:unknown,expectedProjectId:string):Project{
 if(project.id!==expectedProjectId)throw new Error('프로젝트가 바뀌어 재질 적용을 취소했습니다.');
 const t=parseMaterialTemplate(input);
 if(target.type==='floor')return {...project,floorColor:t.color,floorMaterial:t.material};
 if(target.type==='wall'){
  const wall=project.walls.find(w=>w.id===target.id);
  if(!wall)throw new Error('재질을 적용할 벽을 찾을 수 없습니다.');
  if(wall.locked)throw new Error('잠긴 벽에는 재질을 적용할 수 없습니다.');
  return updateWall(project,wall.id,{color:t.color,material:t.material});
 }
 const art=project.artworks.find(a=>a.id===target.id);
 if(!art)throw new Error('재질을 적용할 작품을 찾을 수 없습니다.');
 if(art.locked)throw new Error('잠긴 작품에는 재질을 적용할 수 없습니다.');
 const {texture:_,...finish}=t.material;
 return updateArtwork(project,art.id,{material:finish});
}
