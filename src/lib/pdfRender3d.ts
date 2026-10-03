import {createSceneLighting,disposeLighting} from './sceneLighting';
import {ACESFilmicToneMapping,SRGBColorSpace,PCFSoftShadowMap,Box3,Color,Mesh,OrthographicCamera,PerspectiveCamera,Vector3,WebGLRenderer,type Scene} from 'three';
import {createStandardView} from '../components/cameraView3d';
import {prepareExportScene} from './modelExport';
import {disposeExportScene} from './exportScene';
import {needsSurfaceEnvironment,surfaceEnvironment,SURFACE_ENVIRONMENT_INTENSITY} from './surfaceEnvironment';
import type {CameraView} from '../domain/types';
import type {PdfSection} from './pdfLayout';
export interface PdfCurrentCamera {view:CameraView;width:number;height:number;cutaway:boolean}

/** Render a detached snapshot, leaving selection, project, Undo and live camera untouched. */
export async function renderPdf3d(section:PdfSection,current?:PdfCurrentCamera):Promise<Uint8Array>{
 const source=section.current?current:undefined,longEdge=source?Math.max(source.width,source.height):1920;
 const width=source?Math.max(1,Math.round(1920*source.width/longEdge)):1920,height=source?Math.max(1,Math.round(1920*source.height/longEdge)):1200;
 const scene=await prepareExportScene(section.project) as Scene;let renderer:WebGLRenderer|undefined,environment:ReturnType<typeof surfaceEnvironment>|undefined;
 try{
  const view=source?.view??section.camera??createStandardView(section.project,'bird',{width,height});
  const camera=view.projection==='perspective'?new PerspectiveCamera(view.fov??50,width/height,.02,10000):new OrthographicCamera(-(source?.width??width)/2,(source?.width??width)/2,(source?.height??height)/2,-(source?.height??height)/2,.01,10000);
  camera.position.set(...view.position);camera.lookAt(new Vector3(...view.target));camera.zoom=view.zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  // A Scene remembers direction, but not the old browser's viewport. Fit that direction.
  if(section.camera&&!source&&camera instanceof OrthographicCamera){
   const box=new Box3().setFromObject(scene),center=box.getCenter(new Vector3()),offset=camera.position.clone().sub(new Vector3(...view.target));camera.position.copy(center.clone().add(offset));camera.lookAt(center);camera.zoom=1;camera.updateMatrixWorld(true);
   let extentX=1,extentY=1;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);extentX=Math.max(extentX,Math.abs(p.x));extentY=Math.max(extentY,Math.abs(p.y));}
   camera.zoom=Math.min(width/(extentX*2),height/(extentY*2))*.8;camera.updateProjectionMatrix();
  }
  const cutaway=source?.cutaway??true;
  const hidden=new Set<string>();
  if(cutaway&&camera instanceof OrthographicCamera)for(const wall of section.project.walls){const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;if(wall.role!=='partition'&&-dz*(camera.position.x-(wall.start.x+wall.end.x)/2000)+dx*(camera.position.z-(wall.start.z+wall.end.z)/2000)<=0){const object=scene.getObjectByName(`wall-${wall.id}`);if(object)object.visible=false;hidden.add(wall.id);}}
  for(const art of section.project.artworks)if(hidden.has(art.wallId)){const object=scene.getObjectByName(`artwork-${art.id}`);if(object)object.visible=false;}
  scene.background=new Color('#e9edf1');const exported=scene.getObjectByName('gonggan-lighting');if(exported){scene.remove(exported);disposeLighting(exported);}scene.add(createSceneLighting(section.project));
  scene.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;}});
  renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.toneMapping=ACESFilmicToneMapping;renderer.outputColorSpace=SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFSoftShadowMap;renderer.setSize(width,height,false);renderer.setPixelRatio(1);if(needsSurfaceEnvironment(section.project)){environment=surfaceEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=section.project.lighting?.environment??SURFACE_ENVIRONMENT_INTENSITY;}renderer.render(scene,camera);
  const blob=await new Promise<Blob>((resolve,reject)=>renderer!.domElement.toBlob(b=>b?resolve(b):reject(new Error('PDF 3D 이미지를 만들지 못했습니다.')),'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
 }finally{environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();disposeExportScene(scene);}
}
