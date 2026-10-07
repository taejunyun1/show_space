import {useEffect,useMemo,useRef,useState} from 'react';
import {LoaderCircle,X} from 'lucide-react';
import {useEditor} from '../state/editor';
import {DEFAULT_OUTDOOR,localInstants} from '../domain/outdoor';
import {DEFAULT_COMPARISON_TIMES,appendTimeComparisonScenes,timeComparisonSource,type TimeComparisonOptions,type TimeComparisonFrame} from '../domain/timeComparison';
import {renderTimeComparison} from '../lib/timeComparison';
import type {PdfCurrentCamera} from '../lib/pdfRender3d';
import type {SceneThumbnail} from '../domain/types';
import {thumbnailFromBlob} from '../lib/sceneThumbnail';

interface ComparisonImage {url:string;frame:TimeComparisonFrame;thumbnail:SceneThumbnail}
export default function TimeComparisonDialog({onClose,getCamera}:{onClose:()=>void;getCamera:()=>PdfCurrentCamera|undefined}){
 const [project]=useState(()=>structuredClone(useEditor.getState().project)),[camera]=useState(()=>getCamera());
 const initial=project.outdoor??DEFAULT_OUTDOOR;
 const [options,setOptions]=useState<TimeComparisonOptions>({sceneId:'',date:initial.date,times:[...DEFAULT_COMPARISON_TIMES],occurrence:initial.occurrence});
 const [images,setImages]=useState<Array<ComparisonImage|undefined>>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),job=useRef<AbortController|null>(null),urls=useRef<string[]>([]),alive=useRef(true);
 const source=useMemo(()=>timeComparisonSource(project,options.sceneId),[project,options.sceneId]),outdoor=source.outdoor??DEFAULT_OUTDOOR;
 let repeated=false;try{repeated=options.times.some(time=>localInstants({...outdoor,date:options.date,time}).length>1);}catch{/* Raw incomplete date/time input is validated when rendering. */}
 function clear(){job.current?.abort();job.current=null;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];setImages([]);setBusy(false);setError('');setSaved(false);}
 function update(patch:Partial<TimeComparisonOptions>){clear();setOptions(o=>({...o,...patch}));}
 useEffect(()=>{alive.current=true;dialog.current?.showModal();return()=>{alive.current=false;job.current?.abort();urls.current.forEach(url=>URL.revokeObjectURL(url));};},[]);
 async function compare(){
  if(job.current)return;
  clear();const controller=new AbortController();job.current=controller;setBusy(true);
  try{
   await renderTimeComparison(project,options,camera,controller.signal,async(frame,png,index)=>{
    const blob=new Blob([new Uint8Array(png)],{type:'image/png'}),thumbnail=await thumbnailFromBlob(blob,'3d',controller.signal);
    if(!alive.current||job.current!==controller)return;
    const url=URL.createObjectURL(blob);urls.current.push(url);
    setImages(previous=>{const next=[...previous];next[index]={url,frame,thumbnail};return next;});
   });
  }catch(e){if(alive.current&&job.current===controller&&!controller.signal.aborted)setError(e instanceof Error?e.message:'시간대 비교를 만들지 못했습니다.');}
  finally{if(alive.current&&job.current===controller){job.current=null;setBusy(false);}}
 }
 function saveScenes(){
  try{if(images.filter(Boolean).length!==4)throw new Error('네 시간대의 비교 화면을 먼저 만들어주세요.');const state=useEditor.getState();state.commit(appendTimeComparisonScenes(state.project,project,options,camera?.view,images.map(i=>i!.thumbnail)));setSaved(true);state.notify('비교한 시간대 네 개를 미리보기와 함께 Scene으로 저장했습니다.');}
  catch(e){setError(e instanceof Error?e.message:'Scene을 저장하지 못했습니다.');}
 }
 return <dialog ref={dialog} className="export-dialog time-comparison-dialog" aria-label="시간대 비교" onCancel={onClose}>
  <div className="dialog-header"><div><h2>시간대 비교</h2><p>같은 배치·시점에서 시간에 따른 빛과 그림자를 비교하세요.</p></div><button className="icon-button" aria-label="시간대 비교 닫기" onClick={onClose}><X size={18}/></button></div>
  <div className="time-comparison-settings"><label>기준 배치<select aria-label="시간 비교 기준 배치" value={options.sceneId} onChange={e=>{const p=timeComparisonSource(project,e.target.value),s=p.outdoor??DEFAULT_OUTDOOR;update({sceneId:e.target.value,date:s.date,occurrence:s.occurrence});}}><option value="">현재 배치</option>{project.scenes.map(scene=><option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label><label>날짜<input type="date" aria-label="비교 날짜" value={options.date} min="1901-01-01" max="2099-12-31" onChange={e=>update({date:e.target.value})}/></label>{repeated&&<label>중복 현지 시간<select aria-label="비교 서머타임 중복 시간" value={options.occurrence} onChange={e=>update({occurrence:e.target.value as TimeComparisonOptions['occurrence']})}><option value="earlier">첫 번째 시간</option><option value="later">두 번째 시간</option></select></label>}</div>
  <p className="dialog-footnote time-comparison-location">{outdoor.timeZone} · 위도 {outdoor.latitude.toFixed(4)}° / 경도 {outdoor.longitude.toFixed(4)}° · 북쪽 {outdoor.northDeg}°{!source.outdoor?' · 서울 예시 위치':''}</p>
  <div className="time-comparison-grid">{options.times.map((time,index)=>{const image=images[index];return <section className="time-comparison-card" key={index} aria-label={`시간 비교 ${index+1}`}><label>시간 {index+1}<input type="time" aria-label={`비교 시간 ${index+1}`} value={time} onChange={e=>update({times:options.times.map((t,i)=>i===index?e.target.value:t)})}/></label>{image?<><img src={image.url} alt={`${image.frame.name} 야외 전시 비교`}/><p>{image.frame.project.outdoor!.date} {image.frame.project.outdoor!.time} · 태양 높이 {image.frame.sun.elevation.toFixed(1)}° · {image.frame.sun.elevation<=0?'직사광 꺼짐':`방위 ${image.frame.sun.azimuth.toFixed(0)}°`}</p></>:<div className="time-comparison-empty">{busy?'비교 화면 만드는 중…':'시간을 선택하고 비교를 시작하세요.'}</div>}</section>;})}</div>
  {busy&&<p role="status" className="dialog-footnote">비교 화면 {images.filter(Boolean).length}/4 · 만드는 중</p>}{error&&<p role="alert" className="capture-error">{error}</p>}
  <div className="time-comparison-actions"><button className="button primary" disabled={busy} onClick={()=>void compare()}>{busy&&<LoaderCircle className="spin" size={16}/>}시간대 비교 시작</button>{busy&&<button className="button secondary" onClick={clear}>비교 취소</button>}<button className="button secondary" disabled={busy||images.filter(Boolean).length!==4||!!error||saved} onClick={saveScenes}>{saved?'Scene 저장 완료':'네 시간대 Scene 저장'}</button></div>
  <details className="time-comparison-help"><summary>비교 기준 안내</summary><p className="dialog-footnote">{!source.outdoor?'위치는 서울 예시입니다. 전시 환경에서 실제 위치를 설정하세요. ':''}비교 이미지만 야외 태양광을 사용하며 현재 편집 배치·시간·시점은 유지합니다. 편집 시점의 방향과 벽 자동 숨김을 유지하고, 정투영 공간은 비교 칸에 맞춰 표시합니다. 개별 조명·재질·작품은 기준 배치를 유지합니다. 실제 날씨·주변 건물과 지형은 반영하지 않는 태양광 근사입니다. Scene 저장은 실행 취소할 수 있습니다.</p></details>
 </dialog>;
}
