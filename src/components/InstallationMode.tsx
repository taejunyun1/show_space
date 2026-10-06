import {useEffect,useMemo,useRef,useState} from 'react';
import {ClipboardCheck,X} from 'lucide-react';
import {useEditor} from '../state/editor';
import {INSTALLATION_STAGES,readNote,type NoteTarget} from '../domain/notes';
import {installationArtworks,installationDetails,installationNotes,installationProgress} from '../domain/installation';
import {installationDrawing} from '../domain/readonlyDrawing';
import {artworkElevationDimensions,installationDimensionLabel} from '../domain/artworkElevationDimensions';
import {artworkPresentation} from '../domain/artworkPresentation';
import {wallLength} from '../domain/wallGeometry';
import {formatLength} from '../domain/lengthUnits';
import type {WorldPoint} from '../domain/types';
import {SharedPlan,SharedElevation} from './SharedViewer';
import {nextMeasurePoints,measurementDistance} from './sharedMeasure';
import {NoteEditor} from './NoteEditor';
import './installationMode.css';
const key=(target:NoteTarget)=>target.type+('id' in target?':'+target.id:'');
export default function InstallationMode({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),project=useEditor(s=>s.project),patch=useEditor(s=>s.patchNote);
 const rows=useMemo(()=>installationArtworks(project),[project]),notes=useMemo(()=>installationNotes(project),[project]),progress=useMemo(()=>installationProgress(project),[project]);
 const drawing=useMemo(()=>installationDrawing(project),[project]);
 const [artId,setArtId]=useState(()=>useEditor.getState().selected.find(s=>s.type==='artwork'||s.type==='modelArtwork')?.id??rows[0]?.artwork.id??'');
 const [wallId,setWallId]=useState(project.artworks.find(a=>a.id===artId)?.wallId??drawing.walls[0]?.id??''),[side,setSide]=useState<'front'|'back'>(project.artworks.find(a=>a.id===artId)?.wallSide??'front'),[view,setView]=useState<'plan'|'elevation'>('plan'),[query,setQuery]=useState(''),[zoom,setZoom]=useState(1);
 const [noteKey,setNoteKey]=useState(''),[allChecks,setAllChecks]=useState(false),[measuring,setMeasuring]=useState(false),[points,setPoints]=useState<WorldPoint[]>([]);
 const row=rows.find(r=>r.artwork.id===artId),wall=drawing.walls.find(w=>w.id===wallId)??drawing.walls[0];
 const modelPosition=row?.kind==='model'?row.artwork.position:undefined;
 const art=row?.kind==='mounted'?row.artwork:undefined;
 const target=notes.find(n=>key(n.target)===noteKey)?.target??row?.target??{type:'project' as const};
 const selectedNote=readNote(project,target),calibrated=!project.planDraft||!!project.planReference?.calibrated;
 const filtered=rows.filter(r=>(r.artwork.name+' '+r.artwork.artist+' '+r.location).normalize('NFC').toLocaleLowerCase().includes(query.normalize('NFC').trim().toLocaleLowerCase()));
 const format=(n:number)=>formatLength(n,project.displayUnit),dimensions=art?artworkElevationDimensions(project,art.wallId,art.wallSide??'front',[art.id]):[];
 useEffect(()=>{ref.current?.showModal();},[]);
 function choose(id:string){const selected=rows.find(r=>r.artwork.id===id);setArtId(id);setNoteKey('');setPoints([]);if(selected?.kind==='mounted'){setWallId(selected.artwork.wallId);setSide(selected.artwork.wallSide??'front');}}
 function select(selection:{kind:string;id:string}|null){if(!selection)return;setPoints([]);if(selection.kind==='artwork'||selection.kind==='modelArtwork')choose(selection.id);else if(selection.kind==='wall'){setWallId(selection.id);setArtId('');setNoteKey('wall:'+selection.id);}}
 function check(target:NoteTarget,id:string,done:boolean){const latest=readNote(useEditor.getState().project,target).details;patch(target,{details:{...latest,checklist:latest.checklist.map(c=>c.id===id?{...c,done}:c)}});}
 return <dialog ref={ref} className="installation-mode" aria-label="현장 설치 모드" onCancel={onClose}>
 <header className="installation-header"><div><h2><ClipboardCheck size={22}/>현장 설치</h2><p>{project.name} · {project.venue||'전시장 미지정'}</p></div><button className="button secondary" aria-label="현장 설치 모드 닫기" onClick={onClose}><X size={18}/>편집으로 돌아가기</button></header>
 <section className="installation-summary" aria-label="전체 설치 진행"><span>설치 완료 <strong>{progress.installed} / {progress.artworks}점</strong></span><span>준비 단계 <strong>{progress.done} / {progress.steps}</strong></span><button aria-expanded={allChecks} onClick={()=>setAllChecks(v=>!v)}>추가 체크 <strong>{progress.checksDone} / {progress.checks}</strong></button><small>벽·작품 위치는 고정됩니다. 메모와 설치 상태는 저장됩니다.</small></section>
 {allChecks&&<section className="installation-all-checks" aria-label="프로젝트 전체 체크리스트"><h3>전체 추가 체크리스트</h3>{notes.map(n=>{const checks=readNote(project,n.target).details.checklist;return checks.length?<fieldset key={key(n.target)}><legend>{n.label}</legend>{checks.map(c=><label key={c.id}><input type="checkbox" aria-label={`${n.label} · ${c.text||'빈 체크 항목'}`} checked={c.done} onChange={e=>check(n.target,c.id,e.target.checked)}/>{c.text||'빈 체크 항목'}</label>)}</fieldset>:null;})}{!progress.checks&&<p>객체·프로젝트 메모에서 추가한 체크 항목이 여기에 모입니다.</p>}</section>}
 <div className="installation-body"><section className="installation-space" aria-label="설치 도면">
 <div className="installation-tools"><nav aria-label="현장 보기"><button aria-pressed={view==='plan'} onClick={()=>{setView('plan');setPoints([]);}}>평면도</button><button aria-pressed={view==='elevation'} disabled={!drawing.walls.length} onClick={()=>{setView('elevation');setPoints([]);}}>벽면도</button></nav><button aria-pressed={measuring} disabled={!calibrated} onClick={()=>{setMeasuring(v=>!v);setPoints([]);}}>임시 줄자</button><button aria-label="도면 축소" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="도면 확대" disabled={zoom>=3} onClick={()=>setZoom(v=>Math.min(3,v+.5))}>+</button></div>
 <div className="installation-pickers"><label>작품 검색<input aria-label="현장 작품 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="작품·작가·벽"/></label><label>작품<select aria-label="현장 작품 선택" value={filtered.some(r=>r.artwork.id===artId)?artId:''} onChange={e=>choose(e.target.value)}><option value="">{filtered.length?'작품 선택':'검색 결과 없음'}</option>{filtered.map(r=><option key={r.artwork.id} value={r.artwork.id}>{r.artwork.name} · {r.location}{r.status!=='배치됨'?' · '+r.status:''}</option>)}</select></label>{view==='elevation'&&<><label>벽<select aria-label="현장 벽 선택" value={wall?.id??''} onChange={e=>{setWallId(e.target.value);setArtId('');setPoints([]);setNoteKey('wall:'+e.target.value);}}>{drawing.walls.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>면<select aria-label="현장 벽면 선택" value={side} onChange={e=>{setSide(e.target.value as 'front'|'back');setPoints([]);}}><option value="front">A면</option><option value="back">B면</option></select></label></>}</div>
 {!calibrated&&<p className="warning">도면 축척이 미정입니다. 벽·설치 치수를 사용하기 전에 편집 화면에서 축척을 보정하세요.</p>}
 {row?.status!=='배치됨'&&row&&<p className="field-hint">선택 작품은 {row.status} 상태입니다. 도면에는 표시되지 않습니다.</p>}
 <div className="installation-diagram"><div style={{width:`${zoom*100}%`,height:`${zoom*100}%`}}>{view==='plan'?<SharedPlan technical label="현장 전시장 평면도" snapshot={drawing} selectedId={artId||wall?.id||null} onSelect={select} measuring={measuring&&calibrated} measurePoints={points} onMeasurePoint={p=>setPoints(current=>nextMeasurePoints(current,p))}/>:<SharedElevation snapshot={drawing} wallId={wall?.id??null} side={side} selectedId={artId||null} onSelect={select} measuring={measuring&&calibrated} measurePoints={points} onMeasurePoint={p=>setPoints(current=>nextMeasurePoints(current,p))}/>}</div></div>
 <p className="installation-measure" role="status">{measuring?(points.length===2?`임시 측정 ${format(measurementDistance(points[0],points[1]))} · 다음 점을 누르면 새 측정`:`도면에서 ${points.length?'끝점':'시작점'}을 선택하세요`):'도면을 눌러 선택하세요. 확대 후 화면을 스크롤해 이동할 수 있습니다.'}</p>
 </section><aside className="installation-info"><section aria-label="현장 설치 치수"><h3>{row?.artwork.name??wall?.name??'전시 공간'}</h3>{row&&<><p>{row.location} · {row.status}</p><dl><div><dt>본체 크기</dt><dd>{[row.artwork.widthMm,row.artwork.heightMm,row.artwork.depthMm].map(format).join(' × ')}</dd></div>{art&&<><div><dt>액자 포함 크기</dt><dd>{(()=>{const p=artworkPresentation(art);return [p.widthMm,p.heightMm,p.depthMm].map(format).join(' × ');})()}</dd></div>{calibrated&&<><div><dt>설치 면 · 중심 높이</dt><dd>{art.wallSide==='back'?'B':'A'}면 · {format(art.centerHeightMm)}</dd></div>{dimensions.map(d=><div key={d.key}><dt>{installationDimensionLabel(d)}{d.kind==='gap'&&` · ${project.artworks.find(a=>a.id===d.artworkIds.find(id=>id!==art.id))?.name??''}`}</dt><dd>{format(d.distanceMm)}</dd></div>)}</>}</>}</dl>{row.kind==='model'&&<dl>{(['x','y','z'] as const).map(axis=><div key={axis}><dt>위치 {axis.toUpperCase()}</dt><dd>{format(modelPosition![axis])}</dd></div>)}</dl>}</>}{!row&&wall&&calibrated&&<p>길이 {format(wallLength(wall))} · 높이 {format(wall.heightMm)} · 두께 {format(wall.thicknessMm)}</p>}</section>
 {row&&<section className="installation-stages" aria-label="작품 설치 상태"><h3>작품 설치 상태</h3>{INSTALLATION_STAGES.map(([stage,label])=><label key={stage}><input type="checkbox" aria-label={label} checked={!!row.artwork.noteDetails?.installation?.[stage]} onChange={e=>patch(row.target,{details:installationDetails(useEditor.getState().project,row.target,stage,e.target.checked)})}/>{label}</label>)}</section>}
 <label className="installation-note-scope">메모 대상<select aria-label="현장 메모 대상" value={key(target)} onChange={e=>setNoteKey(e.target.value)}>{notes.map(n=><option key={key(n.target)} value={key(n.target)}>{n.label}</option>)}</select></label>
 <NoteEditor key={key(target)} target={target} label="현장 NOTE"/>{selectedNote.text&&<span className="installation-private">설치 메모와 확인 상태는 공개 링크에 포함되지 않습니다.</span>}
 </aside></div></dialog>;
}
