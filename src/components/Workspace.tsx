import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MousePointer2, Hand, Move, RotateCw, Camera, Ruler, Scan, PanelTop, Box, RotateCcw, Plus, Trash2, PencilLine, LockKeyhole, UnlockKeyhole, MoveDiagonal2 } from 'lucide-react';
import { useEditor } from '../state/editor';
import { IconButton } from './Controls';
import { PlanView } from './PlanView';
import { MeasurementPanel } from './MeasurementPanel';
import { ElevationView } from './ElevationView';
import {CaptureDialog} from './CaptureDialog';
import {captureSvg,type CaptureOptions} from '../lib/captureSvg';
import {downloadBlob} from '../lib/art';
import type {CameraView3D} from './cameraView3d';
const Gallery3D = lazy(() => import('./Gallery3D').then(m => ({ default: m.Gallery3D })));
class RenderBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="render-error"><h2>3D 화면을 열지 못했습니다</h2><p>그래픽 가속 또는 작품 이미지를 확인해주세요.<br />평면도와 벽면도에서 작업을 계속할 수 있습니다.</p><button className="button secondary" onClick={() => useEditor.getState().setView('plan')}>평면도로 이동</button></div> : this.props.children; }
}
export function Workspace({ captureRef,cameraGetterRef }: { captureRef: React.MutableRefObject<(() => void) | null>;cameraGetterRef:React.MutableRefObject<(()=>CameraView3D)|null> }) {
  const { project, view, setView, activeTool, setTool, showDimensions, toggleDimensions, selected, lockSelected, setActiveWall, saveScene, restoreScene, deleteScene } = useEditor();
  const [reset, setReset] = useState(0), [cutaway, setCutaway] = useState(true), [sceneOpen, setSceneOpen] = useState(false),[captureOpen,setCaptureOpen]=useState(false);
  const [cameraRequest,setCameraRequest]=useState<{token:number;projectId:string;view:CameraView3D}|null>(null);
  const cameraRequestId=useRef(0);
  const provisional=!!project.planDraft&&!project.planReference?.calibrated;
  const sceneName = useRef<HTMLInputElement>(null);
  const capture3D=useRef<((options:CaptureOptions)=>Promise<Blob>)|null>(null);
  const captureReady = useCallback((capture:(options:CaptureOptions)=>Promise<Blob>) => { capture3D.current=capture; }, []);
  const cameraReady = useCallback((getView:(()=>CameraView3D)|null)=>{cameraGetterRef.current=getView;},[cameraGetterRef]);
  const cameraApplied = useCallback((token:number)=>{setCameraRequest(current=>current?.token===token?null:current);},[]);
  function openScene(id:string){
    const scene=project.scenes.find(item=>item.id===id);
    restoreScene(id);
    if(scene?.cameraView){setCameraRequest({token:++cameraRequestId.current,projectId:project.id,view:scene.cameraView});setView('3d');}
    else{setCameraRequest(null);if(scene?.structure&&view==='3d')setReset(n=>n+1);}
  }
  useEffect(()=>{captureRef.current=()=>setCaptureOpen(true);return ()=>{captureRef.current=null;};},[captureRef]);
  async function captureCurrent(options:CaptureOptions){
    let blob:Blob;
    if(view==='3d'){
      if(!capture3D.current)throw new Error('3D 화면을 불러온 뒤 다시 시도해 주세요.');
      blob=await capture3D.current(options);
    }else{
      const svg=document.querySelector<SVGSVGElement>(view==='plan'?'.viewport-stage .drawing-view:not(.elevation)>svg':'.viewport-stage .elevation>svg');
      if(!svg)throw new Error('도면 화면을 찾지 못했습니다.');
      blob=await captureSvg(svg,options);
    }
    downloadBlob(blob,`${project.name}-${view==='plan'?'평면도':view==='elevation'?'벽면도':'3D'}.png`);
  }
  return <main className="workspace"><div className="viewport-label">{view === '3d' ? '공간 미리보기' : view === 'plan' ? '평면도' : '벽면도'}<span>{project.planDraft?provisional?'축척 미정 · 도면 px로 벽을 수정하세요':'축척 보정됨 · 구조선 후보 · 바닥 경계 미확정':activeTool==='pan'?'손 도구 · 드래그해 시점을 이동하세요':view === '3d' ? '작품을 다른 벽으로 드래그하거나 파란 점으로 회전하세요' : '실제 치수로 배치를 조정하세요'}</span></div><div className="viewport-toolbar"><IconButton label="선택 도구" active={activeTool==='select'} onClick={()=>setTool('select')}><MousePointer2 size={18}/></IconButton><IconButton label="손 도구 · 화면 이동" active={activeTool==='pan'} onClick={()=>setTool('pan')}><Hand size={18}/></IconButton><IconButton label="벽 이동" active={activeTool==='move'} onClick={()=>setTool('move')}><Move size={18}/></IconButton><IconButton label="벽 회전" active={activeTool==='rotate'} onClick={()=>setTool('rotate')}><RotateCw size={18}/></IconButton><IconButton label="두 점으로 벽 그리기" active={activeTool==='draw'} onClick={()=>{setView('plan');setTool('draw');}}><PencilLine size={18}/></IconButton><span className="toolbar-divider" /><IconButton label="벽 추가" onClick={() => { useEditor.getState().addWall(); setView('plan'); }}><PanelTop size={18} /></IconButton><IconButton label="선택 항목 잠금" disabled={!selected.length} onClick={()=>lockSelected(true)}><LockKeyhole size={18}/></IconButton><IconButton label="선택 항목 잠금 해제" disabled={!selected.length} onClick={()=>lockSelected(false)}><UnlockKeyhole size={18}/></IconButton><IconButton label="줄자 측정" active={activeTool==='measure'} onClick={()=>setTool('measure')}><MoveDiagonal2 size={18}/></IconButton><IconButton label="치수 표시" active={showDimensions} onClick={toggleDimensions}><Ruler size={18} /></IconButton><IconButton label="현재 화면 캡처" onClick={()=>setCaptureOpen(true)}><Camera size={18}/></IconButton><span className="toolbar-divider" /><IconButton label="기본 시점으로" onClick={() => {setCameraRequest(null);setReset(n => n + 1);}} disabled={view !== '3d'}><Scan size={18} /></IconButton></div>{view === '3d' && <label className="cutaway-toggle"><input type="checkbox" checked={cutaway} onChange={e => setCutaway(e.target.checked)} />벽 자동 숨김</label>}<div className="viewport-stage">{view === '3d' ? <RenderBoundary><Suspense fallback={<div className="loading-canvas"><Box size={30} strokeWidth={1.2} /><span>공간을 불러오는 중</span></div>}><Gallery3D reset={reset} onCaptureReady={captureReady} onCameraReady={cameraReady} onCameraApplied={cameraApplied} cameraRequest={cameraRequest} cutaway={cutaway} /></Suspense></RenderBoundary> : view === 'plan' ? <PlanView /> : <ElevationView />}</div><MeasurementPanel/><div className="view-navigation"><button className={view === '3d' ? 'active' : ''} disabled={provisional} title={provisional?'두 점 축척 보정 후 열 수 있습니다.':undefined} onClick={() => setView('3d')}>3D</button><button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>평면도</button><button className={view === 'elevation' ? 'active' : ''} disabled={provisional} title={provisional?'두 점 축척 보정 후 열 수 있습니다.':undefined} onClick={() => { const art = project.artworks.find(a => a.id === selected[0]?.id); if (art) setActiveWall(art.wallId); setView('elevation'); }}>벽면도</button></div><button className={`scene-toggle ${sceneOpen ? 'active' : ''}`} onClick={() => setSceneOpen(!sceneOpen)}><RotateCcw size={14} />Scene {project.scenes.length > 0 && <span>{project.scenes.length}</span>}</button>{sceneOpen && <div className="scene-popover"><strong>배치안 저장</strong><p>벽·문 구조와 작품 배치를 함께 저장합니다. 3D에서 저장하면 시점도 기억합니다.</p><div className="scene-create"><input aria-label="Scene 이름" ref={sceneName} placeholder={`Scene ${String.fromCharCode(65 + project.scenes.length)}`} maxLength={60} /><button className="icon-button active" aria-label="현재 Scene 저장" onClick={() => { saveScene(sceneName.current?.value.trim() || `Scene ${String.fromCharCode(65 + project.scenes.length)}`,view==='3d'?cameraGetterRef.current?.():undefined); if (sceneName.current) sceneName.current.value = ''; }}><Plus size={17} /></button></div>{project.scenes.map(s => <div className="scene-row" key={s.id}><button onClick={() => openScene(s.id)}>{s.name}<span>{s.artworks.length}개 작품{s.structure?' · 구조 포함':''}{s.cameraView?' · 저장된 시점':''}</span></button><IconButton label={`${s.name} 삭제`} onClick={() => deleteScene(s.id)}><Trash2 size={14} /></IconButton></div>)}</div>}{captureOpen&&<CaptureDialog view={view} hasPlan={!!project.planImageUrl} onCapture={captureCurrent} onClose={()=>setCaptureOpen(false)}/>}</main>;
}
