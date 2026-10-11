import {useLayoutEffect,useRef} from 'react';
import {useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {Matrix4,type OrthographicCamera,type PerspectiveCamera,Plane,Quaternion,Vector3,type Group,type Ray} from 'three';
import {useEditor} from '../state/editor';
import {useEditorPointer} from './useEditorPointer';

type Kind='model'|'light';
type Drag={base:Matrix4;origin:Vector3;axis:Vector3;startOffset:number;startVector:Vector3|null};
const axes=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)];
const colors=['#ff2060','#20df80','#2080ff'];
/** Closest point on an infinite axis. Parallel rays have no useful drag offset. */
function axisOffset(ray:Ray,origin:Vector3,axis:Vector3){
 const dot=axis.dot(ray.direction),denominator=1-dot*dot;if(denominator<1e-8)return null;
 const relative=ray.origin.clone().sub(origin);return (relative.dot(axis)-relative.dot(ray.direction)*dot)/denominator;
}
function rotationVector(ray:Ray,origin:Vector3,axis:Vector3){
 const hit=ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(axis,origin),new Vector3());
 if(!hit)return null;const v=hit.sub(origin);return v.lengthSq()>1e-10?v.normalize():null;
}
/** Fixed-size Three handles with an owned pointer, final release ray and one Undo. */
export function TransformHandles3D({kind,id,matrix,mode,onStart,onChange,onFinish}:{kind:Kind;id:string;matrix:Matrix4;mode:'move'|'rotate';onStart:()=>void;onChange:(world:Matrix4,direction:Vector3,bypass:boolean)=>void;onFinish:()=>void}){
 const project=useEditor(s=>s.project),{camera,size}=useThree();
 const scaleGroup=useRef<Group>(null),drag=useRef<Drag|null>(null);
 const owned=useEditorPointer(()=>{drag.current=null;});
 function updateScale(){
  if(!scaleGroup.current)return;
  const origin=new Vector3().setFromMatrixPosition(matrix);
  const ortho=camera as OrthographicCamera,perspective=camera as PerspectiveCamera;
  const worldHeight=ortho.isOrthographicCamera?(ortho.top-ortho.bottom)/ortho.zoom:perspective.isPerspectiveCamera?2*origin.distanceTo(camera.getWorldPosition(new Vector3()))*Math.tan(perspective.fov*Math.PI/360)/perspective.zoom:1;
  scaleGroup.current.scale.setScalar(Math.max(.001,worldHeight/Math.max(1,size.height)*75));
 }
 useLayoutEffect(updateScale,[matrix,camera,size.height]);useFrame(updateScale);
 function begin(e:ThreeEvent<PointerEvent>,axisIndex:number){
  e.stopPropagation();const state=useEditor.getState();
  const selected=state.selected.filter(s=>s.type===(kind==='model'?'modelArtwork':'light'));
  if(e.button!==0||owned.foreign(e.pointerId)||state.project!==project||state.view!=='3d'||state.captureClean||selected[0]?.id!==id||(kind==='light'&&state.selected.length!==1)||!['select','move','rotate'].includes(state.activeTool)||(state.activeTool==='rotate'?'rotate':'move')!==mode)return;
  const base=matrix.clone(),origin=new Vector3().setFromMatrixPosition(base),axis=axes[axisIndex].clone().applyQuaternion(new Quaternion().setFromRotationMatrix(base)).normalize();
  const startOffset=axisOffset(e.ray,origin,axis),startVector=mode==='rotate'?rotationVector(e.ray,origin,axis):null;
  if(mode==='move'?startOffset===null:!startVector)return;
  owned.cancel();const before=kind==='model'?state.modelArtworkGesture?.ids:state.lightGesture;
  onStart();const next=useEditor.getState(),token=kind==='model'?next.modelArtworkGesture?.ids:next.lightGesture;
  if(!token||token===before||!owned.begin(kind,e.pointerId,e.target as Element))return;
  drag.current={base,origin,axis,startOffset:startOffset??0,startVector};(e.target as Element).setPointerCapture(e.pointerId);
 }
 function moving(e:ThreeEvent<PointerEvent>){
  if(!owned.owns(e.pointerId)||!drag.current)return;e.stopPropagation();const d=drag.current;
  const position=d.origin.clone(),q=new Quaternion(),scale=new Vector3();d.base.decompose(new Vector3(),q,scale);
  if(mode==='move'){
   const offset=axisOffset(e.ray,d.origin,d.axis);if(offset===null)return;position.addScaledVector(d.axis,offset-d.startOffset);
  }else{
   const vector=rotationVector(e.ray,d.origin,d.axis);if(!vector||!d.startVector)return;
   let angle=Math.atan2(d.axis.dot(d.startVector.clone().cross(vector)),d.startVector.dot(vector));if(e.shiftKey)angle=Math.round(angle/(Math.PI/18))*Math.PI/18;
   q.premultiply(new Quaternion().setFromAxisAngle(d.axis,angle));
  }
  onChange(new Matrix4().compose(position,q,scale),d.axis,e.altKey);
 }
 function finish(e:ThreeEvent<PointerEvent>,cancel=false){
  if(!owned.owns(e.pointerId))return;e.stopPropagation();if(cancel){owned.cancel();return;}
  moving(e);owned.complete();onFinish();
 }
 const userData=kind==='model'?{modelArtworkHandle:true}:{lightMoveHandle:true};
 return <group matrix={matrix} matrixAutoUpdate={false}><group ref={scaleGroup}>{axes.map((axis,i)=>{
  const quaternion=new Quaternion().setFromUnitVectors(mode==='move'?new Vector3(0,1,0):new Vector3(0,0,1),axis);
  return <group key={i} quaternion={quaternion.toArray()} onPointerDown={e=>begin(e,i)} onPointerMove={moving} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)} onClick={e=>e.stopPropagation()}>
   {mode==='move'?<><mesh position={[0,.4,0]} userData={userData} renderOrder={1000}><cylinderGeometry args={[.07,.07,.8,12]}/><meshBasicMaterial color={colors[i]} depthTest={false} transparent opacity={.85}/></mesh><mesh position={[0,.9,0]} userData={userData} renderOrder={1000}><coneGeometry args={[.13,.2,16]}/><meshBasicMaterial color={colors[i]} depthTest={false}/></mesh></>:<mesh userData={userData} renderOrder={1000}><torusGeometry args={[.65,.045,8,64]}/><meshBasicMaterial color={colors[i]} depthTest={false} transparent opacity={.9}/></mesh>}
  </group>;
 })}</group></group>;
}
