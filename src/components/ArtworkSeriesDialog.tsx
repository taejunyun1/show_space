import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,X} from 'lucide-react';
import {planArtworkSeries,type ArtworkSeriesOptions} from '../domain/artworkSeries';
import type {Project} from '../domain/types';
import {NumberField} from './Controls';
import {useLengthFormatter} from './LengthUnits';

export function ArtworkSeriesDialog({project,initialIds,initialWallId,onApply,onClose}:{project:Project;initialIds:string[];initialWallId:string;onApply:(options:ArtworkSeriesOptions)=>string|null;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),originalProject=useRef(project.id),format=useLengthFormatter();
 const available=[...project.artworks,...project.unplacedArtworks??[]],allIds=new Set(available.map(a=>a.id));
 const initial=initialIds.length?initialIds.filter(id=>allIds.has(id)):available.filter(a=>!a.locked&&a.visible).slice(0,7).map(a=>a.id);
 const [order,setOrder]=useState(initial),[count,setCount]=useState(initial.length),[wallId,setWallId]=useState(project.walls.some(w=>w.id===initialWallId)?initialWallId:project.walls[0]?.id??'');
 const [wallSide,setWallSide]=useState<'front'|'back'>(available.find(a=>a.id===initial[0])?.wallSide??'front'),[axis,setAxis]=useState<'horizontal'|'vertical'>('horizontal');
 const [gapMm,setGap]=useState(250),[centerHeightMm,setHeight]=useState(available.find(a=>a.id===initial[0])?.centerHeightMm??1500),[group,setGroup]=useState(true),[applyError,setApplyError]=useState('');
 const options=useMemo(()=>({artworkIds:order,count,wallId,wallSide,axis,gapMm,centerHeightMm,group}),[order,count,wallId,wallSide,axis,gapMm,centerHeightMm,group]);
 const preview=useMemo(()=>{try{if(project.id!==originalProject.current)throw new Error('프로젝트가 변경됐습니다.');return {plan:planArtworkSeries(project,options),error:''};}catch(e){return {plan:null,error:e instanceof Error?e.message:'배열 조건을 확인해 주세요.'};}},[project,options]);
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{if(project.id!==originalProject.current)onClose();},[project.id,onClose]);
 useEffect(()=>setApplyError(''),[options]);
 function toggle(id:string){const next=order.includes(id)?order.filter(item=>item!==id):[...order,id];setOrder(next);setCount(count===order.length?next.length:Math.min(count,next.length));}
 function move(index:number,delta:number){const next=[...order];[next[index],next[index+delta]]=[next[index+delta],next[index]];setOrder(next);}
 function apply(){if(preview.error)return;const error=onApply(options);if(error)setApplyError(error);else onClose();}
 return <dialog ref={dialog} className="series-dialog" aria-label="시리즈 자동 배열" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="dialog-header"><div><h2>시리즈 자동 배열</h2><p>작품을 고르고 순서·수량·간격을 정하면 한 번에 설치합니다.</p></div><button type="button" className="icon-button" aria-label="시리즈 창 닫기" onClick={onClose}><X size={18}/></button></div>
  <div className="series-columns">
   <section className="series-choose"><h3>시리즈 작품 선택</h3><p className="field-hint">이미 배치한 작품과 미배치 작품을 함께 고를 수 있습니다.</p><div className="series-candidates">{available.map(a=><label key={a.id}><input type="checkbox" aria-label={`${a.name} 시리즈에 포함`} checked={order.includes(a.id)} disabled={!order.includes(a.id)&&(a.locked||!a.visible)} onChange={()=>toggle(a.id)}/><span>{a.name}<small>{'wallId' in a?'배치됨':'미배치'}{a.locked?' · 잠김':''}{!a.visible?' · 숨김':''}</small></span></label>)}</div>
    <h3>배열 순서</h3><p className="field-hint">아래 목록의 앞 {Number.isInteger(count)?count:'지정한 수량'}점을 가로는 왼쪽부터, 세로는 위에서부터 배치합니다.</p><ol className="series-order">{order.map((id,index)=><li key={id} className={index>=count?'series-unused':''}><span>{available.find(a=>a.id===id)?.name??'삭제된 작품'}</span><button type="button" aria-label={`${index+1}번 작품 앞으로`} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={15}/></button><button type="button" aria-label={`${index+1}번 작품 뒤로`} disabled={index===order.length-1} onClick={()=>move(index,1)}><ArrowDown size={15}/></button></li>)}</ol>
   </section>
   <section className="series-settings"><h3>설치 조건</h3><NumberField label="배열할 작품 수" value={count} onChange={setCount} min={2} max={order.length} step={1} suffix="점"/>
    <label className="select-field"><span>설치 벽</span><select aria-label="시리즈 설치 벽" value={wallId} onChange={e=>setWallId(e.target.value)}>{project.walls.map(w=><option key={w.id} value={w.id}>{w.name}{!w.visible?' · 숨김':''}</option>)}</select></label>
    <label className="select-field"><span>설치 면</span><select aria-label="시리즈 설치 면" value={wallSide} onChange={e=>setWallSide(e.target.value as typeof wallSide)}><option value="front">A면</option><option value="back">B면</option></select></label>
    <label className="select-field"><span>배열 방향</span><select aria-label="시리즈 배열 방향" value={axis} onChange={e=>setAxis(e.target.value as typeof axis)}><option value="horizontal">가로 · 왼쪽부터</option><option value="vertical">세로 · 위에서부터</option></select></label>
    <NumberField label="시리즈 작품 간격" value={gapMm} onChange={setGap} min={0} max={50000}/><NumberField label="배열 중심 높이" value={centerHeightMm} onChange={setHeight} min={0} max={20000}/>
    <p className="field-hint">벽의 가로 중앙에 배치합니다. 가로 배열은 작품의 공통 중심 높이, 세로 배열은 시리즈 전체의 중심 높이입니다. 간격은 액자·매트·회전을 포함한 외곽 기준입니다.</p>
    <label className="series-group"><input type="checkbox" aria-label="배열 뒤 작품 그룹 만들기" checked={group} onChange={e=>setGroup(e.target.checked)}/>배열 뒤 함께 이동할 그룹으로 묶기</label>
    {preview.plan&&<div className="series-preview"><svg role="img" aria-label="시리즈 외곽 배치 미리보기" viewBox={`0 0 ${preview.plan.wallWidthMm} ${preview.plan.wall.heightMm}`}><title>{`${count}점 · ${wallSide==='front'?'A면':'B면'} · 간격 ${format(gapMm)}`}</title><rect width={preview.plan.wallWidthMm} height={preview.plan.wall.heightMm} fill="#f2f5fa" stroke="#bdc9db"/>{preview.plan.occupied.map(item=><rect key={item.id} x={item.x-item.widthMm/2} y={preview.plan!.wall.heightMm-item.y-item.heightMm/2} width={item.widthMm} height={item.heightMm} fill="#a3acba" opacity=".5"/>)}{preview.plan.items.map((item,index)=><g key={item.artwork.id}><rect x={item.x-item.widthMm/2} y={preview.plan!.wall.heightMm-item.y-item.heightMm/2} width={item.widthMm} height={item.heightMm} fill="#dce6ff" stroke="#365cf5" strokeWidth={preview.plan!.wall.heightMm/250}/><text x={item.x} y={preview.plan!.wall.heightMm-item.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(item.widthMm/3,preview.plan!.wall.heightMm/28)} fill="#2447bd">{index+1}</text></g>)}</svg><p>배열 외곽 {format(preview.plan.widthMm)} × {format(preview.plan.heightMm)} · 회색은 기존 작품</p>{preview.plan.overlapping.length>0&&<p className="warning" role="status">기존 작품 {preview.plan.overlapping.length}점과 외곽이 겹칩니다. {preview.plan.overlapping.map(a=>a.name).slice(0,3).join(', ')}{preview.plan.overlapping.length>3?' 등':''}</p>}</div>}
    {(preview.error||applyError)&&<p className="warning" role="alert">{preview.error||applyError}</p>}
   </section>
  </div>
  <p className="dialog-footnote">선택한 작품의 설치 위치를 변경합니다. 작품 이미지·실제 크기·액자·메모는 유지되고, 전체 배열은 한 번의 실행 취소로 되돌릴 수 있습니다.</p>
  <div className="series-actions"><button type="button" className="button secondary" onClick={onClose}>취소</button><button type="button" className="button primary" disabled={!!preview.error} onClick={apply}>{Number.isInteger(count)?count:''}점 배열 적용</button></div>
 </dialog>;
}
