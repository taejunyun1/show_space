import {Component,useState,useEffect,useRef,type ReactNode} from 'react';
import {recoveryActions,isModuleLoadError} from '../lib/screenRecovery';
import {downloadBlob} from '../lib/art';

export function ScreenRecoveryPanel({name,error,onClose}:{name:string;error:unknown;onClose?:()=>void}){
 const panel=useRef<HTMLElement>(null);useEffect(()=>{panel.current?.scrollIntoView({block:'nearest'});panel.current?.focus({preventScroll:true});},[]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[backup,setBackup]=useState(false),actions=recoveryActions();
 async function reload(){if(busy)return;setBusy(true);setMessage('');try{await actions?.save();window.location.reload();}catch{setMessage('작업을 저장하지 못해 새로고침을 중단했습니다. 현재 작업 JSON을 백업하고 다시 시도해주세요.');setBusy(false);}}
 function download(){try{const file=actions!.backup();downloadBlob(new Blob([file.json],{type:'application/json'}),`${file.name}-화면복구-백업.json`);setBackup(true);setMessage('현재 작업 JSON을 내려받았습니다. 도면·3D 불러오기의 저장 프로젝트 복원에서 다시 열 수 있습니다.');}catch{setMessage('현재 작업을 백업하지 못했습니다. 이 탭을 유지해주세요.');}}
 return <section ref={panel} tabIndex={-1} className="screen-recovery" role="alert" aria-label={`${name} 복구`}><h2>{name} 열기 실패</h2><p>{isModuleLoadError(error)?'새 버전 배포 또는 연결 문제로 화면 파일을 불러오지 못했습니다.':'화면 처리 중 오류가 발생했습니다.'}</p><p>{actions?'현재 작업을 저장한 뒤 새로고침할 수 있습니다. 저장하지 못하면 새로고침을 중단합니다.':'새로고침하여 화면을 다시 불러오세요.'}</p><div className="screen-recovery-actions">{actions&&<button className="button secondary" disabled={busy} onClick={download}>{backup?'현재 작업 JSON 다시 백업':'현재 작업 JSON 백업'}</button>}<button className="button primary" disabled={busy} onClick={()=>void reload()}>{busy?'작업 저장 중…':actions?'작업 저장 후 새로고침':'화면 새로고침'}</button>{onClose&&<button className="button secondary" disabled={busy} onClick={onClose}>복구 안내 닫기</button>}</div>{message&&<p role="status">{message}</p>}</section>;
}
export class ScreenRecoveryBoundary extends Component<{name:string;children:ReactNode;onClose?:()=>void},{error:unknown;failed:boolean}>{
 state:{error:unknown;failed:boolean}={error:null,failed:false};
 static getDerivedStateFromError(error:unknown){return {error,failed:true};}
 render(){return this.state.failed?<ScreenRecoveryPanel name={this.props.name} error={this.state.error} onClose={this.props.onClose}/>:this.props.children;}
}
