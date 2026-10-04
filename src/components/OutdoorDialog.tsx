import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {NumberField} from './Controls';
import {useEditor} from '../state/editor';
import {DEFAULT_OUTDOOR,localInstants,parseOutdoor,presetOutdoor,solarPosition,type OutdoorSettings} from '../domain/outdoor';
function SettingText({label,value,type='text',save}:{label:string;value:string;type?:string;save:(value:string)=>boolean}){
 const [draft,setDraft]=useState(value);useEffect(()=>setDraft(value),[value]);
 return <label className="outdoor-field"><span>{label}</span><input aria-label={label} type={type} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={()=>{if(draft!==value&&!save(draft))setDraft(value);}}/></label>;
}
export function OutdoorDialog({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),state=useEditor(),settings=state.project.outdoor??DEFAULT_OUTDOOR,sun=solarPosition(settings),candidates=localInstants(settings);
 useEffect(()=>{ref.current?.showModal();},[]);
 function update(patch:Partial<OutdoorSettings>){try{state.patchOutdoor(parseOutdoor({...settings,...patch}));return true;}catch(error){state.notify(error instanceof Error?error.message:'환경 설정을 확인해주세요.');return false;}}
 return <dialog ref={ref} className="export-dialog outdoor-dialog" aria-label="야외 환경" onCancel={onClose}><div className="dialog-header"><div><h2>전시 환경</h2><p>위치·현지 시간·북쪽 방향으로 태양과 그림자를 계산합니다.</p></div><button className="icon-button" aria-label="야외 환경 닫기" onClick={onClose}><X size={18}/></button></div>
 <label className="outdoor-field"><span>환경</span><select aria-label="전시 환경" value={settings.mode} onChange={e=>update({mode:e.target.value as OutdoorSettings['mode']})}><option value="indoor">실내 · 기존 조명</option><option value="outdoor">야외 · 태양과 주변광</option></select></label>
 <NumberField label="위도" value={settings.latitude} min={-90} max={90} step={.0001} precision={4} suffix="°" onChange={latitude=>update({latitude})}/><NumberField label="경도" value={settings.longitude} min={-180} max={180} step={.0001} precision={4} suffix="°" onChange={longitude=>update({longitude})}/>
 <SettingText label="프로젝트 시간대" value={settings.timeZone} save={timeZone=>update({timeZone})}/><p className="field-hint">예: Asia/Seoul, America/New_York. 기본 위치는 서울 예시입니다.</p>
 <SettingText label="야외 날짜" type="date" value={settings.date} save={date=>update({date})}/><SettingText label="야외 현지 시간" type="time" value={settings.time} save={time=>update({time})}/>
 {candidates.length>1&&<label className="outdoor-field"><span>중복 현지 시간</span><select aria-label="서머타임 중복 시간" value={settings.occurrence} onChange={e=>update({occurrence:e.target.value as OutdoorSettings['occurrence']})}><option value="earlier">첫 번째 시간</option><option value="later">두 번째 시간</option></select></label>}
 <NumberField label="북쪽 방향" value={settings.northDeg} min={0} max={360} step={1} suffix="°" onChange={northDeg=>update({northDeg})}/><p className="field-hint">0°는 평면도 위쪽(−Z). 시계 방향 90°는 오른쪽(+X)입니다.</p>
 <div className="outdoor-presets" role="group" aria-label="환경 프리셋">{([['clear','맑음'],['cloudy','흐림'],['sunset','일몰'],['night','야간']] as const).map(([preset,label])=><button key={preset} className={settings.preset===preset?'active':''} onClick={()=>{try{state.patchOutdoor(presetOutdoor(settings,preset));}catch(error){state.notify((error as Error).message);}}}>{label}</button>)}</div>
 <p className="field-hint">날씨는 연출 프리셋입니다. 일몰·야간은 현재 날짜·위치에 맞는 시간으로 이동합니다. 시간 변경 후에는 계산한 태양 높이를 따릅니다.</p>
 <NumberField label="태양 밝기" value={settings.sunIntensity} min={0} max={10} step={.1} suffix="" onChange={sunIntensity=>update({sunIntensity})}/><label className="check-field"><input type="checkbox" aria-label="태양 그림자" checked={settings.shadow} onChange={e=>update({shadow:e.target.checked})}/>태양 그림자</label>
 <p className="outdoor-status">태양 높이 {sun.elevation.toFixed(1)}° · 방위 {sun.azimuth.toFixed(1)}°<br/>{sun.elevation<=0?'태양이 지평선 아래에 있어 직사광을 끕니다.':'태양 위치는 북쪽 기준 시계 방향으로 표시합니다.'}</p>
 <p className="field-hint">태양은 근사 계산입니다. 지형·주변 건물·실제 날씨는 반영하지 않습니다. 야외에서는 기본 실내 보조광을 대신하며 개별 Spot·Area 조명은 유지합니다. 태양을 포함해 빠른 편집은 최대 2개, 미리보기·캡처는 최대 4개의 그림자를 표시합니다.</p>
 <button className="button primary full" onClick={onClose}>완료</button></dialog>;
}
