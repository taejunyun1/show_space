import {TransformHandles3D} from './TransformHandles3D';
import {projectorFrame} from '../lib/projectorLighting';
import {useMemo} from 'react';
import {Html,Line} from '@react-three/drei';
import {Matrix4,Quaternion,Vector3} from 'three';
import {useEditor} from '../state/editor';
import type {ExhibitionLight} from '../domain/lighting';
function Marker({light}:{light:ExhibitionLight}){
 const state=useEditor(),selected=state.selected.some(s=>s.type==='light'&&s.id===light.id);
 const rotating=state.activeTool==='rotate';
 const matrix=useMemo(()=>{const position=new Vector3(light.position.x/1000,light.position.y/1000,light.position.z/1000);if(!rotating)return new Matrix4().makeTranslation(...position.toArray());const direction=new Vector3(light.target.x-light.position.x,light.target.y-light.position.y,light.target.z-light.position.z).normalize();return new Matrix4().compose(position,new Quaternion().setFromUnitVectors(new Vector3(0,0,-1),direction),new Vector3(1,1,1));},[rotating,light.position.x,light.position.y,light.position.z,light.target.x,light.target.y,light.target.z]);
 const point=(p:ExhibitionLight['position']):[number,number,number]=>[p.x/1000,p.y/1000,p.z/1000];
 return <><group name={`light-marker-${light.id}`} position={point(light.position)} onPointerDown={e=>{if(e.button!==0||state.activeTool==='pan'||state.activeTool==='measure')return;e.stopPropagation();state.select({type:'light',id:light.id},e.shiftKey);}}><mesh>{light.projection?<boxGeometry args={[.25,.12,.18]}/>:<sphereGeometry args={[.1,12,12]}/>}<meshBasicMaterial color={selected?'#365cf5':'#e0a837'}/></mesh>{selected&&<Html center position={[0,.22,0]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label">{light.name}</span></Html>}</group>
 {selected&&light.projection&&<Line points={projectorFrame(light)} color="#365cf5" dashed dashSize={.08} gapSize={.06}/>}
 {selected&&<><Line points={[point(light.position),point(light.target)]} color="#e0a837" dashed dashSize={.08} gapSize={.06}/><mesh position={point(light.target)}><sphereGeometry args={[.045,8,8]}/><meshBasicMaterial color="#e0a837"/></mesh></>}
 {selected&&!light.locked&&state.selected.length===1&&['select','move','rotate'].includes(state.activeTool)&&<TransformHandles3D kind="light" id={light.id} matrix={matrix} mode={rotating?'rotate':'move'} onStart={()=>useEditor.getState().beginLightMove(light.id)} onChange={world=>{const p=new Vector3().setFromMatrixPosition(world),current=useEditor.getState();if(!rotating){current.updateLightMove({x:p.x*1000,y:p.y*1000,z:p.z*1000});return;}const original=current.lightGesture?.base.lights?.find(l=>l.id===light.id);if(!original)return;const distance=Math.hypot(original.target.x-original.position.x,original.target.y-original.position.y,original.target.z-original.position.z)/1000,target=new Vector3(0,0,-distance).applyQuaternion(new Quaternion().setFromRotationMatrix(world)).add(p);current.updateLightAim({x:target.x*1000,y:target.y*1000,z:target.z*1000});}} onFinish={()=>useEditor.getState().finishLightMove()}/>}</>;
}
export function LightMarkers3D(){const state=useEditor(),project=state.previewProject??state.project;if(state.captureClean)return null;return <>{project.lights?.filter(l=>l.visible).map(l=><Marker key={l.id} light={l}/>)}</>;}
