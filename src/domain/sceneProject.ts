import type {Project,Scene} from './types';

/** A detached Scene projection for exports and sharing; never restores the editor. */
export function sceneProject(project:Project,scene:Scene):Project{
 const result=structuredClone({...project,scenes:[]});
 if(scene.structure){
  Object.assign(result,structuredClone(scene.structure));
  if(scene.structure.lights!==undefined)result.lighting=scene.structure.lighting?structuredClone(scene.structure.lighting):undefined;
  if(scene.structure.floorColor!==undefined)result.floorMaterial=scene.structure.floorMaterial?structuredClone(scene.structure.floorMaterial):undefined;
  result.referenceModel=scene.structure.referenceModel?structuredClone(scene.structure.referenceModel):undefined;
  result.importedFloor=scene.structure.importedFloor?structuredClone(scene.structure.importedFloor):undefined;
 }else result.walls=result.walls.map(w=>({...w,visible:scene.wallVisibility[w.id]??w.visible}));
 const wallIds=new Set(result.walls.map(w=>w.id));
 result.artworks=structuredClone(scene.artworks.filter(a=>wallIds.has(a.wallId)));
 return result;
}
