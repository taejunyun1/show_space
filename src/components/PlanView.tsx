import {PlanLabelReview,labelNames} from './PlanLabelReview';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, ZoomIn, ZoomOut, Hand, Maximize } from 'lucide-react';
import { useEditor } from '../state/editor';
import { wallLength, artworkPosition } from '../domain/model';
import { fitPlan, calibratePlan } from '../domain/plan';
import type { Point } from '../domain/types';
import { WallCandidateDialog } from './WallCandidateDialog';
import { PlanImportDialog } from './PlanImportDialog';
export function PlanView() {
  const { project, selected, select, patchWall, patchProject, notify, showDimensions } = useEditor();
  const svg = useRef<SVGSVGElement>(null), file = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<{ id: string; endpoint: 'start' | 'end'; x: number; z: number } | null>(null);
  const [viewport, setViewport] = useState<{x:number;z:number;width:number;height:number}|null>(null);
  const [panMode,setPanMode] = useState(false);
  const pan = useRef<{pointerId:number;clientX:number;clientY:number;x:number;z:number;scale:number;width:number;height:number}|null>(null);
  const [panning,setPanning] = useState(false);
  const [reviewLabels,setReviewLabels]=useState(false);
  const [reviewCandidates,setReviewCandidates]=useState(false);
  const [importFile,setImportFile]=useState<File|null>(null);
  const [calibrating,setCalibrating]=useState(false),[anchors,setAnchors]=useState<Point[]>([]),[realLength,setRealLength]=useState('1000');
  const points = project.walls.flatMap(w => [w.start, w.end]);
  const wallMinX=Math.min(...points.map(p=>p.x)), wallMinZ=Math.min(...points.map(p=>p.z));
  const wallWidth=Math.max(...points.map(p=>p.x))-wallMinX;
  const reference=project.planReference;
  useEffect(()=>{setCalibrating(false);setAnchors([]);setViewport(null);pan.current=null;setPanning(false);setDrag(null);},[reference?.origin.x,reference?.origin.z,reference?.widthPx,reference?.heightPx,reference?.mmPerPixel,reference?.calibrated,project.planImageUrl]);
  const bounds=[...points];
  if(project.planImageUrl&&reference) bounds.push(reference.origin,{x:reference.origin.x+reference.widthPx*reference.mmPerPixel,z:reference.origin.z+reference.heightPx*reference.mmPerPixel});
  const minX=Math.min(...bounds.map(p=>p.x))-1400,minZ=Math.min(...bounds.map(p=>p.z))-1400;
  const width=Math.max(...bounds.map(p=>p.x))-minX+1400,height=Math.max(...bounds.map(p=>p.z))-minZ+1400;
  const view=viewport??{x:minX,z:minZ,width,height};
  const zoom=width/view.width;
  function changeZoom(factor:number) {
    const nextZoom=Math.max(1,Math.min(16,zoom*factor));
    const nextWidth=width/nextZoom,nextHeight=height/nextZoom;
    setViewport({x:view.x+(view.width-nextWidth)/2,z:view.z+(view.height-nextHeight)/2,width:nextWidth,height:nextHeight});
  }
  function endPointer(e:React.PointerEvent, cancelled=false) {
    if(pan.current?.pointerId===e.pointerId){pan.current=null;setPanning(false);}
    if(drag&&!cancelled) patchWall(drag.id,{[drag.endpoint]:{x:drag.x,z:drag.z}});
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
  return <div className="drawing-view plan-drawing"><svg ref={svg} viewBox={`${view.x} ${view.z} ${view.width} ${view.height}`} className={`plan-svg${panMode?' pan-mode':''}${panning?' is-panning':''}`} aria-label="전시장 평면도" onPointerDown={e=>{
    if(e.button!==0)return;
    if(panMode){
      const matrix=svg.current?.getScreenCTM();if(!matrix)return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pan.current={pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,x:view.x,z:view.z,scale:matrix.a,width:view.width,height:view.height};
      setPanning(true);return;
    }
    pickCalibration(e);
  }} onPointerMove={e => {
    const activePan=pan.current;
    if(activePan&&activePan.pointerId===e.pointerId){setViewport({x:activePan.x-(e.clientX-activePan.clientX)/activePan.scale,z:activePan.z-(e.clientY-activePan.clientY)/activePan.scale,width:activePan.width,height:activePan.height});return;}
    if(drag){const p=pointer(e);if(p)setDrag({...drag,...p});}
  }} onPointerUp={e=>endPointer(e)} onPointerCancel={e=>endPointer(e,true)} onLostPointerCapture={e=>endPointer(e,true)}><defs><pattern id="plan-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#dce1e7" strokeWidth="12" /></pattern></defs><rect x={view.x} y={view.z} width={view.width} height={view.height} fill="url(#plan-grid)" />{project.planImageUrl && <image href={project.planImageUrl} x={reference?.origin.x ?? wallMinX} y={reference?.origin.z ?? wallMinZ} width={reference ? reference.widthPx*reference.mmPerPixel : wallWidth} height={reference ? reference.heightPx*reference.mmPerPixel : height-2800} opacity={project.planOpacity ?? 0.4} preserveAspectRatio="xMinYMin meet" />}{project.walls.filter(w => w.visible).map(w => {
    const start = drag?.id === w.id && drag.endpoint === 'start' ? drag : w.start, end = drag?.id === w.id && drag.endpoint === 'end' ? drag : w.end;
    const isSelected = selected.some(s => s.id === w.id);
    return <g key={w.id}><line x1={start.x} y1={start.z} x2={end.x} y2={end.z} stroke={isSelected ? '#365cf5' : '#697789'} strokeWidth={w.thicknessMm} onClick={e => !panMode && !calibrating && select({ type: 'wall', id: w.id }, e.shiftKey)} className="selectable" />{showDimensions && <text x={(start.x + end.x) / 2} y={(start.z + end.z) / 2 - 270} textAnchor="middle" className="plan-label">{w.name} · {Math.round(wallLength(w)).toLocaleString()}</text>}{isSelected && !w.locked && (['start', 'end'] as const).map(endpoint => { const p = endpoint === 'start' ? start : end; return <circle key={endpoint} cx={p.x} cy={p.z} r="85" fill="white" stroke="#365cf5" strokeWidth="30" className="drag-handle" onPointerDown={e => { if(panMode||calibrating)return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: w.id, endpoint, x: p.x, z: p.z }); }} />; })}</g>;
  })}{project.artworks.filter(a => a.visible).map(a => { const wall = project.walls.find(w => w.id === a.wallId); if (!wall?.visible) return null; const p = artworkPosition(a, wall); return <g key={a.id} transform={`translate(${p.x},${p.z}) rotate(${-p.rotationY * 180 / Math.PI})`} onClick={e => !panMode && !calibrating && select({ type: 'artwork', id: a.id }, e.shiftKey)} className="selectable"><rect x={-a.widthMm / 2} y={-65} width={a.widthMm} height="130" rx="10" fill={selected.some(s => s.id === a.id) ? '#365cf5' : '#c5ad8e'} /><circle r="140" fill="transparent" /></g>; })}{calibrating&&reference&&<g pointerEvents="none">{anchors.length===2&&<line x1={reference.origin.x+anchors[0].x*reference.mmPerPixel} y1={reference.origin.z+anchors[0].z*reference.mmPerPixel} x2={reference.origin.x+anchors[1].x*reference.mmPerPixel} y2={reference.origin.z+anchors[1].z*reference.mmPerPixel} stroke="#ed5a3c" strokeWidth={view.width/450}/>} {anchors.map((a,i)=><circle key={i} cx={reference.origin.x+a.x*reference.mmPerPixel} cy={reference.origin.z+a.z*reference.mmPerPixel} r={view.width/110} fill="#ed5a3c" stroke="white" strokeWidth={view.width/600}/>)}</g>}{reference&&(project.planLabels??[]).filter(l=>l.status!=='dismissed').map(l=>{const b=l.box;return <g key={l.id} pointerEvents="none"><rect x={reference.origin.x+b.x*reference.mmPerPixel} y={reference.origin.z+b.y*reference.mmPerPixel} width={b.width*reference.mmPerPixel} height={b.height*reference.mmPerPixel} fill="none" stroke={l.status==='confirmed'?'#16816b':'#d16b24'} strokeWidth={view.width/600} strokeDasharray={`${view.width/220} ${view.width/400}`}/><text x={reference.origin.x+b.x*reference.mmPerPixel} y={reference.origin.z+b.y*reference.mmPerPixel-view.width/180} fontSize={view.width/90} fill="#9f4d12" stroke="white" strokeWidth={view.width/1500} paintOrder="stroke">{labelNames[l.kind]} · 표기 위치</text></g>;})}</svg>
  <div className="plan-navigation" role="group" aria-label="도면 확대와 이동">
    <button className="icon-button" aria-label="도면 축소" title="도면 축소" disabled={zoom<=1} onClick={()=>changeZoom(1/1.5)}><ZoomOut size={16}/></button>
    <output aria-label="도면 확대 비율">{Math.round(zoom*100)}%</output>
    <button className="icon-button" aria-label="도면 확대" title="도면 확대" disabled={zoom>=16} onClick={()=>changeZoom(1.5)}><ZoomIn size={16}/></button>
    <button className="icon-button" aria-label="도면 전체 맞춤" title="도면 전체 맞춤" onClick={()=>setViewport(null)}><Maximize size={16}/></button>
    <button className={`plan-pan-toggle${panMode?' active':''}`} aria-pressed={panMode} onClick={()=>{setPanMode(!panMode);setDrag(null);}}><Hand size={15}/>{panMode?'이동 중':'화면 이동'}</button>
  </div>
  <div className="plan-tools"><button className="button secondary" onClick={()=>file.current?.click()}><ImagePlus size={15}/>도면 불러오기</button>
  {project.planImageUrl&&<><label>투명도<input aria-label="도면 투명도" type="range" min="0" max="1" step="0.05" value={project.planOpacity??0.4} onChange={e=>patchProject({planOpacity:Number(e.target.value)})}/></label>
  {reference&&<button className="button secondary" onClick={()=>setReviewLabels(true)}>설비 표기 ({project.planLabels?.filter(l=>l.status!=='dismissed').length??0})</button>}
  {reference&&<button className="button secondary" onClick={()=>{setReviewCandidates(true);setCalibrating(false);}}>벽 후보 찾기</button>}
  {reference&&<button className="button secondary" onClick={()=>{setCalibrating(!calibrating);setAnchors([]);setPanMode(false);}}>{calibrating?'보정 취소':'두 점 축척 보정'}</button>}
  <button className="icon-button" aria-label="참고 도면 제거" onClick={()=>{patchProject({planImageUrl:undefined,planReference:undefined,planLabels:undefined,planAnalysis:undefined});setCalibrating(false);setAnchors([]);}}><X size={15}/></button></>}
  <input ref={file} hidden type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f){setImportFile(f);setCalibrating(false);setAnchors([]);}e.currentTarget.value='';}}/></div>
  {calibrating&&<div className="calibration-panel"><strong>{panMode?'화면 이동 중 · 이동 버튼을 끄면 점을 선택할 수 있습니다':anchors.length<2?`도면에서 ${anchors.length===0?'첫 번째':'두 번째'} 점을 선택하세요`:'두 점 사이 실제 길이'}</strong>{anchors.length===2&&<><label><input aria-label="보정 실제 길이" type="number" min="1" value={realLength} onChange={e=>setRealLength(e.target.value)}/> mm</label><button className="button primary" onClick={()=>{try{if(!reference)return;patchProject({planReference:calibratePlan(reference,anchors[0],anchors[1],Number(realLength))});setCalibrating(false);setAnchors([]);notify('도면 축척을 보정했습니다. 벽과 작품 크기는 유지됩니다.');}catch(e){notify((e as Error).message);}}}>축척 적용</button></>}<small>도면 축척만 변경됩니다. 벽 끝점은 도면에 맞춰 이동하세요.</small></div>}
  <p className="canvas-hint">{panMode?'드래그하여 화면 이동 · 화면 이동 버튼을 끄면 편집':'벽 끝점 드래그 · 10 mm 단위 이동'}{project.planImageUrl?reference?.calibrated?' · 도면 축척 보정됨':' · 축척 미보정':''}</p>
  {reviewLabels&&<PlanLabelReview onClose={()=>setReviewLabels(false)}/>}
  {reviewCandidates&&reference&&project.planImageUrl&&<WallCandidateDialog onClose={()=>setReviewCandidates(false)}/>}
  {importFile&&<PlanImportDialog onAdopt={draft=>{useEditor.getState().commit(draft);setImportFile(null);notify("자동 공간 초안을 적용했습니다. 높이·두께는 임시값입니다. 실행 취소로 이전 작업을 복원할 수 있습니다.");}} file={importFile} onClose={()=>setImportFile(null)} onImport={image=>{patchProject({planImageUrl:image.imageUrl,planLabels:image.labels??[],planAnalysis:image.analysis,planReference:fitPlan(image.widthPx,image.heightPx,{x:wallMinX,z:wallMinZ},Math.max(wallWidth,1000)),planOpacity:0.55});setImportFile(null);notify('도면을 배치했습니다. 두 점 축척 보정 후 벽을 맞춰 주세요.');}}/>}
  </div>;
}
