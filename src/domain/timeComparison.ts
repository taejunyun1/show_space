import {parseProject} from './model';
import {DEFAULT_LIGHTING} from './lighting';
import {DEFAULT_OUTDOOR,parseOutdoor,solarPosition} from './outdoor';
import {sceneProject} from './sceneProject';
import type {CameraView,Project,Scene,SceneThumbnail} from './types';

export const DEFAULT_COMPARISON_TIMES=['09:00','13:00','17:00','20:00'];
export interface TimeComparisonOptions {sceneId:string;date:string;times:string[];occurrence:'earlier'|'later'}
export interface TimeComparisonFrame {name:string;project:Project;sun:ReturnType<typeof solarPosition>}
export function timeComparisonSource(project:Project,sceneId:string):Project{
 if(!sceneId)return structuredClone({...project,scenes:[]});
 const scene=project.scenes.find(s=>s.id===sceneId);
 if(!scene)throw new Error('비교할 Scene을 찾지 못했습니다.');
 return sceneProject(project,scene);
}
/** The editor stays untouched: four detached snapshots use identical geometry and light settings. */
export function timeComparisonFrames(project:Project,options:TimeComparisonOptions):TimeComparisonFrame[]{
 if(!Array.isArray(options.times)||options.times.length!==4)throw new Error('비교할 시간 네 개를 선택하세요.');
 const source=timeComparisonSource(project,options.sceneId);
 if(source.planReference&&!source.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 시간대를 비교하세요.');
 const outdoor=source.outdoor??DEFAULT_OUTDOOR;
 // Validate the whole batch before starting any expensive render.
 const settings=options.times.map(time=>parseOutdoor({...outdoor,mode:'outdoor',date:options.date,time,occurrence:options.occurrence}));
 return settings.map(s=>({name:`${s.date} ${s.time}`,project:{...source,outdoor:s},sun:solarPosition(s)}));
}
export function appendTimeComparisonScenes(current:Project,source:Project,options:TimeComparisonOptions,camera?:CameraView,thumbnails?:SceneThumbnail[]):Project{
 if(current.id!==source.id)throw new Error('프로젝트가 바뀌어 시간대 Scene 저장을 취소했습니다.');
 const frames=timeComparisonFrames(source,options),used=new Set(current.scenes.map(s=>s.id));
 let index=1;
 if(thumbnails&&thumbnails.length!==frames.length)throw new Error('네 시간대의 미리보기가 모두 필요합니다.');
 const scenes:Scene[]=frames.map(({name,project:p},frameIndex)=>{
  while(used.has(`scene-${index}`))index++;
  const id=`scene-${index++}`;used.add(id);
  return {id,name:`시간 비교 · ${name}`,artworks:structuredClone(p.artworks),wallVisibility:Object.fromEntries(p.walls.map(w=>[w.id,w.visible])),
   structure:structuredClone({walls:p.walls,openings:p.openings??[],dimensions:p.dimensions??[],unplacedArtworks:p.unplacedArtworks??[],modelArtworks:p.modelArtworks??[],lights:p.lights??[],lighting:p.lighting??DEFAULT_LIGHTING,outdoor:p.outdoor!,floorColor:p.floorColor,...(p.floorMaterial?{floorMaterial:p.floorMaterial}:{}),...(p.importedFloor?{importedFloor:p.importedFloor}:{}),...(p.referenceModel?{referenceModel:p.referenceModel}:{})}),
   ...(camera?{cameraView:structuredClone(camera)}:{}),...(thumbnails?{thumbnail:structuredClone(thumbnails[frameIndex])}:{})};
 });
 return parseProject({...current,scenes:[...current.scenes,...scenes]});
}
