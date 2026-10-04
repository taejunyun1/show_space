import {formatLength} from '../domain/lengthUnits';
import {LengthUnitContext, useLengthFormatter} from './LengthUnits';
import {artworkElevationDimensions,installationDimensionLabel} from '../domain/artworkElevationDimensions';
import {ArtworkElevationDimensions} from './ArtworkElevationDimensions';
import {artworkPresentation,artworkPlanSize} from '../domain/artworkPresentation';
import {ArtworkPresentationSvg} from './ArtworkPresentationSvg';
import {artworkTypeLabels,presentationTypeLabels} from '../domain/artworkInformation';
import {referenceModelFootprint} from '../domain/referenceModel';
import {modelArtworkFootprint} from '../domain/modelArtworks';
import {floorSvgPath} from '../domain/importedFloor';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {parsePublicShare,type PublicShareSnapshot} from '../domain/publicShare';
import type {WorldPoint} from '../domain/types';
import {elevationPoint,measurementDistance,nextMeasurePoints,projectElevationPoint,svgDrawingPoint} from './sharedMeasure';
import './sharedViewer.css';

const SharedViewer3D=lazy(()=>import('./SharedViewer3D'));
type View='3d'|'plan'|'elevation';
type Selection={kind:'wall'|'artwork'|'modelArtwork'|'referenceModel';id:string}|null;
type Select=(selection:Selection)=>void;
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
  const points=[...snapshot.walls.flatMap(wall=>[wall.start,wall.end]),...(snapshot.referenceModel?referenceModelFootprint(snapshot.referenceModel):[]),...(snapshot.importedFloor?.flat()??[]),...(snapshot.modelArtworks?.flatMap(modelArtworkFootprint)??[])];
  const minX=Math.min(...points.map(point=>point.x)),maxX=Math.max(...points.map(point=>point.x));
  const minZ=Math.min(...points.map(point=>point.z)),maxZ=Math.max(...points.map(point=>point.z));
  const span=Math.max(maxX-minX,maxZ-minZ,1000),pad=span*.12;
  return {minX,minZ,maxX,maxZ,pad,span};
}

export function SharedPlan({snapshot,selectedId,referenceSelected=false,onSelect,measuring=false,measurePoints=[],onMeasurePoint}:{snapshot:PublicShareSnapshot;selectedId:string|null;referenceSelected?:boolean;onSelect:Select}&MeasureProps){
 const formatMm=(value:number)=>formatLength(value,snapshot?.displayUnit);
  const box=useMemo(()=>bounds(snapshot),[snapshot]);
  const active=measuring&&!!snapshot.dimensions;
  function pick(event:ReactPointerEvent<SVGSVGElement>){
    if(!active||!onMeasurePoint||event.pointerType==='mouse'&&event.button!==0)return;
    const point=svgDrawingPoint(event.currentTarget,event.clientX,event.clientY);
    if(!point)return;
    event.preventDefault();onMeasurePoint({x:point.x,y:0,z:point.y});
  }
  return <div className="shared-drawing" aria-label="평면도"><svg className={active?'shared-measuring':''} onPointerDown={pick} viewBox={`${box.minX-box.pad} ${box.minZ-box.pad} ${box.maxX-box.minX+box.pad*2} ${box.maxZ-box.minZ+box.pad*2}`} role="img" aria-label="공유된 전시장 평면도">
    {snapshot.referenceModel&&<polygon aria-label="전시장 3D 모델 범위" className="shared-selectable" points={referenceModelFootprint(snapshot.referenceModel).map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke={referenceSelected?'#365cf5':'#758aa8'} strokeWidth={box.span/500} strokeDasharray={`${box.span/100} ${box.span/150}`} onClick={()=>{if(!active)onSelect({kind:'referenceModel',id:'referenceModel'});}}/>}
    {snapshot.importedFloor&&<path aria-label="모델 바닥" d={floorSvgPath(snapshot.importedFloor)} fill={snapshot.floorColor} fillRule="evenodd" pointerEvents="none"/>}
    {snapshot.zones.map(zone=><rect key={zone.id} x={zone.x} y={zone.z} width={zone.width} height={zone.depth} fill="#eec9c1" stroke="#bb6b58" strokeWidth={box.span/500} pointerEvents="none"/>)}
    {snapshot.walls.map(wall=><g key={wall.id} onClick={()=>{if(!active)onSelect({kind:'wall',id:wall.id});}} className="shared-selectable"><line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z} stroke={selectedId===wall.id?'#365cf5':wall.color} strokeWidth={Math.max(wall.thicknessMm,box.span/250)} strokeLinecap="square"/><line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z} stroke="transparent" strokeWidth={Math.max(wall.thicknessMm*3,box.span/65)}/>{snapshot.dimensions&&<text x={(wall.start.x+wall.end.x)/2} y={(wall.start.z+wall.end.z)/2-box.span/75} textAnchor="middle" fontSize={box.span/90} fill="#536176" stroke="#fff" strokeWidth={box.span/500} paintOrder="stroke">{formatMm(length(wall))}</text>}</g>)}
    {snapshot.openings.map(opening=><g key={opening.id} pointerEvents="none"><line x1={opening.start.x} y1={opening.start.z} x2={opening.end.x} y2={opening.end.z} stroke="#16816b" strokeWidth={box.span/330} strokeDasharray={`${box.span/100} ${box.span/140}`}/></g>)}
    {snapshot.artworks.map(art=>{const wall=snapshot.walls.find(item=>item.id===art.wallId);if(!wall)return null;const wallLength=length(wall);if(!wallLength)return null;const t=art.alongMm/wallLength,x=wall.start.x+(wall.end.x-wall.start.x)*t,z=wall.start.z+(wall.end.z-wall.start.z)*t;const outer=artworkPlanSize(art),dx=(wall.end.x-wall.start.x)/wallLength,dz=(wall.end.z-wall.start.z)/wallLength,side=art.wallSide==='back'?-1:1,offset=wall.thicknessMm/2+outer.depthMm/2+5;return <g key={art.id} onClick={()=>{if(!active)onSelect({kind:'artwork',id:art.id});}} className="shared-selectable"><g transform={`translate(${x-dz*side*offset},${z+dx*side*offset}) rotate(${Math.atan2(dz,dx)*180/Math.PI})`}><rect x={-outer.widthMm/2} y={-outer.depthMm/2} width={outer.widthMm} height={outer.depthMm} fill={selectedId===art.id?'#365cf5':'#a88763'}/><circle r={box.span/100} fill="transparent"/></g></g>;})}
    {snapshot.modelArtworks?.map(a=><polygon key={a.id} aria-label={`3D 작품 ${a.name}`} className="shared-selectable" points={modelArtworkFootprint(a).map(p=>`${p.x},${p.z}`).join(' ')} fill={selectedId===a.id?'#cfdbff':'#bca686'} stroke={selectedId===a.id?'#365cf5':'#7f6950'} strokeWidth={box.span/500} onClick={()=>{if(!active)onSelect({kind:'modelArtwork',id:a.id});}}/>)}
    {snapshot.dimensions?.filter(dim=>dim.view==='plan').map(dim=><g key={dim.id} aria-label="치수선" pointerEvents="none"><line x1={dim.start.x} y1={dim.start.z} x2={dim.end.x} y2={dim.end.z} stroke="#365cf5" strokeWidth={box.span/650}/><text x={(dim.start.x+dim.end.x)/2} y={(dim.start.z+dim.end.z)/2-box.span/100} textAnchor="middle" fontSize={box.span/85} fill="#365cf5" stroke="#fff" strokeWidth={box.span/500} paintOrder="stroke">{formatMm(dim.distanceMm)}</text></g>)}
    {active&&<TemporaryMeasure points={measurePoints.map(point=>({x:point.x,y:point.z}))} scale={box.span}/>}
    {active&&measurePoints.length===2&&<text aria-label="임시 측정 값" x={(measurePoints[0].x+measurePoints[1].x)/2} y={(measurePoints[0].z+measurePoints[1].z)/2-box.span/70} textAnchor="middle" fontSize={box.span/75} fill="#16816b" stroke="#fff" strokeWidth={box.span/450} paintOrder="stroke">임시 측정 {formatMm(measurementDistance(measurePoints[0],measurePoints[1]))}</text>}
  </svg></div>;
}

export function SharedElevation({snapshot,wallId,side,selectedId,onSelect,shareId,measuring=false,measurePoints=[],onMeasurePoint}:{snapshot:PublicShareSnapshot;wallId:string|null;side:'front'|'back';selectedId:string|null;onSelect:Select;shareId?:string}&MeasureProps){
 const formatMm=(value:number)=>formatLength(value,snapshot?.displayUnit);
  const wall=snapshot.walls.find(item=>item.id===wallId)??snapshot.walls[0];
  if(!wall)return <div className="shared-state" role="status">표시할 편집 벽이 없습니다. 가져온 전시장 모델은 3D에서 확인하세요.</div>;
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
    {art.map(item=>{const x=side==='back'?width-item.alongMm:item.alongMm,y=height-item.centerHeightMm,url=artworkImage(shareId,item.imageId),outer=artworkPresentation(item);return <g key={item.id} onClick={()=>{if(!active)onSelect({kind:'artwork',id:item.id});}} className="shared-selectable"><g transform={item.rotationDeg ? `rotate(${-item.rotationDeg} ${x} ${y})` : undefined}><ArtworkPresentationSvg artwork={item} x={x} y={y}>{url&&<SharedArtworkImage url={url} x={x-item.widthMm/2} y={y-item.heightMm/2} width={item.widthMm} height={item.heightMm} spritePanel={item.spritePanel}/>}</ArtworkPresentationSvg>{selectedId===item.id&&<rect x={x-outer.widthMm/2-span/500} y={y-outer.heightMm/2-span/500} width={outer.widthMm+span/250} height={outer.heightMm+span/250} fill="none" stroke="#365cf5" strokeWidth={span/650} pointerEvents="none"/>}</g>{snapshot.dimensions&&selectedId===item.id&&<text x={x} y={y-outer.heightMm/2-span/65} textAnchor="middle" fontSize={span/70} fill="#365cf5">{formatMm(outer.widthMm)} × {formatMm(outer.heightMm)}{outer.framed?' · 외곽':''}</text>}</g>;})}
    {snapshot.dimensions&&selectedId&&<ArtworkElevationDimensions project={snapshot} wallId={wall.id} side={side} selectedIds={[selectedId]}/>}
    {snapshot.dimensions?.filter(dim=>dim.view==='elevation'&&dim.elevationWallId===wall.id).map(dim=>{const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;const position=(p:{x:number;y:number;z:number})=>{const along=((p.x-wall.start.x)*dx+(p.z-wall.start.z)*dz)/width;return {x:side==='back'?width-along:along,y:height-p.y};};const a=position(dim.start),b=position(dim.end);return <g key={dim.id} aria-label="치수선" pointerEvents="none"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#365cf5" strokeWidth={span/650}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-span/100} textAnchor="middle" fontSize={span/80} fill="#365cf5">{formatMm(dim.distanceMm)}</text></g>;})}
    {active&&<TemporaryMeasure points={measurePoints.map(point=>projectElevationPoint(wall,side,point))} scale={span}/>}
    {active&&measurePoints.length===2&&(()=>{const a=projectElevationPoint(wall,side,measurePoints[0]),b=projectElevationPoint(wall,side,measurePoints[1]);return <text aria-label="임시 측정 값" x={(a.x+b.x)/2} y={(a.y+b.y)/2-span/70} textAnchor="middle" fontSize={span/75} fill="#16816b" stroke="#fff" strokeWidth={span/450} paintOrder="stroke">임시 측정 {formatMm(measurementDistance(measurePoints[0],measurePoints[1]))}</text>;})()}
  </svg></div>;
}

export default function SharedViewer({shareId}:{shareId:string|null}){
  const [publication,setPublication]=useState<PublicShareSnapshot|null>(null);
  const [sceneId,setSceneId]=useState<string|null>(null);
  const snapshot=publication?.scenes?.find(s=>s.id===sceneId)?.snapshot??publication;
 const formatMm=(value:number)=>formatLength(value,snapshot?.displayUnit);
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
  const changeView=(next:View)=>{setView(next);setMeasurePoints([]);if(next==='elevation'&&snapshot?.walls.length===0)setMeasuring(false);};
  useEffect(()=>{
    if(!shareId)return;
    const abort=new AbortController();
    fetch(`/api/public/${shareId}`,{signal:abort.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok){let message=response.status===410?'중단된 공유 링크입니다.':response.status===404?'공유 링크를 찾을 수 없습니다.':'공유 화면을 불러오지 못했습니다.';try{const body=await response.json() as {error?:string};if(body.error)message=body.error;}catch{/* Status message is enough. */}throw new Error(message);}
      return parsePublicShare(await response.json());
    }).then(data=>{setPublication(data);setWallId(data.walls[0]?.id??null);document.title=`${data.name} — 공간 공유`;}).catch(reason=>{if(!abort.signal.aborted)setError((reason as Error).message);});
    return ()=>abort.abort();
  },[shareId]);
  useEffect(()=>{
    if(!shareId||!publication||error)return;
    const abort=new AbortController();
    let stopped=false;
    const verify=async()=>{
      try{
        const response=await fetch(`/api/public/${shareId}`,{signal:abort.signal,cache:'no-store'});
        if(response.status===410||response.status===404){
          let message=response.status===410?'중단되었거나 만료된 공유 링크입니다.':'공유 링크를 찾을 수 없습니다.';
          try{const body=await response.json() as {error?:string};if(body.error)message=body.error;}catch{/* Keep the status message. */}
          stopped=true;setPublication(null);setError(message);
        }
      }catch{/* Keep an already loaded view through a temporary network failure. */}
    };
    const onVisibility=()=>{if(document.visibilityState==='visible'&&!stopped)void verify();};
    const interval=window.setInterval(()=>{if(document.visibilityState==='visible'&&!stopped)void verify();},30000);
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>{abort.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisibility);};
  },[shareId,publication,error]);
  function changeScene(next:string|null){
    const layout=publication?.scenes?.find(s=>s.id===next)?.snapshot??publication;
    setSceneId(next);setSelection(null);setWallId(layout?.walls[0]?.id??null);setSide('front');setMeasuring(false);setMeasurePoints([]);setReset(0);
  }
  if(error)return <main className="shared-state" role="alert"><strong>{error}</strong><p>링크를 확인하거나 공유한 사람에게 새 링크를 요청해 주세요.</p></main>;
  if(!snapshot||!shareId)return <main className="shared-state" role="status">공유 공간을 불러오는 중…</main>;
  const selectedReference=selection?.kind==='referenceModel'?snapshot.referenceModel:undefined;
  const selectedId=selection?.kind==='referenceModel'?null:selection?.id??null;
  const selectedWall=selection?.kind==='wall'?snapshot.walls.find(item=>item.id===selection.id):undefined;
  const selectedModel=selection?.kind==='modelArtwork'?snapshot.modelArtworks?.find(item=>item.id===selection.id):undefined;
  const selectedArt=selection?.kind==='artwork'?snapshot.artworks.find(item=>item.id===selection.id):undefined;
  return <LengthUnitContext.Provider value={snapshot.displayUnit??'mm'}><main className="shared-viewer"><header className="shared-header"><div><span className="shared-brand">공간</span><span className="shared-title"><strong>{snapshot.name}</strong><small>{snapshot.venue}{snapshot.outdoor?.mode==='outdoor'&&<> · 야외 {snapshot.outdoor.date} {snapshot.outdoor.time} ({snapshot.outdoor.timeZone})</>}</small></span></div><span className="shared-readonly">읽기 전용 공유</span></header>
    {!!publication?.scenes?.length&&<SharedScenes scenes={publication.scenes} selectedId={sceneId} onChange={changeScene}/>}
    <div className="shared-content"><aside className="shared-list"><h1>전시 공간</h1><p>벽이나 작품을 선택해 정보를 볼 수 있습니다.</p>{snapshot.referenceModel&&<><h2>가져온 공간</h2><button className={selection?.kind==='referenceModel'?'active':''} onClick={()=>{setSelection({kind:'referenceModel',id:'referenceModel'});setMeasurePoints([]);}}>전시장 3D 모델</button></>}{snapshot.walls.length>0&&<h2>벽</h2>}{snapshot.walls.map(wall=><button key={wall.id} className={selectedId===wall.id?'active':''} onClick={()=>{setSelection({kind:'wall',id:wall.id});setWallId(wall.id);setMeasurePoints([]);}}>{wall.name}</button>)}{snapshot.artworks.length>0&&<><h2>작품</h2>{snapshot.artworks.map(art=><button key={art.id} className={selectedId===art.id?'active':''} onClick={()=>{setSelection({kind:'artwork',id:art.id});setWallId(art.wallId);setSide(art.wallSide);setMeasurePoints([]);}}>{art.name}</button>)}</>}{!!snapshot.modelArtworks?.length&&<><h2>3D 작품</h2>{snapshot.modelArtworks.map(a=><button key={a.id} className={selectedId===a.id?'active':''} onClick={()=>{setSelection({kind:'modelArtwork',id:a.id});setMeasurePoints([]);}}>{a.name}</button>)}</>}</aside>
    <section className="shared-stage" aria-label="공유 전시장"><div className="shared-tools"><nav aria-label="보기 전환"><button aria-pressed={view==='3d'} onClick={()=>changeView('3d')}>3D</button><button aria-pressed={view==='plan'} onClick={()=>changeView('plan')}>평면</button><button aria-pressed={view==='elevation'} onClick={()=>changeView('elevation')}>벽면</button></nav>{view==='3d'&&<button onClick={()=>setReset(value=>value+1)}>시점 초기화</button>}{view==='elevation'&&snapshot.walls.length>0&&<div className="shared-face"><button aria-pressed={side==='front'} onClick={()=>{setSide('front');setMeasurePoints([]);}}>A면</button><button aria-pressed={side==='back'} onClick={()=>{setSide('back');setMeasurePoints([]);}}>B면</button></div>}{snapshot.dimensions&&(view!=='elevation'||snapshot.walls.length>0)&&<button className="shared-measure-button" aria-pressed={measuring} onClick={()=>{setMeasuring(value=>!value);setMeasurePoints([]);}}>임시 줄자</button>}</div>
      {view==='3d'&&snapshot.walls.length>0&&<label className="shared-cutaway"><input type="checkbox" checked={cutaway} onChange={event=>setCutaway(event.target.checked)}/>벽 자동 숨김</label>}
      {view==='3d'?<Suspense fallback={<div className="shared-state">3D를 불러오는 중…</div>}><SharedViewer3D key={sceneId===null?'current-layout':`scene:${sceneId}`} referenceSelected={selection?.kind==='referenceModel'} snapshot={snapshot} shareId={shareId} selectedId={selectedId} onSelect={setSelection} reset={reset} cutaway={cutaway} measuring={measuring} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint}/></Suspense>:view==='plan'?<SharedPlan referenceSelected={selection?.kind==='referenceModel'} snapshot={snapshot} selectedId={selectedId} onSelect={setSelection} measuring={measuring} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint}/>:<SharedElevation snapshot={snapshot} shareId={shareId} wallId={wallId??snapshot.walls[0]?.id??null} side={side} selectedId={selectedId} onSelect={setSelection} measuring={measuring} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint}/>}
      <p className="shared-hint">{measuring?(measurePoints.length===2?`임시 측정 ${formatMm(measurementDistance(measurePoints[0],measurePoints[1]))} · 다음 점을 누르면 새 측정`:`${view==='3d'?'바닥·벽·작품':'도면'}에서 ${measurePoints.length?'끝점':'시작점'}을 선택하세요`):view==='3d'?'드래그 회전 · 마우스 휠 확대 · 오른쪽 버튼 이동':view==='plan'&&snapshot.referenceModel?'점선은 전시장 모델의 범위입니다. 실제 형상은 3D에서 확인하세요.':'벽이나 작품을 클릭해 선택할 수 있습니다.'}</p>
    </section><aside className="shared-info"><h2>선택 정보</h2>{selectedReference?<><strong>전시장 3D 모델</strong><p>원본 형상 · 배치 잠금</p>{snapshot.dimensions&&<p>{selectedReference.sizeMm.map(n=>formatMm(n*selectedReference.scale)).join(' × ')}</p>}{view==='plan'&&<p>평면의 점선은 모델 범위이며 실제 바닥 경계는 아닙니다.</p>}</>:(selectedModel||selectedArt)?<><SharedArtworkInformation artwork={(selectedModel??selectedArt)!} dimensions={!!snapshot.dimensions}/>{selectedArt&&<SharedInstallationInformation snapshot={snapshot} artworkId={selectedArt.id}/>}</>:selectedWall?<><strong>{selectedWall.name}</strong>{snapshot.dimensions&&<p>길이 {formatMm(length(selectedWall))}<br/>높이 {formatMm(selectedWall.heightMm)}<br/>두께 {formatMm(selectedWall.thicknessMm)}</p>}</>:<p>벽이나 작품을 선택하세요.</p>}</aside></div>
  </main></LengthUnitContext.Provider>;
}

export function SharedScenes({scenes,selectedId,onChange}:{scenes:NonNullable<PublicShareSnapshot['scenes']>;selectedId:string|null;onChange:(id:string|null)=>void}){
 return <nav className="shared-scenes" aria-label="전시 Scene"><span>Scene</span><button aria-pressed={selectedId===null} onClick={()=>onChange(null)}>현재 배치</button>{scenes.map(scene=><button key={scene.id} aria-pressed={selectedId===scene.id} onClick={()=>onChange(scene.id)}>{scene.name}</button>)}</nav>;
}

export function SharedArtworkInformation({artwork:a,dimensions}:{artwork:PublicShareSnapshot['artworks'][number]|NonNullable<PublicShareSnapshot['modelArtworks']>[number];dimensions:boolean}){
 const formatMm=useLengthFormatter();
 const isModel='kind' in a,presentation=isModel?null:artworkPresentation(a);
 return <><strong>{a.name}</strong><p>{a.artist||'작가 미기재'}{a.year&&` · ${a.year}`}</p>
  {(a.artworkType||isModel)&&<p>{isModel?'3D ':''}{artworkTypeLabels[a.artworkType??(isModel?a.kind:'custom')]}{isModel?' · 배치 잠금':''}</p>}
  {a.presentationType&&<p aria-label="설치 형식">{presentationTypeLabels[a.presentationType]}</p>}
  {a.medium&&<p className="shared-medium" aria-label="작품 재료">{a.medium}</p>}
  {dimensions&&<><p>{formatMm(a.widthMm)} × {formatMm(a.heightMm)} × {formatMm(a.depthMm)}{presentation?.framed?' · 본체':''}</p>{presentation?.framed&&<p>액자 포함 {formatMm(presentation.widthMm)} × {formatMm(presentation.heightMm)} × {formatMm(presentation.depthMm)}</p>}</>}
  {a.description&&<p className="shared-description" aria-label="작품 설명">{a.description}</p>}
 </>;
}

/** Uses only the current public Scene and respects its dimension-disclosure switch. */
export function SharedInstallationInformation({snapshot,artworkId}:{snapshot:PublicShareSnapshot;artworkId:string}){
 const formatMm=(value:number)=>formatLength(value,snapshot?.displayUnit);
 if(!snapshot.dimensions)return null;
 const art=snapshot.artworks.find(a=>a.id===artworkId);if(!art)return null;
 const dimensions=artworkElevationDimensions(snapshot,art.wallId,art.wallSide,[art.id]);if(!dimensions.length)return null;
 return <section className="shared-installation-info" aria-label="작품 설치 치수"><h3>작품 설치 치수</h3><dl>{dimensions.map(d=>{const neighbor=d.kind==='gap'?snapshot.artworks.find(a=>a.id===d.artworkIds.find(id=>id!==art.id)):undefined;return <div key={d.key}><dt>{installationDimensionLabel(d)}{neighbor&&` · ${neighbor.name}`}</dt><dd>{formatMm(d.distanceMm)}</dd></div>;})}</dl><p>회전한 액자 외곽 기준 · 벽 왼쪽/오른쪽은 해당 면에서 보이는 방향입니다.</p></section>;
}
