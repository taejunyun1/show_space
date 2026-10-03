import {modelArtworkFootprint} from '../domain/modelArtworks';
import {floorSvgPath} from '../domain/importedFloor';
import {openingSegments} from '../domain/openings';
import {PlanLabelReview,labelNames} from './PlanLabelReview';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X, ZoomIn, ZoomOut, Hand, Maximize } from 'lucide-react';
import { useEditor } from '../state/editor';
import { wallLength, artworkPosition } from '../domain/model';
import { fitPlan } from '../domain/plan';
import {panViewport} from '../lib/viewportPan';
import {calibrateEditableDraft,draftEditSummary,refreshPlanEvidence} from '../domain/editablePlanDraft';
import type { Point } from '../domain/types';
import {snapPlanPoint,type SnapKind} from '../domain/wallEditing';
import {fixedAnchor,wallAnchor} from '../domain/measurements';
import {PlanMeasurements} from './MeasurementOverlay';
import { WallCandidateDialog } from './WallCandidateDialog';
import { PlanImportDialog } from './PlanImportDialog';
export function PlanView({incomingFile,onFileReceived}:{incomingFile?:File|null;onFileReceived?:()=>void}) {
  const { project, previewProject, wallGesture, lightGesture, modelArtworkGesture, activeTool, setTool, measurementDraft, pickMeasurement, selected, select, moveWallEndpoint, drawWall, patchProject, commit, notify, showDimensions, beginWallTransform, updateWallTransform, finishWallTransform } = useEditor();
  const displayed=previewProject??project;
  const svg = useRef<SVGSVGElement>(null), file = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<{ id: string; endpoint: 'start' | 'end'; x: number; z: number; snap:SnapKind } | null>(null);
  const dragRef=useRef<typeof drag>(null);
  const modelDrag=useRef<{pointerId:number;grab:Point}|null>(null);
  const [drawStart,setDrawStart]=useState<Point|null>(null);
  const [drawHover,setDrawHover]=useState<{point:Point;kind:SnapKind}|null>(null);
  const [viewport, setViewport] = useState<{x:number;z:number;width:number;height:number}|null>(null);
  const panMode=activeTool==='pan';
  const pan = useRef<{pointerId:number;clientX:number;clientY:number;x:number;z:number;scale:number;width:number;height:number}|null>(null);
  const [panning,setPanning] = useState(false);
  const [reviewLabels,setReviewLabels]=useState(false);
  const [reviewCandidates,setReviewCandidates]=useState(false);
  const [importFile,setImportFile]=useState<File|null>(null);
  useEffect(()=>{if(incomingFile){setImportFile(incomingFile);onFileReceived?.();}},[incomingFile,onFileReceived]);
  const [calibrating,setCalibrating]=useState(false),[anchors,setAnchors]=useState<Point[]>([]),[realLength,setRealLength]=useState('1000');
  const points = [...project.walls.flatMap(w => [w.start, w.end]),...(project.importedFloor?.flat()??[])];
  const wallMinX=Math.min(...points.map(p=>p.x)), wallMinZ=Math.min(...points.map(p=>p.z));
  const wallWidth=Math.max(...points.map(p=>p.x))-wallMinX;
  const reference=project.planReference;
  const provisional=!!project.planDraft&&!reference?.calibrated;
  const draftEdits=useMemo(()=>project.planDraft?draftEditSummary(project):null,[project]);
  useEffect(()=>{if(activeTool!=='draw'){setDrawStart(null);setDrawHover(null);}},[activeTool]);
  useEffect(()=>{if(activeTool!=='pan'){pan.current=null;setPanning(false);}else{dragRef.current=null;setDrag(null);}},[activeTool]);
  useEffect(()=>{setCalibrating(false);setAnchors([]);setViewport(null);pan.current=null;setPanning(false);dragRef.current=null;setDrag(null);},[reference?.origin.x,reference?.origin.z,reference?.widthPx,reference?.heightPx,reference?.mmPerPixel,reference?.calibrated,project.planImageUrl]);
  const bounds=[...points,...(project.modelArtworks??[]).filter(a=>a.visible).flatMap(modelArtworkFootprint)];
  if(project.planImageUrl&&reference) bounds.push(reference.origin,{x:reference.origin.x+reference.widthPx*reference.mmPerPixel,z:reference.origin.z+reference.heightPx*reference.mmPerPixel});
  const pad=provisional?Math.max(reference?.widthPx??1000,reference?.heightPx??800)*.12:1400;
  const minX=Math.min(...bounds.map(p=>p.x))-pad,minZ=Math.min(...bounds.map(p=>p.z))-pad;
  const width=Math.max(...bounds.map(p=>p.x))-minX+pad,height=Math.max(...bounds.map(p=>p.z))-minZ+pad;
  const view=viewport??{x:minX,z:minZ,width,height};
  const zoom=width/view.width;
  const handleRadius=view.width/Math.max(svg.current?.getBoundingClientRect().width??600,1)*10;
  function changeZoom(factor:number) {
    const nextZoom=Math.max(1,Math.min(16,zoom*factor));
    const nextWidth=width/nextZoom,nextHeight=height/nextZoom;
    setViewport({x:view.x+(view.width-nextWidth)/2,z:view.z+(view.height-nextHeight)/2,width:nextWidth,height:nextHeight});
  }
  function endPointer(e:React.PointerEvent, cancelled=false) {
    if(pan.current?.pointerId===e.pointerId){pan.current=null;setPanning(false);}
    const activeDrag=dragRef.current;dragRef.current=null;
    if(activeDrag&&!cancelled){
      const before=project.walls.find(w=>w.id===activeDrag.id)?.[activeDrag.endpoint];
      if(before&&(before.x!==activeDrag.x||before.z!==activeDrag.z))moveWallEndpoint(activeDrag.id,activeDrag.endpoint,{x:activeDrag.x,z:activeDrag.z});
    }
    if(useEditor.getState().wallGesture)finishWallTransform(cancelled);
    if(useEditor.getState().lightGesture)useEditor.getState().finishLightMove(cancelled);
    if(useEditor.getState().modelArtworkGesture)useEditor.getState().finishModelArtworkTransform(cancelled);modelDrag.current=null;
    setDrag(null);
  }
  function pickCalibration(e:React.PointerEvent) {
    if(panMode||!calibrating||!reference)return;
    const matrix=svg.current?.getScreenCTM()?.inverse(); if(!matrix)return;
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
    const point={x:(p.x-reference.origin.x)/reference.mmPerPixel,z:(p.y-reference.origin.z)/reference.mmPerPixel};
    if(point.x<0||point.z<0||point.x>reference.widthPx||point.z>reference.heightPx){notify('도면 내부의 점을 선택해 주세요.');return;}
    setAnchors(a=>a.length===2?[point]:[...a,point]);
  }
  function pointer(e: React.PointerEvent) {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix);
    return { x: Math.round(pt.x / 10) * 10, z: Math.round(pt.y / 10) * 10 };
  }
  function snapped(e:React.PointerEvent,anchor?:Point,excludeWallId?:string){
    const matrix=svg.current?.getScreenCTM()?.inverse();if(!matrix)return null;
    const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
    const mmPerPx=view.width/Math.max(svg.current?.getBoundingClientRect().width??600,1);
    return snapPlanPoint({x:pt.x,z:pt.y},project.walls.filter(w=>w.id!==excludeWallId),anchor,mmPerPx*12);
  }
  return <div className="drawing-view plan-drawing"><svg ref={svg} viewBox={`${view.x} ${view.z} ${view.width} ${view.height}`} className={`plan-svg${panMode?' pan-mode':''}${panning?' is-panning':''}`} aria-label="전시장 평면도" onPointerDown={e=>{
    if(e.button!==0)return;
    if(panMode){
      const matrix=svg.current?.getScreenCTM();if(!matrix)return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pan.current={pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,x:view.x,z:view.z,scale:matrix.a,width:view.width,height:view.height};
      setPanning(true);return;
    }
    if(activeTool==='draw'&&!calibrating){
      const hit=snapped(e,drawStart??undefined);if(!hit)return;
      if(!drawStart){setDrawStart(hit.point);setDrawHover(hit);return;}
      if(Math.hypot(hit.point.x-drawStart.x,hit.point.z-drawStart.z)<1){notify('두 번째 점을 다른 위치에서 선택해 주세요.');return;}
      const count=useEditor.getState().project.walls.length;
      drawWall(drawStart,hit.point);
      if(useEditor.getState().project.walls.length>count){setDrawStart(hit.point);setDrawHover(hit);}
      return;
    }
    if(activeTool==='measure'&&!calibrating){
      const hit=snapped(e);if(!hit)return;
      const point={x:hit.point.x,y:0,z:hit.point.z};
      const wall=hit.kind==='endpoint'?project.walls.find(w=>[w.start,w.end].some(p=>p.x===point.x&&p.z===point.z)):undefined;
      pickMeasurement(wall?wallAnchor(project,wall.id,point):fixedAnchor(point),'plan');
      return;
    }
    pickCalibration(e);
  }} onPointerMove={e => {
    const activePan=pan.current;
    if(activePan&&activePan.pointerId===e.pointerId){setViewport(panViewport({x:activePan.x,z:activePan.z,width:activePan.width,height:activePan.height},{x:e.clientX-activePan.clientX,y:e.clientY-activePan.clientY},activePan.scale));return;}
    if(activeTool==='draw'&&!panMode&&!calibrating){const hit=snapped(e,drawStart??undefined);if(hit)setDrawHover(hit);}
    if(dragRef.current){const current=dragRef.current;const wall=project.walls.find(w=>w.id===current.id);const hit=snapped(e,wall?.[current.endpoint==='start'?'end':'start'],current.id);if(hit){const next={...current,x:hit.point.x,z:hit.point.z,snap:hit.kind};dragRef.current=next;setDrag(next);}}
    if(wallGesture){const p=pointer(e);if(p)updateWallTransform(p);}
    if(lightGesture){const p=pointer(e),l=lightGesture.base.lights?.find(l=>l.id===lightGesture.id);if(p&&l)useEditor.getState().updateLightMove({...p,y:l.position.y});}
    if(modelArtworkGesture&&modelDrag.current){const p=pointer(e),a=modelArtworkGesture.base.modelArtworks?.find(a=>a.id===modelArtworkGesture.id);if(p&&a)useEditor.getState().updateModelArtworkTransform({...a.position,x:p.x+modelDrag.current.grab.x,z:p.z+modelDrag.current.grab.z},a.rotation);}
  }} onPointerUp={e=>endPointer(e)} onPointerCancel={e=>endPointer(e,true)} onLostPointerCapture={e=>endPointer(e,true)}><defs><pattern id="plan-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#dce1e7" strokeWidth="12" /></pattern></defs><rect x={view.x} y={view.z} width={view.width} height={view.height} fill="url(#plan-grid)" />{project.planImageUrl && <image data-source-plan="true" href={project.planImageUrl} x={reference?.origin.x ?? wallMinX} y={reference?.origin.z ?? wallMinZ} width={reference ? reference.widthPx*reference.mmPerPixel : wallWidth} height={reference ? reference.heightPx*reference.mmPerPixel : height-2800} opacity={project.planOpacity ?? 0.4} preserveAspectRatio="xMinYMin meet" />}{displayed.importedFloor&&<path aria-label="모델 바닥" d={floorSvgPath(displayed.importedFloor)} fill={displayed.floorColor} fillOpacity={.7} fillRule="evenodd" pointerEvents="none"/>}{displayed.walls.filter(w => w.visible).map(w => {
    const start = drag?.id === w.id && drag.endpoint === 'start' ? drag : w.start, end = drag?.id === w.id && drag.endpoint === 'end' ? drag : w.end;
    const isSelected = selected.some(s => s.id === w.id);
    return <g key={w.id}><line x1={start.x} y1={start.z} x2={end.x} y2={end.z} stroke={isSelected ? '#365cf5' : '#697789'} strokeWidth={provisional?Math.max(2,view.width/500):w.thicknessMm} onPointerDown={e=>{if(e.button!==0||panMode||calibrating||(activeTool==='draw'||activeTool==='measure'))return;e.stopPropagation();if(e.shiftKey){select({type:'wall',id:w.id},true);return;}if(w.locked){select({type:'wall',id:w.id});return;}const p=pointer(e);if(!p)return;svg.current?.setPointerCapture(e.pointerId);beginWallTransform(w.id,activeTool==='rotate'?'rotate':'move',p);}} className="selectable" />{showDimensions && <text x={(start.x + end.x) / 2} y={(start.z + end.z) / 2 - (provisional?Math.max(12,view.width/50):270)} textAnchor="middle" className="plan-label" style={provisional?{fontSize:Math.max(12,view.width/80)}:undefined}>{w.name} · {Math.round(wallLength(w)).toLocaleString()} {provisional?'px':''}</text>}{isSelected && !w.locked && activeTool==='select' && (['start', 'end'] as const).map(endpoint => { const p = endpoint === 'start' ? start : end; return <circle key={endpoint} cx={p.x} cy={p.z} r={handleRadius} fill="white" stroke="#365cf5" strokeWidth={handleRadius/5} className="drag-handle" onPointerDown={e => { if(panMode||calibrating)return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); const next={ id: w.id, endpoint, x: p.x, z: p.z,snap:'endpoint' as const };dragRef.current=next;setDrag(next); }} />; })}{isSelected&&!w.locked&&activeTool!=='draw'&&activeTool!=='measure'&&<circle cx={(start.x+end.x)/2-(end.z-start.z)/Math.hypot(end.x-start.x,end.z-start.z)*handleRadius*2.5} cy={(start.z+end.z)/2+(end.x-start.x)/Math.hypot(end.x-start.x,end.z-start.z)*handleRadius*2.5} r={handleRadius} fill="#fff" stroke="#365cf5" strokeWidth={handleRadius/5} className="drag-handle" aria-label={`${w.name} 회전 핸들`} onPointerDown={e=>{if(e.button!==0||panMode||calibrating)return;e.stopPropagation();const p=pointer(e);if(!p)return;svg.current?.setPointerCapture(e.pointerId);beginWallTransform(w.id,'rotate',p);}}/>}</g>;
  })}{drawStart&&drawHover&&<g pointerEvents="none"><line x1={drawStart.x} y1={drawStart.z} x2={drawHover.point.x} y2={drawHover.point.z} stroke="#365cf5" strokeWidth={Math.max(view.width/700,20)} strokeDasharray={`${view.width/130} ${view.width/180}`}/><circle cx={drawStart.x} cy={drawStart.z} r={handleRadius} fill="#365cf5"/><circle cx={drawHover.point.x} cy={drawHover.point.z} r={handleRadius} fill={drawHover.kind==='endpoint'?'#16816b':'#365cf5'} stroke="white" strokeWidth={handleRadius/4}/><text x={(drawStart.x+drawHover.point.x)/2} y={(drawStart.z+drawHover.point.z)/2-view.width/80} textAnchor="middle" className="plan-label">{Math.round(Math.hypot(drawHover.point.x-drawStart.x,drawHover.point.z-drawStart.z)).toLocaleString()} {provisional?'px':'mm'}</text></g>}{drag&&<circle cx={drag.x} cy={drag.z} r={handleRadius*1.35} fill="none" stroke={drag.snap==='endpoint'?'#16816b':'#365cf5'} strokeWidth={handleRadius/3} pointerEvents="none"/>}{openingSegments(displayed).map(o=><g key={o.id} pointerEvents="none"><line x1={o.start.x} y1={o.start.z} x2={o.end.x} y2={o.end.z} stroke="#16816b" strokeWidth={view.width/450} strokeDasharray="100 80"/><text x={(o.start.x+o.end.x)/2} y={(o.start.z+o.end.z)/2} fontSize={view.width/90} fill="#16816b">{o.kind==='door'?'출입구':o.kind==='stair-access'?'계단 통로':'창문'}</text></g>)}{displayed.artworks.filter(a => a.visible).map(a => { const wall = displayed.walls.find(w => w.id === a.wallId); if (!wall?.visible) return null; const p = artworkPosition(a, wall); return <g key={a.id} transform={`translate(${p.x},${p.z}) rotate(${-p.rotationY * 180 / Math.PI})`} onClick={e => !panMode && !calibrating && activeTool!=='draw' && activeTool!=='measure' && select({ type: 'artwork', id: a.id }, e.shiftKey)} className="selectable"><rect x={-a.widthMm / 2} y={-65} width={a.widthMm} height="130" rx="10" fill={selected.some(s => s.id === a.id) ? '#365cf5' : '#c5ad8e'} /><circle r="140" fill="transparent" /></g>; })}{displayed.modelArtworks?.filter(a=>a.visible).map(a=><g key={a.id} className="selectable" onPointerDown={e=>{if(e.button!==0||panMode||calibrating||activeTool==='measure'||activeTool==='draw')return;e.stopPropagation();select({type:'modelArtwork',id:a.id},e.shiftKey);if(e.shiftKey||a.locked||activeTool==='rotate')return;const p=pointer(e);if(!p)return;useEditor.getState().beginModelArtworkTransform(a.id);if(useEditor.getState().modelArtworkGesture){modelDrag.current={pointerId:e.pointerId,grab:{x:a.position.x-p.x,z:a.position.z-p.z}};svg.current?.setPointerCapture(e.pointerId);}}}><polygon aria-label={`${a.name} 3D 작품 평면`} points={modelArtworkFootprint(a).map(p=>`${p.x},${p.z}`).join(' ')} fill={selected.some(s=>s.type==='modelArtwork'&&s.id===a.id)?'#365cf5':'#c5ad8e'} fillOpacity={.65} stroke="#6e5a42" strokeWidth={view.width/900}/><text x={a.position.x} y={a.position.z} textAnchor="middle" className="plan-label" pointerEvents="none">{a.name}</text></g>)}{calibrating&&reference&&<g pointerEvents="none">{anchors.length===2&&<line x1={reference.origin.x+anchors[0].x*reference.mmPerPixel} y1={reference.origin.z+anchors[0].z*reference.mmPerPixel} x2={reference.origin.x+anchors[1].x*reference.mmPerPixel} y2={reference.origin.z+anchors[1].z*reference.mmPerPixel} stroke="#ed5a3c" strokeWidth={view.width/450}/>} {anchors.map((a,i)=><circle key={i} cx={reference.origin.x+a.x*reference.mmPerPixel} cy={reference.origin.z+a.z*reference.mmPerPixel} r={view.width/110} fill="#ed5a3c" stroke="white" strokeWidth={view.width/600}/>)}</g>}{reference&&project.planAnalysis?.stairRegions?.map(r=><g key={r.id} pointerEvents="none"><rect x={reference.origin.x+r.box.x*reference.mmPerPixel} y={reference.origin.z+r.box.y*reference.mmPerPixel} width={r.box.width*reference.mmPerPixel} height={r.box.height*reference.mmPerPixel} fill="#e44b4b" fillOpacity={.25}/><text x={reference.origin.x+r.box.x*reference.mmPerPixel} y={reference.origin.z+r.box.y*reference.mmPerPixel} fontSize={view.width/90} fill="#a22">{r.evidence==='shape'?'계단 추정 · 설치 제외(검출 범위)':'계단 · 설치 제외(검출 범위)'}</text></g>)}{reference&&(project.planLabels??[]).filter(l=>l.status!=='dismissed').map(l=>{const b=l.box;return <g key={l.id} pointerEvents="none"><rect x={reference.origin.x+b.x*reference.mmPerPixel} y={reference.origin.z+b.y*reference.mmPerPixel} width={b.width*reference.mmPerPixel} height={b.height*reference.mmPerPixel} fill="none" stroke={l.status==='confirmed'?'#16816b':'#d16b24'} strokeWidth={view.width/600} strokeDasharray={`${view.width/220} ${view.width/400}`}/><text x={reference.origin.x+b.x*reference.mmPerPixel} y={reference.origin.z+b.y*reference.mmPerPixel-view.width/180} fontSize={view.width/90} fill="#9f4d12" stroke="white" strokeWidth={view.width/1500} paintOrder="stroke">{labelNames[l.kind]} · 표기 위치</text></g>;})}{!provisional&&displayed.lights?.filter(l=>l.visible).map(l=><g key={l.id}><line x1={l.position.x} y1={l.position.z} x2={l.target.x} y2={l.target.z} stroke="#b48324" strokeDasharray="80 60" strokeWidth={view.width/800} pointerEvents="none"/><circle aria-label={`${l.name} 위치`} cx={l.position.x} cy={l.position.z} r={handleRadius} fill={selected.some(s=>s.type==='light'&&s.id===l.id)?'#365cf5':'#e0a837'} stroke="white" strokeWidth={handleRadius/5} className="selectable" onPointerDown={e=>{if(e.button!==0||panMode||calibrating||activeTool==='draw'||activeTool==='measure')return;e.stopPropagation();select({type:'light',id:l.id},e.shiftKey);if(l.locked||e.shiftKey)return;svg.current?.setPointerCapture(e.pointerId);useEditor.getState().beginLightMove(l.id);}}/><text x={l.position.x} y={l.position.z-handleRadius*1.6} textAnchor="middle" className="plan-label" pointerEvents="none">{l.name}</text></g>)}<PlanMeasurements project={displayed} draft={measurementDraft} showDimensions={showDimensions} scale={view.width}/></svg>
  <div className="plan-navigation" role="group" aria-label="도면 확대와 이동">
    <button className="icon-button" aria-label="도면 축소" title="도면 축소" disabled={zoom<=1} onClick={()=>changeZoom(1/1.5)}><ZoomOut size={16}/></button>
    <output aria-label="도면 확대 비율">{Math.round(zoom*100)}%</output>
    <button className="icon-button" aria-label="도면 확대" title="도면 확대" disabled={zoom>=16} onClick={()=>changeZoom(1.5)}><ZoomIn size={16}/></button>
    <button className="icon-button" aria-label="도면 전체 맞춤" title="도면 전체 맞춤" onClick={()=>setViewport(null)}><Maximize size={16}/></button>
    <button className={`plan-pan-toggle${panMode?' active':''}`} aria-pressed={panMode} onClick={()=>{setTool(panMode?'select':'pan');setDrag(null);}}><Hand size={15}/>{panMode?'이동 중':'화면 이동'}</button>
  </div>
  <div className="plan-tools"><button className="button secondary" onClick={()=>file.current?.click()}><ImagePlus size={15}/>도면 불러오기</button>
  {project.planImageUrl&&<><label>투명도<input aria-label="도면 투명도" type="range" min="0" max="1" step="0.05" value={project.planOpacity??0.4} onChange={e=>patchProject({planOpacity:Number(e.target.value)})}/></label>
  {reference&&<button className="button secondary" onClick={()=>setReviewLabels(true)}>설비 표기 ({project.planLabels?.filter(l=>l.status!=='dismissed').length??0})</button>}
  {reference&&<button className="button secondary" onClick={()=>{setReviewCandidates(true);setCalibrating(false);}}>벽 후보 찾기</button>}
  {reference&&<button className="button secondary" onClick={()=>{setCalibrating(!calibrating);setAnchors([]);if(panMode)setTool('select');}}>{calibrating?'보정 취소':'두 점 축척 보정'}</button>}
  {project.sourcePlan&&<a className="button secondary" href={project.sourcePlan.imageUrl} download="원본-도면.png">변환 전 원본 저장</a>}
  <button className="icon-button" aria-label="참고 도면 제거" disabled={provisional} title={provisional?'축척 보정 후 도면을 제거할 수 있습니다.':undefined} onClick={()=>{patchProject({sourcePlan:undefined,planImageUrl:undefined,planReference:undefined,planLabels:undefined,planAnalysis:undefined,planDraft:undefined});setCalibrating(false);setAnchors([]);}}><X size={15}/></button></>}
  <input ref={file} hidden type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f){setImportFile(f);setCalibrating(false);setAnchors([]);}e.currentTarget.value='';}}/></div>
  {calibrating&&<div className="calibration-panel"><strong>{panMode?'화면 이동 중 · 이동 버튼을 끄면 점을 선택할 수 있습니다':anchors.length<2?`도면에서 ${anchors.length===0?'첫 번째':'두 번째'} 점을 선택하세요`:'두 점 사이 실제 길이'}</strong>{anchors.length===2&&<><label><input aria-label="보정 실제 길이" type="number" min="1" value={realLength} onChange={e=>setRealLength(e.target.value)}/> mm</label><button className="button primary" onClick={()=>{try{if(!reference)return;commit(calibrateEditableDraft(project,anchors[0],anchors[1],Number(realLength)));setCalibrating(false);setAnchors([]);notify(project.planDraft?'도면과 벽 좌표를 함께 축척 보정했습니다.':'도면 축척을 보정했습니다. 벽과 작품 크기는 유지됩니다.');}catch(e){notify((e as Error).message);}}}>축척 적용</button></>}<small>{project.planDraft?'도면 편집 초안은 벽 좌표도 함께 실제 길이에 맞춥니다.':'도면 축척만 변경됩니다. 벽 끝점은 도면에 맞춰 이동하세요.'}</small></div>}
  {project.planDraft&&<p className="plan-draft-warning" role="status">{provisional?'축척 미정 · 벽 길이 px.':'축척 보정됨 · 구조선은 아직 후보입니다.'} 후보 {project.planDraft.originalWalls.length} · 수정 {draftEdits?.modified??0} · 추가 {draftEdits?.added??0} · 삭제 {draftEdits?.removed??0}.{provisional?' 실제 치수와 3D는 두 점 축척 보정 후 확인하세요.':' 실제 벽 여부와 바닥 경계는 아직 미확정입니다.'}</p>}
  <p className="canvas-hint">{panMode?'드래그하여 화면 이동':activeTool==='measure'?'줄자: 첫 점과 두 번째 점을 클릭하세요 · T 단축키':activeTool==='draw'?drawStart?'다음 점을 클릭해 벽을 만드세요 · Esc 종료':'시작점을 클릭하세요 · 기존 끝점에 붙습니다':activeTool==='rotate'?'선택한 벽을 함께 회전 · Shift 다중 선택':activeTool==='move'?'선택한 벽을 함께 이동 · Shift 다중 선택':'벽 드래그 이동 · 끝점 길이 조정 · Shift 다중 선택'}{project.planImageUrl?reference?.calibrated?' · 도면 축척 보정됨':' · 축척 미보정':''}</p>
  {reviewLabels&&<PlanLabelReview onClose={()=>setReviewLabels(false)}/>}
  {reviewCandidates&&reference&&project.planImageUrl&&<WallCandidateDialog onClose={()=>setReviewCandidates(false)}/>}
  {importFile&&<PlanImportDialog existingProject={project} onAdopt={draft=>{useEditor.getState().commit(draft);setImportFile(null);notify(draft.planDraft?'벽 후보를 편집 초안으로 적용했습니다. 축척은 미정이며, 이전 작업은 실행 취소로 복원할 수 있습니다.':'자동 공간 초안을 적용했습니다. 높이·두께는 임시값입니다. 실행 취소로 이전 작업을 복원할 수 있습니다.');}} file={importFile} onClose={()=>setImportFile(null)} onImport={image=>{const current=useEditor.getState().project;if(current.planDraft&&!current.planReference?.calibrated&&(current.planImageUrl!==image.imageUrl||current.planReference?.widthPx!==image.widthPx||current.planReference?.heightPx!==image.heightPx)){notify('기존 도면의 px 벽을 유지하려면 먼저 축척을 보정하거나 새 벽 초안을 적용하세요.');return;}if(current.planImageUrl===image.imageUrl&&current.planReference?.widthPx===image.widthPx&&current.planReference?.heightPx===image.heightPx){commit(refreshPlanEvidence(current,image));notify('도면 분석 결과를 갱신했습니다. 편집한 벽·작품과 축척은 유지됩니다.');}else{patchProject({sourcePlan:undefined,planDraft:undefined,planImageUrl:image.imageUrl,planLabels:image.labels??[],planAnalysis:image.analysis,planReference:fitPlan(image.widthPx,image.heightPx,{x:wallMinX,z:wallMinZ},Math.max(wallWidth,1000)),planOpacity:0.55});notify('참고 도면과 인식 결과를 저장했습니다. 기존 벽과 작품은 유지됩니다.');}setImportFile(null);}}/>}
  </div>;
}
