import {Line} from '@react-three/drei';
import {useEditor} from '../state/editor';
import {artworkPosition} from '../domain/model';
export function ArtworkSnapGuides3D(){
 const {previewProject,artworkGesture,captureClean}=useEditor();
 const a=previewProject?.artworks.find(a=>a.id===artworkGesture?.id),wall=previewProject?.walls.find(w=>w.id===a?.wallId);
 if(captureClean||!a||!wall||!artworkGesture?.guides?.length)return null;
 const point=(alongMm:number,centerHeightMm:number):[number,number,number]=>{const p=artworkPosition({...a,alongMm,centerHeightMm},wall);return [p.x/1000,p.y/1000,p.z/1000];};
 const length=Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z);
 return <group name="artwork-snap-guides">{artworkGesture.guides.map(g=><Line key={g.axis} points={g.axis==='along'?[point(g.atMm,0),point(g.atMm,wall.heightMm)]:[point(0,g.atMm),point(length,g.atMm)]} color="#16816b" lineWidth={2} dashed dashSize={.12} gapSize={.06} raycast={()=>null}/>)}</group>;
}
