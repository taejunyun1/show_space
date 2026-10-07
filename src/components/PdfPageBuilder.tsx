import {useMemo} from 'react';
import {ArrowDown,ArrowUp,Plus,Trash2} from 'lucide-react';
import type {Project} from '../domain/types';
import {pdfBatch,pdfDetailArtworks,type PdfPageKind,type PdfPageRequest} from '../lib/pdfLayout';
const kinds:Record<PdfPageKind,string>={cover:'표지',plan:'평면도','3d':'3D 시점',elevation:'벽면도',detail:'작품 상세',schedule:'치수 목록'};
export default function PdfPageBuilder({project,pages,onChange,busy}:{project:Project;pages:PdfPageRequest[];onChange:(pages:PdfPageRequest[])=>void;busy:boolean}){
 const batches=useMemo(()=>new Map([['',pdfBatch(project)],...project.scenes.map(s=>[s.id,pdfBatch(project,s.id)] as const)]),[project]);
 function patchPage(id:string,patch:Partial<PdfPageRequest>){onChange(pages.map(page=>{
  if(page.id!==id)return page;const next={...page,...patch},batch=batches.get(next.sceneId??'')!.project;
  if(next.kind==='elevation'&&!batch.walls.some(w=>w.visible&&w.id===next.wallId))next.wallId=batch.walls.find(w=>w.visible)?.id;
  if(next.kind==='elevation')next.side??='front';
  if(next.kind==='detail'&&!pdfDetailArtworks(batch).some(a=>a.id===next.artworkId))next.artworkId=pdfDetailArtworks(batch)[0]?.id;
  return next;
 }));}
 function move(id:string,direction:number){const next=[...pages],index=next.findIndex(p=>p.id===id),to=index+direction;if(to<0||to>=next.length)return;[next[index],next[to]]=[next[to],next[index]];onChange(next);}
 return <fieldset disabled={busy} className="pdf-options pdf-page-builder"><legend>페이지 순서와 보기</legend>
  <p>배치안을 섞어 구성할 수 있습니다. 위·아래 버튼으로 출력 순서를 바꾸세요.</p>
  <ol className="pdf-page-list">{pages.map((page,index)=>{const batch=batches.get(page.sceneId??'')!.project;return <li key={page.id} className="pdf-page-row">
   <div className="pdf-page-heading"><strong>{index+1}. {kinds[page.kind]}</strong><span><button type="button" className="icon-button" disabled={index===0} aria-label={`페이지 ${index+1} 위로`} onClick={()=>move(page.id,-1)}><ArrowUp size={16}/></button><button type="button" className="icon-button" disabled={index===pages.length-1} aria-label={`페이지 ${index+1} 아래로`} onClick={()=>move(page.id,1)}><ArrowDown size={16}/></button><button type="button" className="icon-button" aria-label={`페이지 ${index+1} 삭제`} onClick={()=>onChange(pages.filter(p=>p.id!==page.id))}><Trash2 size={16}/></button></span></div>
   <div className="pdf-page-fields"><label>배치안<select aria-label={`페이지 ${index+1} 배치안`} value={page.sceneId??''} onChange={e=>patchPage(page.id,{sceneId:e.target.value||undefined})}><option value="">현재 배치</option>{project.scenes.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>보기<select aria-label={`페이지 ${index+1} 보기`} value={page.kind} onChange={e=>patchPage(page.id,{kind:e.target.value as PdfPageKind})}>{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
   <label>제목<input aria-label={`페이지 ${index+1} 제목`} value={page.title??''} maxLength={120} placeholder="기본 제목 사용" onChange={e=>patchPage(page.id,{title:e.target.value})}/></label>
   {page.kind==='3d'&&<label>시점<select aria-label={`페이지 ${index+1} 시점`} value={page.cameraMode??'saved'} onChange={e=>patchPage(page.id,{cameraMode:e.target.value as PdfPageRequest['cameraMode']})}><option value="saved">{page.sceneId?'Scene 저장 시점':'현재 시점 · 다른 보기에서는 버드아이뷰'}</option><option value="bird">버드아이뷰</option><option value="perspective">사시 투시</option><option value="front">정면</option><option value="left">좌측면</option><option value="right">우측면</option></select></label>}
   {page.kind==='elevation'&&<div className="pdf-page-fields"><label>벽<select aria-label={`페이지 ${index+1} 벽`} value={page.wallId??''} onChange={e=>patchPage(page.id,{wallId:e.target.value})}>{!page.wallId&&<option value="">표시 벽 없음</option>}{batch.walls.filter(w=>w.visible).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>면<select aria-label={`페이지 ${index+1} 벽면`} value={page.side??'front'} onChange={e=>patchPage(page.id,{side:e.target.value as 'front'|'back'})}><option value="front">A면</option><option value="back">B면</option></select></label></div>}
   {page.kind==='detail'&&<label>작품<select aria-label={`페이지 ${index+1} 작품`} value={page.artworkId??''} onChange={e=>patchPage(page.id,{artworkId:e.target.value})}>{!page.artworkId&&<option value="">표시 작품 없음</option>}{pdfDetailArtworks(batch).map(a=><option key={a.id} value={a.id}>{'model' in a?'3D · ':''}{a.name}</option>)}</select></label>}
  </li>;})}</ol>
  {!pages.length&&<p>페이지를 추가하세요.</p>}
  <button type="button" className="button secondary full" onClick={()=>onChange([...pages,{id:crypto.randomUUID(),kind:'3d',cameraMode:'saved'}])}><Plus size={16}/>페이지 추가</button>
  <small>구성 항목 {pages.length}개 · 긴 작품 정보와 치수 목록은 추가 페이지로 이어집니다.</small>
 </fieldset>;
}
