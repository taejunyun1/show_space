import {floorSvgPath} from '../domain/importedFloor';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {parsePublicShare,type PublicShareSnapshot} from '../domain/publicShare';
import type {WorldPoint} from '../domain/types';
import {elevationPoint,measurementDistance,nextMeasurePoints,projectElevationPoint,svgDrawingPoint} from './sharedMeasure';
import './sharedViewer.css';

const SharedViewer3D=lazy(()=>import('./SharedViewer3D'));
type View='3d'|'plan'|'elevation';
type Selection={kind:'wall'|'artwork';id:string}|null;
type Select=(selection:Selection)=>void;
const formatMm=(value:number)=>`${Math.round(value).toLocaleString()} mm`;
const length=(wall:PublicShareSnapshot['walls'][number])=>Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z);
const artworkImage=(shareId:string|undefined,imageId:string)=>shareId?`/api/public/${shareId}/images/${imageId}`:undefined;

type MeasureProps={measuring?:boolean;measurePoints?:WorldPoint[];onMeasurePoint?:(point:WorldPoint)=>void};

function TemporaryMeasure({points,scale}:{points:{x:number;y:number}[];scale:number}){
  if(!points.length)return null;
  const [start,end]=points;
  return <g aria-label="임시 측정" pointerEvents="none">
    {end&&<line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#16816b" strokeWidth={scale/650} strokeDasharray={`${scale/110} ${scale/160}`}/>}
    {points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={scale/150} fill="#16816b" stroke="#fff" strokeWidth={scale/900}/>)}
  </g>;
}

function SharedArtworkImage({url,x,y,width,height,spritePanel}:{url:string;x:number;y:number;width:number;height:number;spritePanel?:number}){
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[url]);
  if(failed)return <text x={x+width/2} y={y+height/2} textAnchor="middle" fill="#6f7680" fontSize={Math.max(30,Math.min(width,height)/10)}>이미지를 불러올 수 없습니다</text>;
  if(spritePanel!==undefined)return <foreignObject x={x} y={y} width={width} height={height} pointerEvents="none"><div style={{width:'100%',height:'100%',backgroundImage:`url("${url}")`,backgroundSize:'500% 100%',backgroundPosition:`${spritePanel*25}% center`}}><img src={url} alt="" onError={()=>setFailed(true)} style={{display:'none'}}/></div></foreignObject>;
  return <image href={url} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice" onError={()=>setFailed(true)}/>;
}

function bounds(snapshot:PublicShareSnapshot){
  const points=[...snapshot.walls.flatMap(wall=>[wall.start,wall.end]),...(snapshot.importedFloor?.flat()??[])];
  const minX=Math.min(...points.map(point=>point.x)),maxX=Math.max(...points.map(point=>point.x));
  const minZ=Math.min(...points.map(point=>point.z)),maxZ=Math.max(...points.map(point=>point.z));
  const span=Math.max(maxX-minX,maxZ-minZ,1000),pad=span*.12;
  return {minX,minZ,maxX,maxZ,pad,span};
}

export function SharedPlan({snapshot,selectedId,onSelect,measuring=false,measurePoints=[],onMeasurePoint}:{snapshot:PublicShareSnapshot;selectedId:string|null;onSelect:Select}&MeasureProps){
  const box=useMemo(()=>bounds(snapshot),[snapshot]);
  const active=measuring&&!!snapshot.dimensions;
  function pick(event:ReactPointerEvent<SVGSVGElement>){
    if(!active||!onMeasurePoint||event.pointerType==='mouse'&&event.button!==0)return;
    const point=svgDrawingPoint(event.currentTarget,event.clientX,event.clientY);
    if(!point)return;
    event.preventDefault();onMeasurePoint({x:point.x,y:0,z:point.y});
  }
  return <div className="shared-drawing" aria-label="평면도"><svg className={active?'shared-measuring':''} onPointerDown={pick} viewBox={`${box.minX-box.pad} ${box.minZ-box.pad} ${box.maxX-box.minX+box.pad*2} ${box.maxZ-box.minZ+box.pad*2}`} role="img" aria-label="공유된 전시장 평면도">
    {snapshot.importedFloor&&<path aria-label="모델 바닥" d={floorSvgPath(snapshot.importedFloor)} fill={snapshot.floorColor} fillRule="evenodd" pointerEvents="none"/>}
    {snapshot.zones.map(zone=><rect key={zone.id} x={zone.x} y={zone.z} width={zone.width} height={zone.depth} fill="#eec9c1" stroke="#bb6b58" strokeWidth={box.span/500} pointerEvents="none"/>)}
    {snapshot.walls.map(wall=><g key={wall.id} onClick={()=>{if(!active)onSelect({kind:'wall',id:wall.id});}} className="shared-selectable"><line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z} stroke={selectedId===wall.id?'#365cf5':wall.color} strokeWidth={Math.max(wall.thicknessMm,box.span/250)} strokeLinecap="square"/><line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z} stroke="transparent" strokeWidth={Math.max(wall.thicknessMm*3,box.span/65)}/>{snapshot.dimensions&&<text x={(wall.start.x+wall.end.x)/2} y={(wall.start.z+wall.end.z)/2-box.span/75} textAnchor="middle" fontSize={box.span/90} fill="#536176" stroke="#fff" strokeWidth={box.span/500} paintOrder="stroke">{formatMm(length(wall))}</text>}</g>)}
    {snapshot.openings.map(opening=><g key={opening.id} pointerEvents="none"><line x1={opening.start.x} y1={opening.start.z} x2={opening.end.x} y2={opening.end.z} stroke="#16816b" strokeWidth={box.span/330} strokeDasharray={`${box.span/100} ${box.span/140}`}/></g>)}
    {snapshot.artworks.map(art=>{const wall=snapshot.walls.find(item=>item.id===art.wallId);if(!wall)return null;const wallLength=length(wall);if(!wallLength)return null;const t=art.alongMm/wallLength,x=wall.start.x+(wall.end.x-wall.start.x)*t,z=wall.start.z+(wall.end.z-wall.start.z)*t;return <g key={art.id} onClick={()=>{if(!active)onSelect({kind:'artwork',id:art.id});}} className="shared-selectable"><circle cx={x} cy={z} r={box.span/100} fill={selectedId===art.id?'#365cf5':'#a88763'} stroke="#fff" strokeWidth={box.span/550}/></g>;})}
    {snapshot.dimensions?.filter(dim=>dim.view==='plan').map(dim=><g key={dim.id} aria-label="치수선" pointerEvents="none"><line x1={dim.start.x} y1={dim.start.z} x2={dim.end.x} y2={dim.end.z} stroke="#365cf5" strokeWidth={box.span/650}/><text x={(dim.start.x+dim.end.x)/2} y={(dim.start.z+dim.end.z)/2-box.span/100} textAnchor="middle" fontSize={box.span/85} fill="#365cf5" stroke="#fff" strokeWidth={box.span/500} paintOrder="stroke">{formatMm(dim.distanceMm)}</text></g>)}
    {active&&<TemporaryMeasure points={measurePoints.map(point=>({x:point.x,y:point.z}))} scale={box.span}/>}
    {active&&measurePoints.length===2&&<text aria-label="임시 측정 값" x={(measurePoints[0].x+measurePoints[1].x)/2} y={(measurePoints[0].z+measurePoints[1].z)/2-box.span/70} textAnchor="middle" fontSize={box.span/75} fill="#16816b" stroke="#fff" strokeWidth={box.span/450} paintOrder="stroke">임시 측정 {formatMm(measurementDistance(measurePoints[0],measurePoints[1]))}</text>}
  </svg></div>;
}

export function SharedElevation({snapshot,wallId,side,selectedId,onSelect,shareId,measuring=false,measurePoints=[],onMeasurePoint}:{snapshot:PublicShareSnapshot;wallId:string;side:'front'|'back';selectedId:string|null;onSelect:Select;shareId?:string}&MeasureProps){
  const wall=snapshot.walls.find(item=>item.id===wallId)??snapshot.walls[0];
  if(!wall)return null;
  const width=length(wall),height=wall.heightMm,span=Math.max(width,height),pad=span*.12;
  const art=snapshot.artworks.filter(item=>item.wallId===wall.id&&item.wallSide===side);
  const active=measuring&&!!snapshot.dimensions;
  function pick(event:ReactPointerEvent<SVGSVGElement>){
    if(!active||!onMeasurePoint||event.pointerType==='mouse'&&event.button!==0)return;
    const point=svgDrawingPoint(event.currentTarget,event.clientX,event.clientY);
    if(!point)return;
    event.preventDefault();onMeasurePoint(elevationPoint(wall,side,point));
  }
  return <div className="shared-drawing" aria-label="벽면도"><svg className={active?'shared-measuring':''} onPointerDown={pick} viewBox={`${-pad} ${-pad} ${width+pad*2} ${height+pad*2}`} role="img" aria-label={`${wall.name} ${side==='front'?'A':'B'}면`}>
    <rect x="0" y="0" width={width} height={height} fill={wall.color} stroke="#b9c3cf" strokeWidth={span/500} onClick={()=>{if(!active)onSelect({kind:'wall',id:wall.id});}} className="shared-selectable"/>
    {snapshot.dimensions&&<g aria-label="치수선" fill="#536176" fontSize={span/65}><text x={width/2} y={-pad*.3} textAnchor="middle">{formatMm(width)}</text><text x={pad*.15} y={height/2} transform={`rotate(-90 ${pad*.15} ${height/2})`} textAnchor="middle">{formatMm(height)}</text></g>}
    {art.map(item=>{const x=side==='back'?width-item.alongMm:item.alongMm,y=height-item.centerHeightMm,url=artworkImage(shareId,item.imageId);return <g key={item.id} onClick={()=>{if(!active)onSelect({kind:'artwork',id:item.id});}} className="shared-selectable"><g transform={item.rotationDeg ? `rotate(${-item.rotationDeg} ${x} ${y})` : undefined}><rect x={x-item.widthMm/2-15} y={y-item.heightMm/2-15} width={item.widthMm+30} height={item.heightMm+30} fill={selectedId===item.id?'#365cf5':'#aa947a'}/>{url&&<SharedArtworkImage url={url} x={x-item.widthMm/2} y={y-item.heightMm/2} width={item.widthMm} height={item.heightMm} spritePanel={item.spritePanel}/>}</g>{snapshot.dimensions&&selectedId===item.id&&<text x={x} y={y-item.heightMm/2-span/65} textAnchor="middle" fontSize={span/70} fill="#365cf5">{formatMm(item.widthMm)} × {formatMm(item.heightMm)}</text>}</g>;})}
    {snapshot.dimensions?.filter(dim=>dim.view==='elevation'&&dim.elevationWallId===wall.id).map(dim=>{const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;const position=(p:{x:number;y:number;z:number})=>{const along=((p.x-wall.start.x)*dx+(p.z-wall.start.z)*dz)/width;return {x:side==='back'?width-along:along,y:height-p.y};};const a=position(dim.start),b=position(dim.end);return <g key={dim.id} aria-label="치수선" pointerEvents="none"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#365cf5" strokeWidth={span/650}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-span/100} textAnchor="middle" fontSize={span/80} fill="#365cf5">{formatMm(dim.distanceMm)}</text></g>;})}
    {active&&<TemporaryMeasure points={measurePoints.map(point=>projectElevationPoint(wall,side,point))} scale={span}/>}
    {active&&measurePoints.length===2&&(()=>{const a=projectElevationPoint(wall,side,measurePoints[0]),b=projectElevationPoint(wall,side,measurePoints[1]);return <text aria-label="임시 측정 값" x={(a.x+b.x)/2} y={(a.y+b.y)/2-span/70} textAnchor="middle" fontSize={span/75} fill="#16816b" stroke="#fff" strokeWidth={span/450} paintOrder="stroke">임시 측정 {formatMm(measurementDistance(measurePoints[0],measurePoints[1]))}</text>;})()}
  </svg></div>;
}

export default function SharedViewer({shareId}:{shareId:string|null}){
  const [snapshot,setSnapshot]=useState<PublicShareSnapshot|null>(null);
  const [error,setError]=useState<string|null>(shareId?null:'공유 링크 주소가 올바르지 않습니다.');
  const [view,setView]=useState<View>('3d');
  const [selection,setSelection]=useState<Selection>(null);
  const [wallId,setWallId]=useState<string|null>(null);
  const [side,setSide]=useState<'front'|'back'>('front');
  const [reset,setReset]=useState(0);
  const [cutaway,setCutaway]=useState(true);
  const [measuring,setMeasuring]=useState(false);
  const [measurePoints,setMeasurePoints]=useState<WorldPoint[]>([]);
  const addMeasurePoint=(point:WorldPoint)=>setMeasurePoints(current=>nextMeasurePoints(current,point));
  const changeView=(next:View)=>{setView(next);setMeasurePoints([]);};
  useEffect(()=>{
    if(!shareId)return;
    const abort=new AbortController();
    fetch(`/api/public/${shareId}`,{signal:abort.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok){let message=response.status===410?'중단된 공유 링크입니다.':response.status===404?'공유 링크를 찾을 수 없습니다.':'공유 화면을 불러오지 못했습니다.';try{const body=await response.json() as {error?:string};if(body.error)message=body.error;}catch{/* Status message is enough. */}throw new Error(message);}
      return parsePublicShare(await response.json());
    }).then(data=>{setSnapshot(data);setWallId(data.walls[0]?.id??null);document.title=`${data.name} — 공간 공유`;}).catch(reason=>{if(!abort.signal.aborted)setError((reason as Error).message);});
    return ()=>abort.abort();
  },[shareId]);
  useEffect(()=>{
    if(!shareId||!snapshot||error)return;
    const abort=new AbortController();
    let stopped=false;
    const verify=async()=>{
      try{
        const response=await fetch(`/api/public/${shareId}`,{signal:abort.signal,cache:'no-store'});
        if(response.status===410||response.status===404){
          let message=response.status===410?'중단되었거나 만료된 공유 링크입니다.':'공유 링크를 찾을 수 없습니다.';
          try{const body=await response.json() as {error?:string};if(body.error)message=body.error;}catch{/* Keep the status message. */}
          stopped=true;setSnapshot(null);setError(message);
        }
      }catch{/* Keep an already loaded view through a temporary network failure. */}
    };
    const onVisibility=()=>{if(document.visibilityState==='visible'&&!stopped)void verify();};
    const interval=window.setInterval(()=>{if(document.visibilityState==='visible'&&!stopped)void verify();},30000);
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>{abort.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisibility);};
  },[shareId,snapshot,error]);
  if(error)return <main className="shared-state" role="alert"><strong>{error}</strong><p>링크를 확인하거나 공유한 사람에게 새 링크를 요청해 주세요.</p></main>;
  if(!snapshot||!shareId)return <main className="shared-state" role="status">공유 공간을 불러오는 중…</main>;
  const selectedWall=snapshot.walls.find(item=>item.id===selection?.id);
  const selectedArt=snapshot.artworks.find(item=>item.id===selection?.id);
  return <main className="shared-viewer"><header className="shared-header"><div><span className="shared-brand">공간</span><span className="shared-title"><strong>{snapshot.name}</strong><small>{snapshot.venue}</small></span></div><span className="shared-readonly">읽기 전용 공유</span></header>
    <div className="shared-content"><aside className="shared-list"><h1>전시 공간</h1><p>벽이나 작품을 선택해 정보를 볼 수 있습니다.</p><h2>벽</h2>{snapshot.walls.map(wall=><button key={wall.id} className={selection?.id===wall.id?'active':''} onClick={()=>{setSelection({kind:'wall',id:wall.id});setWallId(wall.id);setMeasurePoints([]);}}>{wall.name}</button>)}{snapshot.artworks.length>0&&<><h2>작품</h2>{snapshot.artworks.map(art=><button key={art.id} className={selection?.id===art.id?'active':''} onClick={()=>{setSelection({kind:'artwork',id:art.id});setWallId(art.wallId);setMeasurePoints([]);}}>{art.name}</button>)}</>}</aside>
    <section className="shared-stage" aria-label="공유 전시장"><div className="shared-tools"><nav aria-label="보기 전환"><button aria-pressed={view==='3d'} onClick={()=>changeView('3d')}>3D</button><button aria-pressed={view==='plan'} onClick={()=>changeView('plan')}>평면</button><button aria-pressed={view==='elevation'} onClick={()=>changeView('elevation')}>벽면</button></nav>{view==='3d'&&<button onClick={()=>setReset(value=>value+1)}>시점 초기화</button>}{view==='elevation'&&<div className="shared-face"><button aria-pressed={side==='front'} onClick={()=>{setSide('front');setMeasurePoints([]);}}>A면</button><button aria-pressed={side==='back'} onClick={()=>{setSide('back');setMeasurePoints([]);}}>B면</button></div>}{snapshot.dimensions&&<button className="shared-measure-button" aria-pressed={measuring} onClick={()=>{setMeasuring(value=>!value);setMeasurePoints([]);}}>임시 줄자</button>}</div>
      {view==='3d'&&<label className="shared-cutaway"><input type="checkbox" checked={cutaway} onChange={event=>setCutaway(event.target.checked)}/>벽 자동 숨김</label>}
      {view==='3d'?<Suspense fallback={<div className="shared-state">3D를 불러오는 중…</div>}><SharedViewer3D snapshot={snapshot} shareId={shareId} selectedId={selection?.id??null} onSelect={setSelection} reset={reset} cutaway={cutaway} measuring={measuring} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint}/></Suspense>:view==='plan'?<SharedPlan snapshot={snapshot} selectedId={selection?.id??null} onSelect={setSelection} measuring={measuring} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint}/>:<SharedElevation snapshot={snapshot} shareId={shareId} wallId={wallId??snapshot.walls[0].id} side={side} selectedId={selection?.id??null} onSelect={setSelection} measuring={measuring} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint}/>}
      <p className="shared-hint">{measuring?(measurePoints.length===2?`임시 측정 ${formatMm(measurementDistance(measurePoints[0],measurePoints[1]))} · 다음 점을 누르면 새 측정`:`${view==='3d'?'바닥·벽·작품':'도면'}에서 ${measurePoints.length?'끝점':'시작점'}을 선택하세요`):view==='3d'?'드래그 회전 · 마우스 휠 확대 · 오른쪽 버튼 이동':'벽이나 작품을 클릭해 선택할 수 있습니다.'}</p>
    </section><aside className="shared-info"><h2>선택 정보</h2>{selectedArt?<><strong>{selectedArt.name}</strong><p>{selectedArt.artist||'작가 미기재'}</p>{snapshot.dimensions&&<p>{formatMm(selectedArt.widthMm)} × {formatMm(selectedArt.heightMm)}</p>}</>:selectedWall?<><strong>{selectedWall.name}</strong>{snapshot.dimensions&&<p>길이 {formatMm(length(selectedWall))}<br/>높이 {formatMm(selectedWall.heightMm)}<br/>두께 {formatMm(selectedWall.thicknessMm)}</p>}</>:<p>벽이나 작품을 선택하세요.</p>}</aside></div>
  </main>;
}
