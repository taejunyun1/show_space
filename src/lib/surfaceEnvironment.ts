import {PMREMGenerator,type WebGLRenderer} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
export const SURFACE_ENVIRONMENT_INTENSITY=.35;
export function needsSurfaceEnvironment(project:{floorMaterial?:unknown;walls:readonly {id?:string;visible?:boolean;material?:unknown}[];artworks:readonly {wallId?:string;visible?:boolean;material?:unknown}[]}){return !!project.floorMaterial||project.walls.some(w=>w.visible!==false&&!!w.material)||project.artworks.some(a=>a.visible!==false&&!!a.material&&(!a.wallId||project.walls.some(w=>w.id===a.wallId&&w.visible!==false)));}
/** Neutral reflection lighting only; no network asset, scene geometry, or mirror camera. */
export function surfaceEnvironment(renderer:WebGLRenderer){
 const room=new RoomEnvironment(),generator=new PMREMGenerator(renderer);
 try{const target=generator.fromScene(room,.04);return {texture:target.texture,dispose:()=>target.dispose()};}
 finally{room.dispose();generator.dispose();}
}
