import type {CameraView,Project} from './types';
import {sceneProject} from './sceneProject';
import {createReadonlyLayout} from './publicShare';

/** A detached, local viewing layout. No publication, credential or editor restoration. */
export function presentationLayout(project:Project,sceneId:string|null,currentCamera?:CameraView){
 const scene=sceneId===null?undefined:project.scenes.find(s=>s.id===sceneId);
 if(sceneId!==null&&!scene)throw new Error('발표할 Scene을 찾지 못했습니다.');
 const source=scene?sceneProject(project,scene):structuredClone({...project,scenes:[]});
 const models=new Map<string,string>(),ids=new Map<string,string>(),modelIds=new Map<string,string>();
 function register(url:string){let id=modelIds.get(url);if(!id){id=(modelIds.size+1).toString(16).padStart(64,'0');modelIds.set(url,id);models.set(id,url);}return id;}
 const referenceAssetId=source.referenceModel?.visible?register(source.referenceModel.dataUrl):undefined;
 for(const art of source.modelArtworks??[])if(art.visible)ids.set(art.id,register(art.model.dataUrl));
 const videos=new Map<string,string>(),videoIds=new Map<string,string>(),sources=new Map<string,string>();
 for(const art of source.artworks)if(art.visible&&source.walls.some(w=>w.id===art.wallId&&w.visible)&&art.video){let id=sources.get(art.video.dataUrl);if(!id){id=(sources.size+1).toString(16).padStart(64,'0');sources.set(art.video.dataUrl,id);videos.set(id,art.video.dataUrl);}videoIds.set(art.id,id);}
 const camera=scene?scene.cameraView:currentCamera;
 const {snapshot,uploads}=createReadonlyLayout(source,{includeDimensions:true,includeArtworkDetails:true,camera:camera?structuredClone(camera):undefined,referenceAssetId,modelAssetIds:ids,videoAssetIds:videoIds});
 return {snapshot,images:new Map(uploads.map(u=>[u.imageId,u.sourceUrl ])),models,videos};
}

export function adjacentPresentationScene(ids:readonly string[],current:string|null,step:-1|1):string|null{
 const index=current===null?0:ids.indexOf(current)+1;
 const next=Math.max(0,Math.min(ids.length,index+step));
 return next===0?null:ids[next-1];
}
