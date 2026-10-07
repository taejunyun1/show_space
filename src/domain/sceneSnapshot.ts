import {parseProject} from './model';
import {DEFAULT_LIGHTING} from './lighting';
import {DEFAULT_OUTDOOR} from './outdoor';
import type {CameraView,Project,SceneThumbnail} from './types';
/** Save the captured layout while preserving edits made during thumbnail generation. */
export function appendSceneSnapshot(current:Project,source:Project,name:string,camera?:CameraView,thumbnail?:SceneThumbnail):Project{
 if(current.id!==source.id)throw new Error('프로젝트가 바뀌어 Scene 저장을 취소했습니다.');
 const p=parseProject(source),used=new Set(current.scenes.map(s=>s.id));let index=1;
 while(used.has(`scene-${index}`))index++;
 const scene={id:`scene-${index}`,name,artworks:structuredClone(p.artworks),wallVisibility:Object.fromEntries(p.walls.map(w=>[w.id,w.visible])),
  structure:structuredClone({walls:p.walls,openings:p.openings??[],dimensions:p.dimensions??[],unplacedArtworks:p.unplacedArtworks??[],modelArtworks:p.modelArtworks??[],lights:p.lights??[],lighting:p.lighting??DEFAULT_LIGHTING,outdoor:p.outdoor??DEFAULT_OUTDOOR,floorColor:p.floorColor,...(p.floorMaterial?{floorMaterial:p.floorMaterial}:{}),...(p.importedFloor?{importedFloor:p.importedFloor}:{}),...(p.referenceModel?{referenceModel:p.referenceModel}:{})}),
  ...(camera?{cameraView:structuredClone(camera)}:{}),...(thumbnail?{thumbnail:structuredClone(thumbnail)}:{})};
 return parseProject({...current,scenes:[...current.scenes,scene]});
}
