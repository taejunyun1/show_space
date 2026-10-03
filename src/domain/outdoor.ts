export interface OutdoorSettings {
 mode:'indoor'|'outdoor';latitude:number;longitude:number;timeZone:string;
 date:string;time:string;northDeg:number;preset:'clear'|'cloudy'|'sunset'|'night';
 sunIntensity:number;shadow:boolean;occurrence:'earlier'|'later';
}
export const DEFAULT_OUTDOOR:OutdoorSettings={mode:'indoor',latitude:37.5665,longitude:126.978,timeZone:'Asia/Seoul',date:'2026-06-21',time:'12:00',northDeg:0,preset:'clear',sunIntensity:3,shadow:true,occurrence:'earlier'};
const rad=Math.PI/180,deg=180/Math.PI,mod=(n:number,m:number)=>(n%m+m)%m;
function wallClock(date:string,time:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new Error('날짜와 시간 형식을 확인해주세요.');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),ms=Date.UTC(y,m-1,d,h,min),v=new Date(ms);
 if(y<1901||y>2099||h>23||min>59||v.getUTCFullYear()!==y||v.getUTCMonth()!==m-1||v.getUTCDate()!==d)throw new Error('날짜는 1901–2099년의 실제 날짜, 시간은 00:00–23:59로 입력하세요.');
 return ms;
}
/** Enumerate real instants, including both occurrences of a repeated DST time. */
export function localInstants(s:Pick<OutdoorSettings,'date'|'time'|'timeZone'>):number[]{
 const naive=wallClock(s.date,s.time);
 let fmt:Intl.DateTimeFormat;
 try{if(typeof s.timeZone!=='string'||s.timeZone.length>100)throw new Error();fmt=new Intl.DateTimeFormat('en-CA',{timeZone:s.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{throw new Error('시간대는 Asia/Seoul 같은 유효한 IANA 이름으로 입력하세요.');}
 const local=(ms:number)=>{const parts=Object.fromEntries(fmt.formatToParts(ms).map(p=>[p.type,p.value]));return Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);};
 const offsets=new Set<number>();for(let h=-36;h<=36;h+=6){const t=naive+h*3600000;offsets.add(local(t)-t);}
 return [...offsets].map(offset=>naive-offset).filter(t=>local(t)===naive).sort((a,b)=>a-b);
}
export function parseOutdoor(value:unknown):OutdoorSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('야외 환경 설정이 올바르지 않습니다.');
 const v=value as OutdoorSettings;
 const number=(n:number,min:number,max:number)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error('위치·북쪽 방향·태양 밝기의 범위를 확인해주세요.');return n;};
 if(!['indoor','outdoor'].includes(v.mode)||!['clear','cloudy','sunset','night'].includes(v.preset)||!['earlier','later'].includes(v.occurrence)||typeof v.shadow!=='boolean'||typeof v.date!=='string'||typeof v.time!=='string')throw new Error('야외 환경 설정이 올바르지 않습니다.');
 const s:OutdoorSettings={mode:v.mode,latitude:number(v.latitude,-90,90),longitude:number(v.longitude,-180,180),timeZone:v.timeZone,date:v.date,time:v.time,northDeg:number(v.northDeg,0,360),preset:v.preset,sunIntensity:number(v.sunIntensity,0,10),shadow:v.shadow,occurrence:v.occurrence};
 if(!localInstants(s).length)throw new Error('이 현지 시간은 서머타임 전환으로 존재하지 않습니다. 다른 시간을 선택하세요.');
 return s;
}
export function outdoorInstant(s:OutdoorSettings){const candidates=localInstants(s);if(!candidates.length)throw new Error('이 현지 시간은 존재하지 않습니다.');return candidates[s.occurrence==='later'?candidates.length-1:0];}
/** NOAA fractional-year approximation, geometric altitude without refraction. */
export function solarPosition(s:OutdoorSettings){
 const instant=outdoorInstant(s),utc=new Date(instant),year=utc.getUTCFullYear(),start=Date.UTC(year,0,1),days=(Date.UTC(year+1,0,1)-start)/86400000;
 const day=Math.floor((instant-start)/86400000)+1,hour=utc.getUTCHours()+utc.getUTCMinutes()/60;
 const gamma=2*Math.PI/days*(day-1+(hour-12)/24);
 const eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
 const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
 const hourAngle=(mod(hour*60+eq+4*s.longitude,1440)/4-180)*rad,lat=s.latitude*rad;
 const east=-Math.cos(decl)*Math.sin(hourAngle),north=Math.cos(lat)*Math.sin(decl)-Math.sin(lat)*Math.cos(decl)*Math.cos(hourAngle),up=Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(hourAngle);
 const elevation=Math.atan2(up,Math.hypot(east,north))*deg,azimuth=mod(Math.atan2(east,north)*deg,360),theta=s.northDeg*rad;
 return {instant,elevation,azimuth,hourAngle:hourAngle*deg,direction:[east*Math.cos(theta)+north*Math.sin(theta),up,east*Math.sin(theta)-north*Math.cos(theta)] as [number,number,number]};
}
export function outdoorAppearance(s?:OutdoorSettings){
 if(!s||s.mode==='indoor')return null;
 const sun=solarPosition(s),day=Math.max(0,Math.min(1,(sun.elevation+6)/16)),cloud=s.preset==='cloudy',warm=sun.elevation<12;
 return {sun,background:day===0?'#101725':cloud?'#c4ccd3':warm?'#dbb19a':'#c2dff2',ambient:.06+day*(cloud?.7:.3),hemisphere:.08+day*(cloud?1:.6),environment:.02+day*(cloud?.45:.65),sunIntensity:sun.elevation<=0?0:s.sunIntensity*(cloud?.18:1),sunKelvin:warm?Math.max(2200,3000+sun.elevation*180):5500};
}
export const minutesTime=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
export function presetOutdoor(s:OutdoorSettings,preset:OutdoorSettings['preset']):OutdoorSettings{
 if(preset==='clear'||preset==='cloudy')return parseOutdoor({...s,preset});
 let best:string|undefined,score=Infinity;
 for(let m=0;m<1440;m+=15){const candidate={...s,time:minutesTime(m)};if(!localInstants(candidate).length)continue;const sun=solarPosition(candidate);
  if(preset==='sunset'&&(sun.hourAngle<=0||sun.elevation<0||sun.elevation>12))continue;
  if(preset==='night'&&sun.elevation>-6)continue;
  const cost=preset==='sunset'?Math.abs(sun.elevation-4):Math.abs(m-1320);if(cost<score){score=cost;best=candidate.time;}
 }
 if(!best)throw new Error(preset==='night'?'이 날짜·위치는 백야로 야간 시간이 없습니다.':'이 날짜·위치에는 일몰 프리셋을 적용할 수 없습니다.');
 return parseOutdoor({...s,preset,time:best});
}
