import type {FrameSettings} from '../domain/artworkPresentation';
import {Color,PMREMGenerator,Scene,type WebGLRenderer} from 'three';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import {outdoorAppearance,type OutdoorSettings} from '../domain/outdoor';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
export const SURFACE_ENVIRONMENT_INTENSITY=.35;
export function needsSurfaceEnvironment(project:{referenceModel?:{scale:number;visible?:boolean};modelArtworks?:readonly {id?:string;visible?:boolean}[];floorMaterial?:unknown;walls:readonly {id?:string;visible?:boolean;material?:unknown}[];artworks:readonly {wallId?:string;visible?:boolean;material?:unknown;frame?:string;frameSettings?:FrameSettings}[]}){return !!project.referenceModel&&project.referenceModel.visible!==false||!!project.modelArtworks?.some(a=>a.visible!==false)||!!project.floorMaterial||project.walls.some(w=>w.visible!==false&&!!w.material)||project.artworks.some(a=>a.visible!==false&&(!!a.material||(a.frame!=='none'&&!!a.frameSettings&&(a.frameSettings.cover!=='none'||a.frameSettings.material==='metal')))&&(!a.wallId||project.walls.some(w=>w.id===a.wallId&&w.visible!==false)));}
/** Neutral reflection lighting only; no network asset, scene geometry, or mirror camera. */
export function surfaceEnvironment(renderer:WebGLRenderer,outdoor?:OutdoorSettings){
 const appearance=outdoorAppearance(outdoor);
 if(appearance){
  const generator=new PMREMGenerator(renderer),scene=new Scene();scene.background=new Color(appearance.background);let sky:Sky|undefined;
  if(appearance.sun.elevation>0){sky=new Sky();sky.scale.setScalar(1000);const uniforms=sky.material.uniforms;uniforms.sunPosition.value.set(...appearance.sun.direction);uniforms.turbidity.value=outdoor?.preset==='cloudy'?20:3;uniforms.rayleigh.value=2;scene.add(sky);}
  try{const target=generator.fromScene(scene,.04,.1,2000);return {texture:target.texture,dispose:()=>target.dispose()};}
  finally{sky?.geometry.dispose();sky?.material.dispose();generator.dispose();}
 }
 const room=new RoomEnvironment(),generator=new PMREMGenerator(renderer);
 try{const target=generator.fromScene(room,.04);return {texture:target.texture,dispose:()=>target.dispose()};}
 finally{room.dispose();generator.dispose();}
}
