import {isModuleLoadError} from '../lib/screenRecovery';
import {ScreenRecoveryPanel,ScreenRecoveryBoundary} from './ScreenRecoveryBoundary';
import {floorWithOpenings} from '../domain/openings';
import {canRestoreDemoBoundary} from '../domain/model';
import type {RenderQuality} from '../lib/renderQuality';
import {OutdoorTimeSlider} from './OutdoorTimeSlider';
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { MousePointer2, Hand, Move, RotateCw, Camera, Ruler, Scan, PanelTop, Box, RotateCcw, Plus, Trash2, PencilLine, LockKeyhole, UnlockKeyhole, MoveDiagonal2, Magnet, LoaderCircle } from 'lucide-react';
import { useEditor } from '../state/editor';
import { IconButton } from './Controls';
import { PlanView } from './PlanView';
import { MeasurementPanel } from './MeasurementPanel';
import { ElevationView } from './ElevationView';
import {CaptureDialog} from './CaptureDialog';
import {captureSvg,type CaptureOptions} from '../lib/captureSvg';
import {downloadBlob} from '../lib/art';
import {createEyeLevelView,createStandardView,rotateCameraView,type StandardView} from './cameraView3d';
import type {CameraView3D} from './cameraView3d';
import type {SceneThumbnail} from '../domain/types';
const TimeComparisonDialog=lazy(()=>import('./TimeComparisonDialog'));
const Gallery3D = lazy(() => import('./Gallery3D').then(m => ({ default: m.Gallery3D })));
class RenderBoundary extends Component<{ children: ReactNode }, { failed:boolean;error:unknown }> {
  state = { failed:false,error:null as unknown };
  static getDerivedStateFromError(error:unknown) { return { failed:true,error }; }
  render() { if(this.state.failed&&isModuleLoadError(this.state.error))return <ScreenRecoveryPanel name="3D 화면" error={this.state.error} onClose={()=>useEditor.getState().setView('plan')}/>;return this.state.failed ? <div className="render-error"><h2>3D 화면을 열지 못했습니다</h2><p>그래픽 가속 또는 작품 이미지를 확인해주세요.<br />평면도와 벽면도에서 작업을 계속할 수 있습니다.</p><button className="button secondary" onClick={() => useEditor.getState().setView('plan')}>평면도로 이동</button></div> : this.props.children; }
}
export function Workspace({ captureRef,cameraGetterRef,incomingPlan,onPlanReceived }: { incomingPlan:File|null;onPlanReceived:()=>void; captureRef: React.MutableRefObject<(() => void) | null>;cameraGetterRef:React.MutableRefObject<(()=>CameraView3D)|null> }) {
  const { project, previewProject, view, setView, activeTool, setTool, showDimensions, toggleDimensions, selected, lockSelected, setActiveWall, saveScene, restoreScene, deleteScene } = useEditor();
  const displayed=previewProject??project;
  const missingFloor=useMemo(()=>!floorWithOpenings(displayed).surfaces.length,[displayed.walls,displayed.openings,displayed.importedFloor]);
  const showFloorHint=view==='3d'&&missingFloor&&(!displayed.referenceModel||displayed.referenceModel.visible===false);
  const [quality,setQuality]=useState<RenderQuality>('edit');
  const [reset, setReset] = useState(0), [cutaway, setCutaway] = useState(true), [sceneOpen, setSceneOpen] = useState(false),[captureOpen,setCaptureOpen]=useState(false),[timeComparisonOpen,setTimeComparisonOpen]=useState(false);
  const [cameraRequest,setCameraRequest]=useState<{token:number;projectId:string;view:CameraView3D}|null>(null);
  const cameraRequestId=useRef(0);
  const [projection,setProjection]=useState<'orthographic'|'perspective'>('orthographic');
  const [eyeHeight,setEyeHeight]=useState(1600);
  const stageRef=useRef<HTMLDivElement>(null);
  function standardView(kind:StandardView){
    const box=stageRef.current?.getBoundingClientRect();
    setProjection('orthographic');setTool('select');
    setCameraRequest({token:++cameraRequestId.current,projectId:project.id,view:createStandardView(project,kind,{width:box?.width??800,height:box?.height??600})});
  }
  function rotateView(degrees:number){
    const current=cameraRequest?.view??cameraGetterRef.current?.();if(!current)return;
    setCameraRequest({token:++cameraRequestId.current,projectId:project.id,view:rotateCameraView(current,degrees)});
  }
  function eyeView(height=eyeHeight){
    setProjection('perspective');setEyeHeight(height);setTool('pan');
    setCameraRequest({token:++cameraRequestId.current,projectId:project.id,view:createEyeLevelView(project,useEditor.getState().activeWallId,height)});
  }
  const provisional=!!project.planDraft&&!project.planReference?.calibrated;
  const sceneName = useRef<HTMLInputElement>(null);
  const [savingScene,setSavingScene]=useState(false),sceneJob=useRef<AbortController|null>(null);
  useEffect(()=>{setSavingScene(false);return()=>{sceneJob.current?.abort();sceneJob.current=null;};},[project.id]);
  const sceneSaveDisabled=savingScene||!useEditor.getState().hydrated||!!previewProject;
  function cancelSceneSave(){sceneJob.current?.abort();sceneJob.current=null;setSavingScene(false);}
  async function saveCurrentScene(){
    const state=useEditor.getState();
    if(sceneJob.current||!state.hydrated||state.previewProject)return;
    const controller=new AbortController();sceneJob.current=controller;setSavingScene(true);
    const source=structuredClone({...state.project,scenes:[]}),rawName=sceneName.current?.value??'',name=rawName.trim()||`Scene ${String.fromCharCode(65+state.project.scenes.length)}`;
    const camera=view==='3d'?structuredClone(cameraGetterRef.current?.()):undefined,box=stageRef.current?.getBoundingClientRect();
    const currentCamera=camera&&box&&box.width>0&&box.height>0?{view:structuredClone(camera),width:box.width,height:box.height,cutaway}:undefined;
    let thumbnail:SceneThumbnail|undefined;
    try{
      try{
        if(view==='3d'){
          const {renderSceneThumbnail}=await import('../lib/sceneThumbnail');controller.signal.throwIfAborted();
          thumbnail=await renderSceneThumbnail(source,currentCamera,controller.signal);
        }else{
          const svg=stageRef.current?.querySelector<SVGSVGElement>(view==='plan'?'.drawing-view:not(.elevation)>svg':'.elevation>svg');
          if(!svg)throw new Error('미리보기 화면을 찾지 못했습니다.');
          const blob=await captureSvg(svg,{longEdge:320,includeDimensions:false,includeGrid:false,includePlan:true});
          const {thumbnailFromBlob}=await import('../lib/sceneThumbnail');controller.signal.throwIfAborted();
          thumbnail=await thumbnailFromBlob(blob,view,controller.signal);
        }
      }catch(error){if(controller.signal.aborted)throw error;/* Preserve the layout even when GPU/image decoding fails. */}
      controller.signal.throwIfAborted();
      if(sceneJob.current!==controller)return;
      if(saveScene(name,camera,thumbnail,source)){
        if(sceneName.current?.value===rawName)sceneName.current.value='';
        useEditor.getState().notify(thumbnail?'배치안과 미리보기를 저장했습니다.':'배치안은 저장했습니다. 미리보기 이미지는 만들지 못했습니다.');
      }
    }catch(error){if(!controller.signal.aborted)useEditor.getState().notify(error instanceof Error?error.message:'Scene을 저장하지 못했습니다.');}
    finally{if(sceneJob.current===controller){sceneJob.current=null;setSavingScene(false);}}
  }
  const capture3D=useRef<((options:CaptureOptions)=>Promise<Blob>)|null>(null);
  const captureReady = useCallback((capture:(options:CaptureOptions)=>Promise<Blob>) => { capture3D.current=capture; }, []);
  const cameraReady = useCallback((getView:(()=>CameraView3D)|null)=>{cameraGetterRef.current=getView;},[cameraGetterRef]);
  const cameraApplied = useCallback((token:number)=>{setCameraRequest(current=>current?.token===token?null:current);},[]);
  function openScene(id:string){
    const scene=project.scenes.find(item=>item.id===id);
    restoreScene(id);
    if(scene?.cameraView){setProjection(scene.cameraView.projection??'orthographic');if(scene.cameraView.projection==='perspective'){setTool('pan');setEyeHeight(Math.round(scene.cameraView.position[1]*1000));}setCameraRequest({token:++cameraRequestId.current,projectId:project.id,view:scene.cameraView});setView('3d');}
    else{setCameraRequest(null);if(scene?.structure&&view==='3d')setReset(n=>n+1);}
  }
  useEffect(()=>{captureRef.current=()=>setCaptureOpen(true);return ()=>{captureRef.current=null;};},[captureRef]);
  function captureSourceSize(){
    const source=stageRef.current?.querySelector(view==='3d'?'canvas':view==='plan'?'.drawing-view:not(.elevation)>svg':'.elevation>svg');
    if(source instanceof SVGSVGElement){const box=source.viewBox.baseVal;return {width:box.width,height:box.height};}
    const box=source?.getBoundingClientRect();return {width:box?.width??0,height:box?.height??0};
  }
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
  return <main className="workspace"><div className="viewport-label">{view === '3d' ? '공간 미리보기' : view === 'plan' ? '평면도' : '벽면도'}<span>{project.planDraft?provisional?'축척 미정 · 도면 px로 벽을 수정하세요':'축척 보정됨 · 구조선 후보 · 바닥 경계 미확정':activeTool==='pan'?'손 도구 · 드래그해 시점을 이동하세요':selected.some(s=>s.type==='modelArtwork')?'3D 작품 · 이동 화살표 또는 회전 도구를 사용하세요':view === '3d' ? '작품을 다른 벽으로 드래그하거나 파란 점으로 회전하세요' : '실제 치수로 배치를 조정하세요'}</span></div>{showFloorHint&&<div className="floor-empty-state" role="status"><span>바닥 경계가 아직 연결되지 않았습니다. 벽과 작품은 계속 편집할 수 있습니다.</span>{!previewProject&&canRestoreDemoBoundary(project)&&<button type="button" onClick={()=>useEditor.getState().restoreDemoSpace()}>기본 공간 배치 복원</button>}</div>}<div className="viewport-toolbar"><IconButton label="선택 도구" active={activeTool==='select'} onClick={()=>setTool('select')}><MousePointer2 size={18}/></IconButton><IconButton label="손 도구 · 화면 이동" active={activeTool==='pan'} onClick={()=>setTool('pan')}><Hand size={18}/></IconButton><IconButton label={selected.some(s=>s.type==='modelArtwork')?'3D 작품 이동':'벽 이동'} active={activeTool==='move'} onClick={()=>setTool('move')}><Move size={18}/></IconButton><IconButton label={selected.some(s=>s.type==='modelArtwork')?'3D 작품 회전':'벽 회전'} active={activeTool==='rotate'} onClick={()=>setTool('rotate')}><RotateCw size={18}/></IconButton><IconButton label="두 점으로 벽 그리기" active={activeTool==='draw'} onClick={()=>{setView('plan');setTool('draw');}}><PencilLine size={18}/></IconButton><span className="toolbar-divider" /><IconButton label="벽 추가" onClick={() => { useEditor.getState().addWall(); setView('plan'); }}><PanelTop size={18} /></IconButton><IconButton label="선택 항목 잠금" disabled={!selected.length} onClick={()=>lockSelected(true)}><LockKeyhole size={18}/></IconButton><IconButton label="선택 항목 잠금 해제" disabled={!selected.length} onClick={()=>lockSelected(false)}><UnlockKeyhole size={18}/></IconButton><IconButton label="줄자 측정" active={activeTool==='measure'} onClick={()=>setTool('measure')}><MoveDiagonal2 size={18}/></IconButton><IconButton label="작품 스냅 · 모서리·중심·10mm" active={useEditor.getState().artworkSnapping} disabled={view==='plan'&&!selected.some(s=>s.type==='modelArtwork')} onClick={useEditor.getState().toggleArtworkSnapping}><Magnet size={18}/></IconButton><IconButton label="치수 표시" active={showDimensions} onClick={toggleDimensions}><Ruler size={18} /></IconButton><IconButton label="현재 화면 캡처" onClick={()=>setCaptureOpen(true)}><Camera size={18}/></IconButton><span className="toolbar-divider" /><IconButton label="기본 시점으로" onClick={() => {setProjection('orthographic');setCameraRequest(null);setReset(n => n + 1);}} disabled={view !== '3d'}><Scan size={18} /></IconButton></div>{view==='3d'&&<div className="render-quality-switch" role="group" aria-label="3D 렌더 품질"><button aria-pressed={quality==='edit'} onClick={()=>setQuality('edit')} title="화면 해상도와 그림자를 줄여 빠르게 편집합니다">빠른 편집</button><button aria-pressed={quality==='preview'} onClick={()=>setQuality('preview')} title="그림자와 화면 해상도를 높여 확인합니다">미리보기</button></div>}{view==='3d'&&<div className="view-presets" role="group" aria-label="3D 시점"><div className="view-preset-buttons"><button onClick={()=>standardView('front')}>정면</button><button onClick={()=>standardView('left')}>좌측면</button><button onClick={()=>standardView('right')}>우측면</button><button onClick={()=>standardView('bird')}>버드아이뷰</button><span className="toolbar-divider"/><button aria-label="시점 왼쪽 15도 회전" onClick={()=>rotateView(-15)}>↶ 15°</button><button aria-label="시점 오른쪽 15도 회전" onClick={()=>rotateView(15)}>↷ 15°</button></div><details className="view-more"><summary>기타 시점</summary><div><button disabled={!!previewProject} onClick={()=>setTimeComparisonOpen(true)}>시간대 비교</button><button onClick={()=>eyeView()}>눈높이 시점</button><label>높이 <select aria-label="눈높이" value={eyeHeight} onChange={e=>eyeView(Number(e.target.value))}>{![1200,1600,1800].includes(eyeHeight)&&<option value={eyeHeight}>{Math.round(eyeHeight/10)} cm · 저장 시점</option>}<option value={1200}>120 cm</option><option value={1600}>160 cm</option><option value={1800}>180 cm</option></select></label></div></details></div>}{view === '3d' && projection==='orthographic' && <label className="cutaway-toggle"><input type="checkbox" checked={cutaway} onChange={e => setCutaway(e.target.checked)} />벽 자동 숨김</label>}<div className="viewport-stage" ref={stageRef}>{view === '3d' ? <RenderBoundary><Suspense fallback={<div className="loading-canvas"><Box size={30} strokeWidth={1.2} /><span>공간을 불러오는 중</span></div>}><Gallery3D quality={quality} projection={projection} eyeHeight={eyeHeight} reset={reset} onCaptureReady={captureReady} onCameraReady={cameraReady} onCameraApplied={cameraApplied} cameraRequest={cameraRequest} cutaway={cutaway} /></Suspense></RenderBoundary> : view === 'plan' ? <PlanView incomingFile={incomingPlan} onFileReceived={onPlanReceived}/> : <ElevationView />}</div><OutdoorTimeSlider/><MeasurementPanel/><div className="view-navigation"><button className={view === '3d' ? 'active' : ''} disabled={provisional} title={provisional?'두 점 축척 보정 후 열 수 있습니다.':undefined} onClick={() => setView('3d')}>3D</button><button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>평면도</button><button className={view === 'elevation' ? 'active' : ''} disabled={provisional} title={provisional?'두 점 축척 보정 후 열 수 있습니다.':undefined} onClick={() => { const art = project.artworks.find(a => a.id === selected[0]?.id); if (art) setActiveWall(art.wallId); setView('elevation'); }}>벽면도</button></div><button className={`scene-toggle ${sceneOpen ? 'active' : ''}`} onClick={() => setSceneOpen(!sceneOpen)}><RotateCcw size={14} />Scene {project.scenes.length > 0 && <span>{project.scenes.length}</span>}</button>{sceneOpen && <div className="scene-popover"><strong>배치안 저장</strong><p>벽·문 구조, 작품 배치·조명·야외 환경과 시간을 함께 저장합니다. 3D에서 저장하면 시점도 기억합니다.</p><div className="scene-create"><input aria-label="Scene 이름" ref={sceneName} placeholder={`Scene ${String.fromCharCode(65 + project.scenes.length)}`} maxLength={60} /><button className="icon-button active" aria-label="현재 Scene 저장" disabled={sceneSaveDisabled} onClick={()=>void saveCurrentScene()}>{savingScene?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}</button></div>{savingScene&&<div className="scene-save-progress" role="status"><span>미리보기 만드는 중…</span><button onClick={cancelSceneSave}>취소</button></div>}{project.scenes.map(s => <div className="scene-row" key={s.id}><button className="scene-open" onClick={() => openScene(s.id)}>{s.thumbnail?<img className="scene-thumbnail" src={s.thumbnail.imageUrl} width={s.thumbnail.widthPx} height={s.thumbnail.heightPx} alt={`${s.name} 미리보기`}/>:<span className="scene-thumbnail scene-thumbnail-empty" aria-label="미리보기 없음"><Box size={20}/></span>}<span className="scene-description"><strong>{s.name}</strong><small>{s.artworks.length+(s.structure?.modelArtworks?.length??0)}개 작품{s.structure?' · 구조 포함':''}{s.cameraView?' · 저장된 시점':''}</small></span></button><IconButton label={`${s.name} 삭제`} onClick={() => deleteScene(s.id)}><Trash2 size={14} /></IconButton></div>)}</div>}{timeComparisonOpen&&<ScreenRecoveryBoundary name="시간대 비교" onClose={()=>setTimeComparisonOpen(false)}><Suspense fallback={null}><TimeComparisonDialog key={project.id} onClose={()=>setTimeComparisonOpen(false)} getCamera={()=>{const camera=cameraGetterRef.current?.(),box=stageRef.current?.getBoundingClientRect();return camera&&box&&box.width>0&&box.height>0?{view:camera,width:box.width,height:box.height,cutaway}:undefined;}}/></Suspense></ScreenRecoveryBoundary>}{captureOpen&&<CaptureDialog sourceSize={captureSourceSize} view={view} hasPlan={!!project.planImageUrl} onCapture={captureCurrent} onClose={()=>setCaptureOpen(false)}/>}</main>;
}
