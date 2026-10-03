import {useEffect} from 'react';
import {useEditor} from '../state/editor';
import {minutesTime,solarPosition} from '../domain/outdoor';
export function OutdoorTimeSlider(){
 const state=useEditor(),settings=(state.previewProject??state.project).outdoor;
 useEffect(()=>()=>{if(useEditor.getState().outdoorGesture)useEditor.getState().finishOutdoorTime(true);},[]);
 if(!settings||settings.mode!=='outdoor'||state.view!=='3d'||state.activeTool==='measure')return null;
 const [h,m]=settings.time.split(':').map(Number),sun=solarPosition(settings);
 const begin=()=>{if(!useEditor.getState().outdoorGesture)state.beginOutdoorTime();};
 return <div className="outdoor-timebar" role="group" aria-label="야외 시간 조절"><div><strong>{settings.time}</strong><span>{settings.date} · {settings.timeZone}</span><span>태양 {sun.elevation.toFixed(1)}° · {sun.elevation<=0?'직사광 꺼짐':`${sun.azimuth.toFixed(0)}° 방위`}</span></div><label><span>00:00</span><input type="range" min={0} max={1439} step={1} value={h*60+m} aria-label="야외 시간 슬라이더" onPointerDown={e=>{begin();e.currentTarget.setPointerCapture(e.pointerId);}} onChange={e=>{begin();state.updateOutdoorTime(minutesTime(Number(e.target.value)));}} onPointerUp={()=>state.finishOutdoorTime()} onPointerCancel={()=>state.finishOutdoorTime(true)} onLostPointerCapture={()=>{if(useEditor.getState().outdoorGesture)state.finishOutdoorTime();}} onBlur={()=>{if(useEditor.getState().outdoorGesture)state.finishOutdoorTime();}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))begin();}} onKeyUp={()=>{if(useEditor.getState().outdoorGesture)state.finishOutdoorTime();}}/><span>23:59</span></label></div>;
}
