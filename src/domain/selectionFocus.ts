import {Euler,Vector3} from 'three';
import {artworkPosition,wallLength} from './model';
import {artworkPresentation,artworkFaceBounds} from './artworkPresentation';
import {modelArtworkCorners} from './modelArtworks';
import type {EntitySelection,Project,WorldPoint} from './types';
import type {ViewportBox} from '../lib/viewportPan';

/** Stored physical corners in mm; hidden or deleted objects never alter visibility. */
export function selectionFocusPoints(project:Project,selection:EntitySelection[]):WorldPoint[]{
 const points:WorldPoint[]=[];
 for(const s of selection){
  if(s.type==='wall'){
   const w=project.walls.find(w=>w.id===s.id&&w.visible);if(!w)continue;
   const length=wallLength(w);if(!length)continue;
   const nx=-(w.end.z-w.start.z)/length,nz=(w.end.x-w.start.x)/length;
   for(const p of [w.start,w.end])for(const side of [-1,1])for(const y of [0,w.heightMm])points.push({x:p.x+nx*w.thicknessMm/2*side,y,z:p.z+nz*w.thicknessMm/2*side});
  }else if(s.type==='artwork'){
   const a=project.artworks.find(a=>a.id===s.id&&a.visible),w=a&&project.walls.find(w=>w.id===a.wallId&&w.visible);if(!a||!w)continue;
   const pose=artworkPosition(a,w),size=artworkPresentation(a),rotation=new Euler(0,pose.rotationY,(a.rotationDeg??0)*Math.PI/180,'XYZ');
   for(const x of [-size.widthMm/2,size.widthMm/2])for(const y of [-size.heightMm/2,size.heightMm/2])for(const z of [-size.depthMm/2,size.depthMm/2]){const p=new Vector3(x,y,z).applyEuler(rotation);points.push({x:p.x+pose.x,y:p.y+pose.y,z:p.z+pose.z});}
  }else if(s.type==='modelArtwork'){
   const a=project.modelArtworks?.find(a=>a.id===s.id&&a.visible);if(a)points.push(...modelArtworkCorners(a));
  }else{
   const l=project.lights?.find(l=>l.id===s.id&&l.visible);if(l){const extent=l.projection?{x:125,y:60,z:90}:{x:100,y:100,z:100};for(const x of [-extent.x,extent.x])for(const y of [-extent.y,extent.y])for(const z of [-extent.z,extent.z])points.push({x:l.position.x+x,y:l.position.y+y,z:l.position.z+z});}
  }
 }
 return points;
}

/** SVG view box remains in its own units, including an uncalibrated plan's px. */
export function fitFocusViewport(points:Array<{x:number;z:number}>,viewport:{width:number;height:number},minimumSpan=100):ViewportBox|null{
 if(!points.length)return null;
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
 const aspect=Math.max(.01,viewport.width/Math.max(1,viewport.height));
 let width=Math.max(minimumSpan,maxX-minX)*1.25,height=Math.max(minimumSpan,maxZ-minZ)*1.25;
 if(width/height<aspect)width=height*aspect;else height=width/aspect;
 return {x:(minX+maxX-width)/2,z:(minZ+maxZ-height)/2,width,height};
}

/** A wall-face drawing frames the first selected face, without mixing incompatible faces. */
export function elevationFocus(project:Project,selection:EntitySelection[],viewport:{width:number;height:number}){
 const a=selection.flatMap(s=>s.type==='artwork'?project.artworks.filter(a=>a.id===s.id&&a.visible&&project.walls.some(w=>w.id===a.wallId&&w.visible)):[])[0];
 const wall=project.walls.find(w=>w.visible&&w.id===(a?.wallId??selection.find(s=>s.type==='wall')?.id));
 if(!wall)return null;
 const side=a?.wallSide??'front',length=wallLength(wall),points:Array<{x:number;z:number}>=[];
 if(selection.some(s=>s.type==='wall'&&s.id===wall.id))points.push({x:0,z:0},{x:length,z:wall.heightMm});
 for(const s of selection){const art=project.artworks.find(a=>s.type==='artwork'&&a.id===s.id&&a.visible&&a.wallId===wall.id&&(a.wallSide??'front')===side);if(!art)continue;const b=artworkFaceBounds(art);points.push({x:side==='back'?length-b.right:b.left,z:wall.heightMm-b.top},{x:side==='back'?length-b.left:b.right,z:wall.heightMm-b.bottom});}
 const view=fitFocusViewport(points,viewport);return view?{wallId:wall.id,side,view}:null;
}
