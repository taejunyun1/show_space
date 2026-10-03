import {OrthographicCamera,Vector3} from 'three';
import type {CameraView} from '../domain/types';
/** Fit the object's bounds, without venue-sized margins or a floor affecting the framing. */
export function artworkLibraryThumbnailView(dimensions:[number,number,number],edge=256):CameraView{
 const [w,h,d]=dimensions.map(n=>n/1000),target:[number,number,number]=[0,h/2,0],span=Math.max(w,h,d,1);
 const position:[number,number,number]=[-span,h/2+span*1.5,span];
 const camera=new OrthographicCamera(-edge/2,edge/2,edge/2,-edge/2,.01,10000);camera.position.set(...position);camera.lookAt(new Vector3(...target));camera.updateMatrixWorld(true);
 let extentX=0,extentY=0;
 for(const x of [-w/2,w/2])for(const y of [0,h])for(const z of [-d/2,d/2]){const point=new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);extentX=Math.max(extentX,Math.abs(point.x));extentY=Math.max(extentY,Math.abs(point.y));}
 return {projection:'orthographic',position,target,zoom:edge*.85/(2*Math.max(extentX,extentY))};
}
