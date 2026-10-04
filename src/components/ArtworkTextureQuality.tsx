import {createContext,useContext,useRef,useState,type ReactNode} from 'react';
import {useFrame} from '@react-three/fiber';
import {Vector3,type Object3D} from 'three';
import {allocateArtworkTextures,stageArtworkTextureSizes,type TextureRequest} from '../lib/artworkTextureLod';
const Tiers=createContext<Map<string,number>>(new Map());
export function useArtworkTextureSize(id:string){return useContext(Tiers).get(id)??128;}
export type ArtworkTextureRequest={id:string;key:string;width:number;height:number;selected:boolean};
function visible(o:Object3D){for(let p:Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;}

/** View-only image derivatives. No mutation of assets, Scene, dimensions or exports. */
export function ArtworkTextureQuality({children}:{children:ReactNode}){
 const [tiers,setTiers]=useState(new Map<string,number>()),allocated=useRef(new Map<string,number>()),point=useRef(new Vector3());
 useFrame(({scene,camera,size,gl,invalidate})=>{
  camera.updateMatrixWorld();const requests:TextureRequest[]=[],objects:Object3D[]=[];
  scene.traverse(o=>{
   const r=o.userData.artworkTextureRequest as ArtworkTextureRequest|undefined;if(!r)return;objects.push(o);o.updateWorldMatrix(true,false);
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const x of [-r.width/2,r.width/2])for(const y of [-r.height/2,r.height/2]){
    const p=point.current.set(x,y,0).applyMatrix4(o.matrixWorld).project(camera);
    minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
   }
   const inView=visible(o)&&maxX>=-1&&minX<=1&&maxY>=-1&&minY<=1&&maxZ>=-1&&minZ<=1;
   const scale=Number(scene.userData.artworkCaptureScale)||gl.getPixelRatio();
   requests.push({id:r.id,key:r.key,visible:inView,selected:r.selected,pixels:Math.max((maxX-minX)*size.width/2,(maxY-minY)*size.height/2)*scale,previous:allocated.current.get(r.id)});
  });
  const result=allocateArtworkTextures(requests);
  const staged=stageArtworkTextureSizes(result.sizes,new Map(objects.map(o=>[o.userData.artworkTextureRequest.id,o.userData.artworkTextureAppliedSize??128])));
  const changed=staged.size!==allocated.current.size||[...staged].some(([id,edge])=>allocated.current.get(id)!==edge);
  scene.userData.artworkTextureBudgetBytes=result.bytes;
  scene.userData.artworkTextureLodReady=!changed&&objects.every(o=>o.userData.artworkTextureSize===result.sizes.get(o.userData.artworkTextureRequest.id)&&o.userData.artworkTextureReady);
  if(changed){allocated.current=staged;setTiers(staged);invalidate();}
 });
 return <Tiers.Provider value={tiers}>{children}</Tiers.Provider>;
}
