import {useEffect,useRef,useState} from 'react';
import {FileText,LoaderCircle,X} from 'lucide-react';
import {useEditor} from '../state/editor';
import {downloadBlob} from '../lib/art';
import type {PdfOptions} from '../lib/pdfLayout';
import type {PdfCurrentCamera} from '../lib/pdfRender3d';

export default function PdfDialog({onClose,getCamera}:{onClose:()=>void;getCamera:()=>PdfCurrentCamera|undefined}){
 const project=useRef(useEditor.getState().project).current,dialog=useRef<HTMLDialogElement>(null),running=useRef(false);
 const [options,setOptions]=useState<PdfOptions>({current:true,sceneIds:[],threeD:true,plan:true,elevation:true,allWallFaces:false,includeSchedule:true});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function save(){
  if(running.current)return;running.current=true;setBusy(true);setError('');
  try{const {exportProjectPdf}=await import('../lib/pdfExport');const blob=await exportProjectPdf(project,options,getCamera(),setProgress);downloadBlob(blob,`${project.name}-전시안.pdf`);useEditor.getState().notify('전시안 PDF 다운로드를 시작했습니다.');onClose();}
  catch(e){setError(e instanceof Error?e.message:'PDF를 내보내지 못했습니다.');}
  finally{running.current=false;setBusy(false);setProgress('');}
 }
 const patch=(key:'current'|'threeD'|'plan'|'elevation'|'allWallFaces'|'includeSchedule',value:boolean)=>setOptions(o=>({...o,[key]:value}));
 return <dialog ref={dialog} className="export-dialog pdf-dialog" onCancel={e=>{if(running.current)e.preventDefault();else onClose();}} onClick={e=>{if(e.target===e.currentTarget&&!running.current)onClose();}}>
  <div className="dialog-header"><div><h2>전시안 PDF</h2><p>A4 가로 · 한글 글꼴 포함 · 평면·벽면도 선과 치수는 벡터</p></div><button className="icon-button" disabled={busy} aria-label="PDF 닫기" onClick={onClose}><X size={18}/></button></div>
  <fieldset disabled={busy} className="pdf-options"><legend>배치안</legend><div className="pdf-scenes"><label><input type="checkbox" checked={options.current} onChange={e=>patch('current',e.target.checked)}/>현재 배치</label>{project.scenes.map(scene=><label key={scene.id}><input type="checkbox" checked={options.sceneIds.includes(scene.id)} onChange={e=>setOptions(o=>({...o,sceneIds:e.target.checked?[...o.sceneIds,scene.id]:o.sceneIds.filter(id=>id!==scene.id)}))}/>{scene.name}</label>)}</div></fieldset>
  <fieldset disabled={busy} className="pdf-options"><legend>포함할 보기</legend><div className="pdf-views"><label><input type="checkbox" checked={options.threeD} onChange={e=>patch('threeD',e.target.checked)}/>3D 공간</label><label><input type="checkbox" checked={options.plan} onChange={e=>patch('plan',e.target.checked)}/>평면도</label><label><input type="checkbox" checked={options.elevation} onChange={e=>patch('elevation',e.target.checked)}/>벽면도</label></div>{options.elevation&&<label className="pdf-extra"><input type="checkbox" checked={options.allWallFaces} onChange={e=>patch('allWallFaces',e.target.checked)}/>모든 표시 벽의 A·B면 포함 <small>기본: 작품이 설치된 면</small></label>}<label className="pdf-extra"><input type="checkbox" checked={options.includeSchedule} onChange={e=>patch('includeSchedule',e.target.checked)}/>벽·작품 치수 목록 포함</label></fieldset>
  <p className="dialog-footnote">현재 3D 시점을 사용하며 다른 보기에서는 버드아이뷰로 만듭니다. Scene은 저장된 시점·조명·야외 시간을 사용합니다. 평면·벽면도는 편집 벽 기준이고, 원본 참고 모델은 3D에 포함됩니다. 메모·원본 도면은 넣지 않습니다.</p>
  {busy&&<p className="dialog-footnote" role="status" aria-live="polite">{progress}</p>}{error&&<p className="capture-error" role="alert">{error}</p>}
  <button className="button primary full" disabled={busy} onClick={()=>void save()}>{busy?<LoaderCircle size={16} className="spin"/>:<FileText size={16}/>} {busy?'PDF 만드는 중…':'PDF 저장'}</button>
 </dialog>;
}
