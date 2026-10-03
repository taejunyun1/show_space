import {wallLength} from '../domain/model';
import type {Artwork,CameraView,Project,Wall} from '../domain/types';
export interface PdfOptions {current:boolean;sceneIds:string[];threeD:boolean;plan:boolean;elevation:boolean;allWallFaces:boolean;includeSchedule?:boolean}
export interface PdfSection {project:Project;name:string;current?:boolean;kind:'3d'|'plan'|'elevation';wall?:Wall;side?:'front'|'back';camera?:CameraView}
export function pdfSections(project:Project,options:PdfOptions):PdfSection[]{
 if(project.planReference&&!project.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 PDF를 내보내세요.');
 if(!options.current&&!options.sceneIds.length)throw new Error('내보낼 배치를 선택하세요.');
 if(!options.threeD&&!options.plan&&!options.elevation)throw new Error('내보낼 보기를 하나 이상 선택하세요.');
 const batches:Array<{project:Project;name:string;current?:boolean;camera?:CameraView}>=options.current?[{project:structuredClone(project),name:'현재 배치',current:true}]:[];
 for(const id of new Set(options.sceneIds)){
  const scene=project.scenes.find(s=>s.id===id);if(!scene)throw new Error('선택한 Scene을 찾지 못했습니다.');
  const p=structuredClone(project);
  if(scene.structure){Object.assign(p,structuredClone(scene.structure));p.referenceModel=scene.structure.referenceModel?structuredClone(scene.structure.referenceModel):undefined;p.importedFloor=scene.structure.importedFloor?structuredClone(scene.structure.importedFloor):undefined;}
  else p.walls=p.walls.map(w=>({...w,visible:scene.wallVisibility[w.id]??w.visible}));
  const wallIds=new Set(p.walls.map(w=>w.id));p.artworks=structuredClone(scene.artworks.filter(a=>wallIds.has(a.wallId)));
  batches.push({project:p,name:scene.name,camera:scene.cameraView});
 }
 const result:PdfSection[]=[];
 for(const batch of batches){
  if(options.threeD)result.push({...batch,kind:'3d'});
  if(options.plan)result.push({...batch,kind:'plan'});
  if(options.elevation)for(const wall of batch.project.walls.filter(w=>w.visible))for(const side of ['front','back'] as const){
   if(options.allWallFaces||batch.project.artworks.some(a=>a.visible&&a.imageUrl&&a.wallId===wall.id&&(a.wallSide??'front')===side))result.push({...batch,kind:'elevation',wall,side});
  }
 }
 if(!result.length)throw new Error('선택한 보기에 내보낼 벽면이 없습니다.');
 return result;
}
/** PDF points use Y-up; drawing coordinates (plan Z and elevation from top) use Y-down. */
export function fitPdfDrawing(bounds:{minX:number;minY:number;maxX:number;maxY:number},box:{x:number;y:number;width:number;height:number}){
 const width=Math.max(1,bounds.maxX-bounds.minX),height=Math.max(1,bounds.maxY-bounds.minY);
 const scale=Math.min((box.width-40)/width,(box.height-40)/height);
 const left=box.x+(box.width-width*scale)/2,top=box.y+(box.height+height*scale)/2;
 return {scale,x:(x:number)=>left+(x-bounds.minX)*scale,y:(y:number)=>top-(y-bounds.minY)*scale,denominator:1/(scale*25.4/72)};
}
export function elevationArtPlacement(art:Artwork,wall:Wall,side:'front'|'back'){
 return {x:side==='back'?wallLength(wall)-art.alongMm:art.alongMm,y:wall.heightMm-art.centerHeightMm,angle:art.rotationDeg??0};
}
