import {projectorFrame} from '../lib/projectorLighting';
import {useEffect,useMemo} from 'react';
import {Html,Line,PivotControls} from '@react-three/drei';
import {Matrix4,Vector3} from 'three';
import {useEditor} from '../state/editor';
import type {ExhibitionLight} from '../domain/lighting';
function Marker({light}:{light:ExhibitionLight}){
 const state=useEditor(),selected=state.selected.some(s=>s.type==='light'&&s.id===light.id);
 const matrix=useMemo(()=>new Matrix4().makeTranslation(light.position.x/1000,light.position.y/1000,light.position.z/1000),[light.position.x,light.position.y,light.position.z]);
 useEffect(()=>()=>{if(useEditor.getState().lightGesture?.id===light.id)useEditor.getState().finishLightMove(true);},[light.id]);
 const point=(p:ExhibitionLight['position']):[number,number,number]=>[p.x/1000,p.y/1000,p.z/1000];
 return <><group name={`light-marker-${light.id}`} position={point(light.position)} onPointerDown={e=>{if(state.activeTool==='pan'||state.activeTool==='measure')return;e.stopPropagation();state.select({type:'light',id:light.id},e.shiftKey);}}><mesh>{light.projection?<boxGeometry args={[.25,.12,.18]}/>:<sphereGeometry args={[.1,12,12]}/>}<meshBasicMaterial color={selected?'#365cf5':'#e0a837'}/></mesh>{selected&&<Html center position={[0,.22,0]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label">{light.name}</span></Html>}</group>
 {selected&&light.projection&&<Line points={projectorFrame(light)} color="#365cf5" dashed dashSize={.08} gapSize={.06}/>}
 {selected&&<><Line points={[point(light.position),point(light.target)]} color="#e0a837" dashed dashSize={.08} gapSize={.06}/><mesh position={point(light.target)}><sphereGeometry args={[.045,8,8]}/><meshBasicMaterial color="#e0a837"/></mesh></>}
 {selected&&!light.locked&&state.selected.length===1&&(state.activeTool==='select'||state.activeTool==='move')&&<PivotControls matrix={matrix} autoTransform={false} fixed scale={65} depthTest={false} disableRotations disableScaling disableSliders userData={{lightMoveHandle:true}} onDragStart={()=>state.beginLightMove(light.id)} onDrag={(_local,_delta,world)=>{if(useEditor.getState().lightGesture?.id===light.id){const p=new Vector3().setFromMatrixPosition(world);state.updateLightMove({x:p.x*1000,y:p.y*1000,z:p.z*1000});}}} onDragEnd={()=>state.finishLightMove()}/>}</>;
}
export function LightMarkers3D(){const state=useEditor(),project=state.previewProject??state.project;if(state.captureClean)return null;return <>{project.lights?.filter(l=>l.visible).map(l=><Marker key={l.id} light={l}/>)}</>;}
