import {RepeatWrapping,SRGBColorSpace,NoColorSpace,type BufferGeometry,type Texture} from 'three';
import type {SurfaceTexture} from '../domain/surfaceTexture';
/** Each UV unit is one meter. All six box faces retain the requested texel scale. */
export function wallMetricUv<T extends BufferGeometry>(geometry:T){
 geometry.computeBoundingBox();const box=geometry.boundingBox!,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)-box.min.x,y=p.getY(i)-box.min.y,z=p.getZ(i)-box.min.z;
  if(Math.abs(n.getX(i))>.5)uv.setXY(i,z,y);
  else if(Math.abs(n.getY(i))>.5)uv.setXY(i,x,z);
  else uv.setXY(i,x,y);
 }
 uv.needsUpdate=true;return geometry;
}
/** Floor pattern stays at world X/-Z, across disconnected rooms and courtyard holes. */
export function floorMetricUv<T extends BufferGeometry>(geometry:T,shapeYSign:1|-1=-1){
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=shapeYSign*p.getY(i),height=-p.getZ(i);
  if(Math.abs(n.getZ(i))>.5)uv.setXY(i,x,y);
  else if(Math.abs(n.getX(i))>.5)uv.setXY(i,y,height);
  else uv.setXY(i,x,height);
 }
 uv.needsUpdate=true;return geometry;
}
export function repeatingSurfaceTexture(source:Texture,size:Pick<SurfaceTexture,'widthMm'|'heightMm'>){
 const texture=source.clone();texture.colorSpace=SRGBColorSpace;texture.wrapS=texture.wrapT=RepeatWrapping;
 texture.repeat.set(1000/size.widthMm,1000/size.heightMm);texture.needsUpdate=true;return texture;
}
/** Normal vectors are linear data; artwork UVs are 0..1 rather than metric UVs. */
export function repeatingNormalTexture(source:Texture,size:Pick<SurfaceTexture,'widthMm'|'heightMm'>,extentM:readonly [number,number]=[1,1]){
 const texture=repeatingSurfaceTexture(source,size);texture.colorSpace=NoColorSpace;
 texture.repeat.set(extentM[0]*1000/size.widthMm,extentM[1]*1000/size.heightMm);return texture;
}
