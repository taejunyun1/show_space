import {useLengthFormatter} from './LengthUnits';
import {ArtworkLibraryDialog} from './ArtworkLibraryDialog';
import {ArtworkSeriesDialog} from './ArtworkSeriesDialog';
import {OutdoorDialog} from './OutdoorDialog';
import {LightingDialog} from './LightingDialog';
import {FloorMaterialDialog} from './FloorMaterialDialog';
import {ReferenceModelControls} from './ReferenceModelControls';
import { useEffect, useMemo, useRef, useState } from 'react';
import {searchProjectObjects,type OutlinerObjectType} from '../domain/outlinerSearch';
import { Library, Lightbulb, Box, Plus, Eye, EyeOff, LockKeyhole, PanelTop, Layers, ImagePlus, Film, Search, X } from 'lucide-react';
import { useEditor } from '../state/editor';
import { artStyle, readImage } from '../lib/art';
type ImportTask={projectId:string;wallId:string};

export function Outliner() {
 const formatLength = useLengthFormatter();
  const { project, selected, activeWallId, select, setActiveWall, patchWall, patchArtwork, addArtwork, addWall, placeUnplaced, notify } = useEditor();
  const provisional = !!project.planDraft && !project.planReference?.calibrated;
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [seriesOpen,setSeriesOpen]=useState(false);
  const [tab, setTab] = useState<'all' | 'artwork'>('all');
  const [query,setQuery]=useState('');
  const results=useMemo(()=>searchProjectObjects(project,query,tab),[project,query,tab]);
  const matches=useMemo(()=>new Set(results.map(r=>r.type+':'+r.id)),[results]);
  const shows=(type:OutlinerObjectType,id='')=>matches.has(type+':'+id),searching=!!query.trim();
  const matchingWalls=project.walls.filter(w=>shows('wall',w.id)),matchingLights=(project.lights??[]).filter(l=>shows('light',l.id));
  const matchingArtworks=results.filter(r=>r.type==='artwork'||r.type==='modelArtwork'),matchingUnplaced=(project.unplacedArtworks??[]).filter(a=>shows('unplacedArtwork',a.id));
  useEffect(()=>setQuery(''),[project.id]);
  const videoUpload=useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null),modelUpload=useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const mounted=useRef(false),importTask=useRef<ImportTask|null>(null);
  useEffect(()=>{
    mounted.current=true;
    // Subscribe to each transition, including A→B→A inside one React batch.
    const unsubscribe=useEditor.subscribe((next,previous)=>{if(next.project.id!==previous.project.id){importTask.current=null;setBusy(false);}});
    return()=>{unsubscribe();mounted.current=false;importTask.current=null;};
  },[]);
  const [floorMaterialOpen,setFloorMaterialOpen]=useState(false),[lightingOpen,setLightingOpen]=useState(false),[outdoorOpen,setOutdoorOpen]=useState(false);
  const unplaced = project.unplacedArtworks ?? [];

  async function runImport<T>(load:()=>Promise<T>,apply:(value:T,task:ImportTask)=>void,status?:string){
    if(importTask.current||!mounted.current)return;
    const state=useEditor.getState(),task={projectId:state.project.id,wallId:state.activeWallId};importTask.current=task;setBusy(true);
    const current=()=>mounted.current&&importTask.current===task&&useEditor.getState().project.id===task.projectId;
    if(status)notify(status);
    try{const value=await load();if(current())apply(value,task);}
    catch(error){if(current())notify(error instanceof Error?error.message:'작품 파일을 읽지 못했습니다.');}
    finally{if(current()){importTask.current=null;setBusy(false);}}
  }
  async function uploadArtwork(file:File){await runImport(()=>readImage(file),(imageUrl,task)=>useEditor.getState().addArtwork(imageUrl,file.name.replace(/\.[^.]+$/, ''),task));}
  async function uploadVideoArtwork(file:File){await runImport(async()=>{const {readVideoArtworkFile}=await import('../lib/videoArtworkImport');return readVideoArtworkFile(file);},(template,task)=>{const state=useEditor.getState();state.installLibraryArtwork(template,task.projectId,task.wallId);state.setView('3d');notify('영상 스크린을 추가했습니다. 오른쪽에서 재생과 화면 비율을 조절하세요.');},'영상을 읽고 첫 프레임을 준비하고 있습니다…');}
  async function uploadModelArtworks(files:File[]){await runImport(async()=>{const {readModelArtworkFiles}=await import('../lib/modelArtworkImport');return readModelArtworkFiles(files);},(model,task)=>useEditor.getState().addModelArtwork(model,task.projectId),'3D 작품과 자산을 읽고 있습니다…');}
  return <><aside className="outliner">
    <div className="panel-heading"><h1>전시 구성</h1><span className="count">{project.artworks.length + unplaced.length+(project.modelArtworks?.length??0)}</span></div>
    <div className="segment"><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>공간</button><button className={tab === 'artwork' ? 'selected' : ''} onClick={() => setTab('artwork')}>작품</button></div>
    <div className="outliner-search"><Search size={14}/><input type="search" aria-label="공간 객체 검색" placeholder="작품·벽·재질 검색" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setQuery('');}}}/>{query&&<button aria-label="객체 검색 지우기" onClick={()=>setQuery('')}><X size={14}/></button>}</div>
    {searching&&<p className="outliner-search-status" role="status">{results.length}개 결과 · 숨김 포함</p>}
    <div className="entity-list">
      {searching&&!results.length&&<p className="empty-hint">검색 결과가 없습니다. 이름·작가·벽·재질을 검색하세요.</p>}
      {tab === 'all' && (!searching||matchingWalls.length>0||shows('floor')) && <section>
        <div className="section-label">ARCHITECTURE<button aria-label="벽 추가" title="벽 추가" onClick={addWall}><Plus size={14} /></button></div>
        {matchingWalls.map(wall => <div className={`entity-row ${selected.some(s => s.id === wall.id) ? 'selected' : ''}`} key={wall.id}>
          <button className={`entity-main ${!wall.visible ? 'muted' : ''}`} onClick={e => select({ type: 'wall', id: wall.id }, e.shiftKey)}><PanelTop size={23} strokeWidth={1.2} /><span>{wall.name}</span>{wall.locked && <LockKeyhole size={12} />}</button>
          <button className="row-action" aria-label={`${wall.name} ${wall.visible ? '숨기기' : '보이기'}`} onClick={() => patchWall(wall.id, { visible: !wall.visible })}>{wall.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
        </div>)}
        {shows('floor')&&<div className="floor-row"><Layers size={23} strokeWidth={1.2} /><button aria-label="바닥 재질 편집" onClick={()=>setFloorMaterialOpen(true)}>바닥 · 재질</button><input type="color" aria-label="바닥 색상" value={project.floorColor} onChange={e => useEditor.getState().patchProject({ floorColor: e.target.value })} /></div>}
      </section>}
      {tab==='all'&&(!searching||matchingLights.length>0)&&<section><div className="section-label">LIGHTING<span>{project.lights?.length??0}/20</span></div><div className="rotation-buttons"><button className="button secondary" disabled={provisional||(project.lights?.length??0)>=20} onClick={()=>useEditor.getState().addLight('spot')}>스팟 추가</button><button className="button secondary" disabled={provisional||(project.lights?.length??0)>=20} onClick={()=>useEditor.getState().addLight('area')}>면조명 추가</button></div><button className="button secondary full" disabled={provisional||(project.lights?.length??0)>=20||(project.lights??[]).filter(l=>l.projection).length>=2} onClick={()=>useEditor.getState().addLight('projector')}>프로젝터 추가</button>{matchingLights.map(light=><div key={light.id} className={`entity-row ${selected.some(s=>s.type==='light'&&s.id===light.id)?'selected':''}`}><button className={`entity-main ${!light.visible?'muted':''}`} onClick={e=>select({type:'light',id:light.id},e.shiftKey)}><Lightbulb size={20}/><span>{light.name}</span>{light.locked&&<LockKeyhole size={12}/>}</button><button className="row-action" aria-label={`${light.name} ${light.visible?'숨기기':'보이기'}`} onClick={()=>useEditor.getState().patchLight(light.id,{visible:!light.visible})}>{light.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button></div>)}<button className="text-button" onClick={()=>setLightingOpen(true)}>공간 기본 조명</button><button className="text-button" disabled={provisional} onClick={()=>setOutdoorOpen(true)}>야외 환경 · 태양과 시간</button></section>}
      {(!searching||matchingArtworks.length>0)&&<section>
        <div className="section-label">ARTWORK<span>{searching?`${matchingArtworks.length} / `:''}{project.artworks.length+(project.modelArtworks?.length??0)}</span></div>
        <button className="button secondary full series-launch" disabled={busy||provisional||project.artworks.length+unplaced.length<2} onClick={()=>setSeriesOpen(true)}>시리즈 자동 배열</button>
        {project.artworks.map((art, i) => shows('artwork',art.id)?<div className={`entity-row artwork-row ${selected.some(s => s.id === art.id) ? 'selected' : ''}`} key={art.id}>
          <button className={`entity-main ${!art.visible ? 'muted' : ''}`} onClick={e => select({ type: 'artwork', id: art.id }, e.shiftKey)}><span className="art-thumbnail" style={artStyle(art.imageUrl)} /><span className="entity-text"><strong>{art.name}</strong><small>{art.video?'영상 작품':'작품'} {String(i + 1).padStart(2, '0')}</small></span>{art.locked && <LockKeyhole size={12} />}</button>
          <button className="row-action" aria-label={`${art.name} ${art.visible ? '숨기기' : '보이기'}`} onClick={() => patchArtwork(art.id, { visible: !art.visible })}>{art.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
        </div>:null)}
        {project.modelArtworks?.filter(a=>shows('modelArtwork',a.id)).map(a=><div key={a.id} className={`entity-row artwork-row ${selected.some(s=>s.type==='modelArtwork'&&s.id===a.id)?'selected':''}`}><button className={`entity-main ${!a.visible?'muted':''}`} onClick={e=>select({type:'modelArtwork',id:a.id},e.shiftKey)}><Box size={25}/><span className='entity-text'><strong>{a.name}</strong><small>3D 작품 · {[a.widthMm,a.heightMm,a.depthMm].map(formatLength).join(' × ')}</small></span>{a.locked&&<LockKeyhole size={12}/>}</button><button className='row-action' aria-label={`${a.name} ${a.visible?'숨기기':'보이기'}`} onClick={()=>useEditor.getState().patchModelArtwork(a.id,{visible:!a.visible})}>{a.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button></div>)}
        {project.artworks.length === 0 && !project.modelArtworks?.length && unplaced.length === 0 && <p className="empty-hint">첫 작품을 등록해 전시를 시작하세요.</p>}
      </section>}
      {matchingUnplaced.length > 0 && <section className="unplaced-section">
        <div className="section-label">미배치 작품<span>{searching?`${matchingUnplaced.length} / `:''}{unplaced.length}</span></div>
        <label className="unplaced-target">배치할 벽<select aria-label="미배치 작품을 배치할 벽" value={activeWallId} onChange={e => setActiveWall(e.target.value)}>{project.walls.map(wall => <option key={wall.id} value={wall.id}>{wall.name}</option>)}</select></label>
        {matchingUnplaced.map(art => <div className="unplaced-row" key={art.id}>
          <span className="art-thumbnail" style={artStyle(art.imageUrl)} />
          <span className="entity-text"><strong>{art.name}</strong><small>설치 벽 미지정</small></span>
          <button aria-label={`${art.name} ${project.walls.find(wall => wall.id === activeWallId)?.name ?? '선택한 벽'}에 배치`} onClick={() => placeUnplaced(art.id)}>배치</button>
        </div>)}
      </section>}
    </div>
    <ReferenceModelControls hidden={searching&&!shows('referenceModel')}/>
    <div className="add-art-card"><Box size={19} strokeWidth={1.4} /><strong>작품을 더해보세요</strong><p>{provisional ? '두 점 축척 보정 후 실제 크기의 작품을 추가할 수 있습니다.' : <>이미지와 실제 크기로<br />나만의 전시를 구성하세요.</>}</p><button className="button outline" disabled={busy || provisional} onClick={() => upload.current?.click()}><ImagePlus size={16} />{busy ? '이미지 처리 중' : '작품 추가'}</button><button className="button outline" disabled={busy||provisional} onClick={()=>videoUpload.current?.click()}><Film size={16}/>영상 작품 추가</button><input ref={videoUpload} type="file" hidden aria-label="영상 작품 파일" accept=".mp4,.webm,video/mp4,video/webm" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void uploadVideoArtwork(file);}}/><p className="field-hint">MP4·WebM / 16MB 이하 · 긴 변 1,920px 이하</p><button className="button outline" disabled={busy||provisional||(project.modelArtworks?.length??0)>=50} onClick={()=>modelUpload.current?.click()}><Box size={16}/>3D 작품 추가</button><p className="field-hint">GLB · glTF와 자산 · glTF ZIP / 12MB 이하</p><button className="button outline" onClick={()=>setLibraryOpen(true)}><Library size={16}/>작품 라이브러리</button><input ref={modelUpload} type="file" hidden multiple aria-label="3D 작품 파일" accept=".glb,.gltf,.zip,.bin,.png,.jpg,.jpeg,.webp" onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';if(files.length)void uploadModelArtworks(files);}}/><button className="text-button" disabled={provisional} onClick={() => addArtwork()}>예제 작품 추가</button><input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={upload} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadArtwork(f); e.currentTarget.value = ''; }} /></div>
  </aside>{seriesOpen&&<ArtworkSeriesDialog project={project} initialIds={selected.filter(s=>s.type==='artwork').map(s=>s.id)} initialWallId={activeWallId} onApply={options=>useEditor.getState().arrangeArtworkSeries(options,project.id)?null:useEditor.getState().message??'시리즈 배열을 완료하지 못했습니다.'} onClose={()=>setSeriesOpen(false)}/>} {libraryOpen&&<ArtworkLibraryDialog onClose={()=>setLibraryOpen(false)}/>} {outdoorOpen&&<OutdoorDialog onClose={()=>setOutdoorOpen(false)}/>} {lightingOpen&&<LightingDialog onClose={()=>setLightingOpen(false)}/>} {floorMaterialOpen&&<FloorMaterialDialog onClose={()=>setFloorMaterialOpen(false)}/>}</>;
}
