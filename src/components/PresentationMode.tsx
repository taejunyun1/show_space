import {ReadonlyVideoControls} from './ReadonlyVideoControls';
import {videoPlayback} from '../lib/videoPlayback';
import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Maximize,Minimize,RotateCcw,X} from 'lucide-react';
import type {CameraView,Project} from '../domain/types';
import {presentationLayout,adjacentPresentationScene} from '../domain/presentation';
import {SharedArtworkInformation} from './SharedViewer';
import {LengthUnitContext} from './LengthUnits';
import {ReadonlyAssetsContext} from './ReadonlyAssets';
import './presentationMode.css';
const SharedViewer3D=lazy(()=>import('./SharedViewer3D'));
type Selection={kind:'wall'|'artwork'|'modelArtwork'|'referenceModel';id:string}|null;
export interface PresentationSource {project:Project;camera?:CameraView;cutaway:boolean}
export default function PresentationMode({source,onClose,returnLabel='편집으로 돌아가기'}:{source:PresentationSource;onClose:()=>void;returnLabel?:string}){
 const dialog=useRef<HTMLDialogElement>(null),screen=useRef<HTMLDivElement>(null),[sceneId,setSceneId]=useState<string|null>(null),[selection,setSelection]=useState<Selection>(null),[reset,setReset]=useState(0),[cutaway,setCutaway]=useState(source.cutaway),[fullscreen,setFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState(''),[infoOpen,setInfoOpen]=useState(false);
 const ids=useMemo(()=>source.project.scenes.map(s=>s.id),[source]);
 const layout=useMemo(()=>{try{return {data:presentationLayout(source.project,sceneId,source.camera)};}catch(e){return {error:e instanceof Error?e.message:'발표 화면을 표시하지 못했습니다.'};}},[source,sceneId]);
 const snapshot=layout.data?.snapshot,videoScope=`local:${source.project.id}:${sceneId??'current'}`,art=selection?.kind==='artwork'?snapshot?.artworks.find(a=>a.id===selection.id):selection?.kind==='modelArtwork'?snapshot?.modelArtworks?.find(a=>a.id===selection.id):undefined;
 const index=sceneId===null?0:ids.indexOf(sceneId)+1;
 useEffect(()=>{
  videoPlayback.pauseAll();dialog.current!.showModal();const element=screen.current!;
  const changed=()=>setFullscreen(document.fullscreenElement===element);document.addEventListener('fullscreenchange',changed);
  return()=>{document.removeEventListener('fullscreenchange',changed);if(document.fullscreenElement===element)void document.exitFullscreen().catch(()=>{});};
 },[]);
 function changeScene(id:string|null){setSceneId(id);setSelection(null);setReset(0);setInfoOpen(false);}
 function select(next:Selection){setSelection(next);if(next?.kind==='artwork'||next?.kind==='modelArtwork')setInfoOpen(true);}
 async function toggleFullscreen(){
  const element=screen.current;if(!element)return;
  try{setFullscreenError('');if(document.fullscreenElement===element)await document.exitFullscreen();else await element.requestFullscreen();}
  catch{setFullscreenError('이 브라우저에서는 전체 화면을 사용할 수 없습니다. 현재 발표 화면에서 계속 볼 수 있습니다.');}
 }
 return <dialog ref={dialog} className="presentation-mode" aria-label="발표 모드" onCancel={onClose} onKeyDown={e=>{
  e.stopPropagation();
  if(e.metaKey||e.ctrlKey||e.altKey||e.target instanceof HTMLElement&&e.target.closest('input,select,textarea'))return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();changeScene(adjacentPresentationScene(ids,sceneId,e.key==='ArrowLeft'?-1:1));}
 }}>
 <div ref={screen} className="presentation-screen"><header className="presentation-header"><div><span className="presentation-brand">공간</span><span><strong>{source.project.name}</strong><small>{source.project.venue||'전시장 미지정'} · 발표 모드</small></span></div><div><button className="button secondary" aria-label={fullscreen?'전체 화면 종료':'발표 전체 화면'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={17}/>:<Maximize size={17}/>}<span>{fullscreen?'전체 화면 종료':'전체 화면'}</span></button><button className="button secondary" aria-label="발표 모드 닫기" onClick={onClose}><X size={17}/><span>{returnLabel}</span></button></div></header>
 <nav className="presentation-scenes" aria-label="발표 Scene"><button className="icon-button" aria-label="이전 발표 Scene" disabled={index===0} onClick={()=>changeScene(adjacentPresentationScene(ids,sceneId,-1))}><ChevronLeft size={20}/></button><label>배치<select aria-label="발표 배치 선택" value={sceneId??''} onChange={e=>changeScene(e.target.value||null)}><option value="">현재 배치</option>{source.project.scenes.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><span>{index+1} / {ids.length+1}</span><button className="icon-button" aria-label="다음 발표 Scene" disabled={index===ids.length} onClick={()=>changeScene(adjacentPresentationScene(ids,sceneId,1))}><ChevronRight size={20}/></button>{snapshot?.outdoor?.mode==='outdoor'&&<small>{snapshot.outdoor.date} {snapshot.outdoor.time} ({snapshot.outdoor.timeZone})</small>}</nav>
 {fullscreenError&&<p className="presentation-warning" role="status">{fullscreenError}</p>}
 {layout.error?<div className="presentation-error" role="alert"><strong>{layout.error}</strong><p>편집 화면에서 공간과 도면 축척을 확인하거나 다른 Scene을 선택하세요.</p></div>:snapshot&&layout.data&&<LengthUnitContext.Provider value={snapshot.displayUnit??'mm'}><ReadonlyAssetsContext.Provider value={layout.data}><div className="presentation-body"><section className="presentation-stage" aria-label="발표 전시장"><Suspense fallback={<p className="presentation-loading" role="status">3D를 불러오는 중…</p>}><SharedViewer3D key={sceneId??'current'} snapshot={snapshot} shareId="local-presentation" videoScope={videoScope} selectedId={selection?.kind==='artwork'||selection?.kind==='modelArtwork'?selection.id:null} referenceSelected={false} onSelect={select} reset={reset} cutaway={cutaway} measuring={false} measurePoints={[]} onMeasurePoint={()=>{}}/></Suspense><div className="presentation-view-tools"><button className="button secondary" aria-label="발표 시점 초기화" onClick={()=>setReset(v=>v+1)}><RotateCcw size={16}/>시점 초기화</button>{snapshot.walls.length>0&&<label><input type="checkbox" aria-label="발표 벽 자동 숨김" checked={cutaway} onChange={e=>setCutaway(e.target.checked)}/>벽 자동 숨김</label>}</div><p className="presentation-hint">드래그 회전 · 휠 확대 · 오른쪽 버튼 이동 · ← → Scene 전환</p></section><aside className="presentation-information" aria-label="발표 작품 정보"><button className="presentation-info-toggle" aria-expanded={infoOpen} onClick={()=>setInfoOpen(v=>!v)}>작품 정보 {infoOpen?'접기':'보기'}</button><div className={infoOpen?'presentation-info-content open':'presentation-info-content'}><label>작품<select aria-label="발표 작품 선택" value={art?`${selection!.kind}:${art.id}`:''} onChange={e=>{const value=e.target.value,colon=value.indexOf(':');select(value?{kind:value.slice(0,colon) as 'artwork'|'modelArtwork',id:value.slice(colon+1)}:null);}}><option value="">작품 선택</option>{snapshot.artworks.map(a=><option key={a.id} value={`artwork:${a.id}`}>{a.name}</option>)}{snapshot.modelArtworks?.map(a=><option key={a.id} value={`modelArtwork:${a.id}`}>{a.name} · 3D</option>)}</select></label><section>{art?<SharedArtworkInformation artwork={art} dimensions/>:<p>작품을 클릭하거나 목록에서 선택하세요.</p>}</section>{art&&'video' in art&&art.video&&<ReadonlyVideoControls artwork={{...art,video:art.video}} shareId="local-presentation" scope={videoScope}/>}<p className="presentation-private">작품 배치는 고정됩니다. 설치 메모는 표시하지 않습니다.</p></div></aside></div></ReadonlyAssetsContext.Provider></LengthUnitContext.Provider>}
 </div></dialog>;
}
