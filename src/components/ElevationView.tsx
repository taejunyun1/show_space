import {ArtworkElevationDimensions} from './ArtworkElevationDimensions';
import {artworkPresentation} from '../domain/artworkPresentation';
import {ArtworkPresentationSvg} from './ArtworkPresentationSvg';
import {artworkGroupMembers} from '../domain/artworkGroups';
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/editor';
import { wallLength } from '../domain/model';
import { artStyle } from '../lib/art';
import {wallAnchor} from '../domain/measurements';
import {draggedArtworkAngle} from '../domain/artworkRotation';
import {panViewport,type ViewportBox} from '../lib/viewportPan';
import {ElevationMeasurements} from './MeasurementOverlay';
type RotationGesture={id:string;center:{x:number;y:number};start:{x:number;y:number};initial:number;angle:number};
export function ElevationView() {
  const { project, activeWallId, setActiveWall, selected, select, patchArtwork, showDimensions, activeTool, measurementDraft, pickMeasurement, previewProject, artworkGesture, beginArtworkDrag, updateArtworkDrag, finishArtworkDrag } = useEditor();
  const wall = project.walls.find(w => w.id === activeWallId) || project.walls[0];
  const svg = useRef<SVGSVGElement>(null);
  const [rotation,setRotation]=useState<RotationGesture|null>(null);
  const [side,setSide]=useState<'front'|'back'>('front');
  const [viewport,setViewport]=useState<ViewportBox|null>(null);
  const pan=useRef<{pointerId:number;clientX:number;clientY:number;scale:number;view:ViewportBox}|null>(null);
  const [panning,setPanning]=useState(false);
  const selectedArt=project.artworks.find(a=>selected[0]?.type==='artwork'&&a.id===selected[0].id);
  useEffect(()=>{if(selectedArt)setSide(selectedArt.wallSide??'front');setRotation(null);},[selectedArt?.id,selectedArt?.wallSide]);
  useEffect(()=>{setViewport(null);pan.current=null;setPanning(false);},[activeWallId]);
  useEffect(()=>{if(activeTool==='pan'){finishArtworkDrag(true);setRotation(null);}else{pan.current=null;setPanning(false);}},[activeTool]);
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){finishArtworkDrag(true);setRotation(null);}};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[]);
  if (!wall) return null;
  const width = wallLength(wall), height = wall.heightMm;
  const view=viewport??{x:-700,z:-650,width:width+1400,height:height+1600};
  const displayed=previewProject??project;
  const arts = displayed.artworks.filter(a => a.wallId === wall.id && a.visible && (a.wallSide??'front')===side);
  function point(e: React.PointerEvent) { const m = svg.current?.getScreenCTM()?.inverse(); return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m) : null; }
  function pick(e:React.PointerEvent){
    if(activeTool!=='measure')return;
    const p=point(e);if(!p||p.x<0||p.x>width||p.y<0||p.y>height)return;
    const t=side==='back'?1-p.x/width:p.x/width;
    const world={x:wall.start.x+(wall.end.x-wall.start.x)*t,y:height-p.y,z:wall.start.z+(wall.end.z-wall.start.z)*t};
    pickMeasurement(wallAnchor(project,wall.id,world),'elevation',wall.id);
  }
  function begin(e:React.PointerEvent<SVGSVGElement>){
    if(activeTool!=='pan'){pick(e);return;}
    if(e.button!==0)return;
    const scale=svg.current?.getScreenCTM()?.a;if(!scale)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current={pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,scale,view};
    setPanning(true);
  }
  function move(e:React.PointerEvent<SVGSVGElement>){
    if(pan.current?.pointerId===e.pointerId){const gesture=pan.current;setViewport(panViewport(gesture.view,{x:e.clientX-gesture.clientX,y:e.clientY-gesture.clientY},gesture.scale));return;}
    if(rotation){const p=point(e);if(p)setRotation(current=>current?{...current,angle:draggedArtworkAngle(current.initial,current.center,current.start,p)}:null);return;}
    if(artworkGesture){const p=point(e),scale=svg.current?.getScreenCTM()?.a;if(p&&scale)updateArtworkDrag({alongMm:side==='back'?width-p.x:p.x,centerHeightMm:height-p.y},{toleranceMm:{alongMm:12/Math.abs(scale),centerHeightMm:12/Math.abs(scale)},bypass:e.altKey});}
  }
  function finish(e:React.PointerEvent<SVGSVGElement>){
    if(pan.current?.pointerId===e.pointerId){pan.current=null;setPanning(false);return;}
    if(rotation){if(rotation.angle!==rotation.initial)patchArtwork(rotation.id,{rotationDeg:rotation.angle});setRotation(null);return;}
    if(artworkGesture){if(previewProject)move(e);finishArtworkDrag();}
  }
  function beginRotation(e:React.PointerEvent<SVGGElement>,id:string,x:number,y:number,initial:number){
    if(activeTool==='pan')return;
    const p=point(e);if(!p)return;
    e.stopPropagation();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
    finishArtworkDrag(true);setRotation({id,center:{x,y},start:{x:p.x,y:p.y},initial,angle:initial});
  }
  return <div className="drawing-view elevation"><div className="wall-tabs">{project.walls.map(w => <button className={w.id === wall.id ? 'active' : ''} key={w.id} onClick={() => setActiveWall(w.id)}>{w.name}</button>)}</div><div className="wall-face-tabs"><button aria-pressed={side==='front'} onClick={()=>{setSide('front');finishArtworkDrag(true);setRotation(null);}}>A면 보기</button><button aria-pressed={side==='back'} onClick={()=>{setSide('back');finishArtworkDrag(true);setRotation(null);}}>B면 보기</button></div><svg ref={svg} viewBox={`${view.x} ${view.z} ${view.width} ${view.height}`} className={activeTool==='pan'?(panning?'pan-view is-panning':'pan-view'):undefined} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{pan.current=null;setPanning(false);finishArtworkDrag(true);setRotation(null);}}><rect x="0" y="0" width={width} height={height} fill={wall.color} stroke="#c1c9d2" strokeWidth="12" /><rect x="0" y={height} width={width} height="80" fill="#b9c0c8" />{showDimensions && <g className="svg-dimensions"><line x1="0" y1="-280" x2={width} y2="-280" /><line x1="0" y1="-370" x2="0" y2="-190" /><line x1={width} y1="-370" x2={width} y2="-190" /><text x={width / 2} y="-355" textAnchor="middle">{Math.round(width).toLocaleString()} mm</text><line x1="-280" y1="0" x2="-280" y2={height} /><text x="-370" y={height / 2} textAnchor="middle" transform={`rotate(-90 -370 ${height / 2})`}>{height.toLocaleString()} mm</text></g>}{arts.map(a => {
    const isSelected = selected.some(s => s.id === a.id), x = side==='back'?width-a.alongMm:a.alongMm, y = height - a.centerHeightMm, angle=rotation?.id===a.id?rotation.angle:a.rotationDeg??0,presentation=artworkPresentation(a);
    return <g key={a.id} className={a.locked ? 'selectable' : 'draggable-art'} onPointerDown={e => { if(activeTool==='measure'||activeTool==='pan')return; e.stopPropagation(); select({ type: 'artwork', id: a.id }, e.shiftKey); if (!artworkGroupMembers(project,a.id).some(member=>member.locked) && !e.shiftKey) { const p = point(e); if (p) { e.currentTarget.setPointerCapture(e.pointerId); beginArtworkDrag(a.id,{alongMm:side==='back'?width-p.x:p.x,centerHeightMm:height-p.y}); } } }}><g transform={angle ? `rotate(${-angle} ${x} ${y})` : undefined}><ArtworkPresentationSvg artwork={a} x={x} y={y}><foreignObject data-artwork-url={a.imageUrl} x={x - a.widthMm / 2} y={y - a.heightMm / 2} width={a.widthMm} height={a.heightMm} pointerEvents="none"><div style={{ width: '100%', height: '100%', ...artStyle(a.imageUrl) }} /></foreignObject></ArtworkPresentationSvg>{isSelected && <rect x={x - presentation.widthMm / 2 - 20} y={y - presentation.heightMm / 2 - 20} width={presentation.widthMm + 40} height={presentation.heightMm + 40} fill="none" stroke="#365cf5" strokeWidth="20" />}{isSelected&&selected.length===1&&!a.locked&&activeTool!=='measure'&&activeTool!=='pan'&&<g className="artwork-rotation-handle" data-capture-draft="rotation-handle" onPointerDown={e=>beginRotation(e,a.id,x,y,angle)}><line x1={x} y1={y-presentation.heightMm/2-45} x2={x} y2={y-presentation.heightMm/2-250} stroke="#365cf5" strokeWidth="24" pointerEvents="none"/><circle cx={x} cy={y-presentation.heightMm/2-250} r="115" fill="#365cf5" stroke="#fff" strokeWidth="30"/></g>}</g>{showDimensions && isSelected && <g className="svg-dimensions blue"><line x1={x} y1={y} x2={x} y2={height + 220} strokeDasharray="30 25" /><text x={x + 120} y={height - 150} textAnchor="start">중심 {Math.round(height - y).toLocaleString()} mm</text><text x={x + presentation.widthMm / 2 + 120} y={y - presentation.heightMm / 2 - 155} textAnchor="start">{presentation.widthMm} × {presentation.heightMm} 외곽</text></g>}</g>;
  })}{!!artworkGesture?.guides?.length&&<g aria-label="작품 스냅 안내선" data-capture-draft="snap" pointerEvents="none">{artworkGesture.guides.map(g=>g.axis==='along'?<line key={g.axis} x1={side==='back'?width-g.atMm:g.atMm} x2={side==='back'?width-g.atMm:g.atMm} y1={0} y2={height} stroke="#16816b" strokeWidth={view.width/650} strokeDasharray={`${view.width/120} ${view.width/200}`}/>:<line key={g.axis} x1={0} x2={width} y1={height-g.atMm} y2={height-g.atMm} stroke="#16816b" strokeWidth={view.width/650} strokeDasharray={`${view.width/120} ${view.width/200}`}/>)}</g>}{showDimensions&&<ArtworkElevationDimensions project={displayed} wallId={wall.id} side={side} selectedIds={selected.filter(s=>s.type==='artwork').map(s=>s.id)}/>}<ElevationMeasurements project={project} draft={measurementDraft} showDimensions={showDimensions} wallId={wall.id} back={side==='back'}/></svg><p className="canvas-hint">{activeTool==='pan'?'손 도구: 드래그해 벽면도 시점을 이동하세요':activeTool==='measure'?'줄자: 벽면의 두 점을 클릭하세요':`${side==='front'?'A면':'B면'} · 작품을 드래그해 이동, 선택 작품의 파란 점을 드래그해 15°씩 회전 · Shift로 여러 작품 선택 · Alt로 스냅 해제`}</p></div>;
}
