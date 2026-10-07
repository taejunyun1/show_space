import {useMemo} from 'react';
import {placementWarningIndex} from '../domain/placementWarnings';
import {useLengthFormatter} from './LengthUnits';
import {ArtworkInformationEditor} from './ArtworkInformationEditor';
import {LockKeyhole,UnlockKeyhole,TriangleAlert} from 'lucide-react';
import type {ModelArtwork} from '../domain/types';
import {useEditor} from '../state/editor';
import {NumberField,IconButton} from './Controls';
import {modelArtworkBounds} from '../domain/modelArtworks';
export function ModelArtworkInspector({artwork:a}:{artwork:ModelArtwork}){
 const formatLength = useLengthFormatter();
 const displayed=useEditor(s=>s.previewProject??s.project),placement=useMemo(()=>placementWarningIndex(displayed),[displayed]),warnings=placement.query({type:'modelArtwork',id:a.id});
 const state=useEditor(),selected=(state.project.modelArtworks??[]).filter(a=>state.selected.some(s=>s.type==='modelArtwork'&&s.id===a.id)),modelsOnly=selected.length===state.selected.length,locked=selected.some(a=>a.locked),grouped=!!selected[0]?.groupId&&selected.every(a=>a.groupId===selected[0].groupId);
 const patch=(p:Partial<ModelArtwork>)=>state.patchModelArtwork(a.id,p),bounds=modelArtworkBounds(displayed.modelArtworks?.find(m=>m.id===a.id)??a);
 return <><section className="inspector-section"><h3>3D 작품 선택</h3><div className="rotation-buttons"><button className="button secondary" disabled={!modelsOnly||selected.length<2||locked||grouped} onClick={()=>state.groupSelectedModelArtworks()}>3D 작품 그룹 만들기</button><button className="button secondary" disabled={!modelsOnly||locked||!selected.some(a=>a.groupId)} onClick={()=>state.groupSelectedModelArtworks(true)}>3D 작품 그룹 해제</button></div><p className="field-hint">Shift로 여러 3D 작품을 선택하세요. 이동·회전은 선택 전체에 적용하고, 숫자 크기는 첫 작품에 적용합니다.</p></section>
 <ArtworkInformationEditor artwork={a} onChange={p=>patch({...p,...(p.artworkType?{kind:(['sculpture','installation','object','custom'].includes(p.artworkType)?p.artworkType:'custom') as ModelArtwork['kind']}:{})})}/>

 <section className="inspector-section"><h3>3D 작품 크기<IconButton label={a.locked?'3D 작품 잠금 해제':'3D 작품 잠금'} active={a.locked} onClick={()=>patch({locked:!a.locked})}>{a.locked?<LockKeyhole size={16}/>:<UnlockKeyhole size={16}/>}</IconButton></h3>{(['widthMm','heightMm','depthMm'] as const).map((key,i)=><NumberField key={key} label={`3D ${['W','H','D'][i]}`} value={a[key]} min={1} max={50000} disabled={a.locked} onChange={n=>patch({[key]:n})}/>)}<p className="field-hint">실제 크기는 숫자로만 바뀝니다. 화면 핸들로 크기를 늘리거나 줄이지 않습니다.</p></section>
 <section className="inspector-section"><h3>3D 작품 위치</h3>{(['x','y','z'] as const).map(key=><NumberField key={key} label={`3D 위치 ${key.toUpperCase()}`} value={a.position[key]} min={-1e7} max={1e7} disabled={locked} onChange={n=>patch({position:{...a.position,[key]:n}})}/>)}<button className="button secondary full" disabled={locked} onClick={state.floorSelectedModelArtwork}>바닥에 놓기</button><div className="computed-value"><span>바닥에서 작품 최하단</span><span>{formatLength(bounds.minY)}</span></div><p className="field-hint">위치는 원본 모델의 바닥 중앙 기준입니다. 기울인 작품도 최하단이 바닥에 닿도록 놓을 수 있습니다. 드래그 중 벽·바닥·다른 3D 작품에 맞춰집니다. Alt를 누르거나 상단 스냅을 끄면 자유롭게 이동합니다. 숫자 입력은 그대로 적용됩니다.</p></section>
 {warnings.length>0&&<section className="inspector-section" aria-label="3D 작품 배치 경고"><h3>배치 경고</h3>{warnings.map(w=><p className="warning" role="status" key={w.code}><TriangleAlert size={14}/>{w.message}</p>)}<p className="field-hint">회전된 외곽 상자로 비교한 안내입니다. 작품 안의 빈 공간은 판별하지 않으며, 위치·크기를 자동으로 바꾸지 않습니다.</p></section>}
 <section className="inspector-section"><h3>3D 작품 회전</h3>{(['x','y','z'] as const).map(key=><NumberField key={key} label={`3D 회전 ${key.toUpperCase()}`} value={a.rotation[key]} min={-180} max={180} step={1} suffix="°" disabled={locked} onChange={n=>patch({rotation:{...a.rotation,[key]:n}})}/>)}<div className="rotation-buttons"><button className="button secondary" disabled={locked} onClick={()=>patch({rotation:{...a.rotation,y:((a.rotation.y+90+180)%360+360)%360-180}})}>Y축 90° 회전</button><button className="button secondary" disabled={locked} onClick={()=>patch({rotation:{x:0,y:0,z:0}})}>회전 초기화</button></div></section></>;
}
