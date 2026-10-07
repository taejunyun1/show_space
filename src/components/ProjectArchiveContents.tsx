import {useMemo,type ReactNode} from 'react';
import type {Project} from '../domain/types';
import {archiveMaterials,archiveNotes,archivePhotos,type ArchiveSection} from '../domain/projectArchive';
import {formatLength} from '../domain/lengthUnits';
import {artworkPresentation} from '../domain/artworkPresentation';
import {materialPresets} from '../domain/materials';
import {DEFAULT_LIGHTING} from '../domain/lighting';
import {INSTALLATION_STAGES} from '../domain/notes';

function RecordCard({title,rows,children}:{title:string;rows:Array<[string,string]>;children?:ReactNode}){
 return <article className="archive-record"><h4>{title}</h4><dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{children}</article>;
}
/** Detached, private and read-only. Never mounts editor fields or restores a Scene. */
export function ProjectArchiveContents({project,layout,section,onScene}:{project:Project;layout:Project;section:ArchiveSection;onScene:(id:string)=>void}){
 const photos=useMemo(()=>section==='photos'?archivePhotos(project):[],[project,section]);
 const length=(n:number)=>formatLength(n,project.displayUnit??'mm'),size=(w:number,h:number,d:number)=>[w,h,d].map(length).join(' × '),pose=(p:{x:number;y:number;z:number})=>`X ${length(p.x)} · Y ${length(p.y)} · Z ${length(p.z)}`;
 const status=(item:{visible:boolean;locked:boolean})=>`${item.visible?'표시':'숨김'} · ${item.locked?'잠김':'잠금 해제'}`;
 if(section==='space')return <div className="archive-records"><RecordCard title="공간 기록" rows={[
  ['전시장',project.venue||'미지정'],['벽',`${layout.walls.length}개`],['연결된 개구부',`${layout.openings?.length??0}개`],['저장 치수',`${layout.dimensions?.length??0}개`],['바닥',layout.importedFloor?`가져온 외곽선 ${layout.importedFloor.length}개`:'벽 외곽선 기준'],['도면 축척',project.planReference?project.planReference.calibrated?`${length(project.planReference.mmPerPixel)} / px`:'축척 미지정':'도면 없음'],
 ]}/>{layout.walls.map(w=><RecordCard key={w.id} title={w.name} rows={[
  ['길이',length(Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z))],['높이',length(w.heightMm)],['두께',length(w.thicknessMm)],['시작점',`X ${length(w.start.x)} · Z ${length(w.start.z)}`],['끝점',`X ${length(w.end.x)} · Z ${length(w.end.z)}`],['상태',status(w)],
 ]}/>)}{layout.referenceModel&&<RecordCard title={'참고 공간 · '+layout.referenceModel.name} rows={[
  ['원본 크기',layout.referenceModel.sizeMm.map(length).join(' × ')],['배율',String(layout.referenceModel.scale)],['위치',layout.referenceModel.positionMm.map(length).join(' · ')],['회전',`${layout.referenceModel.rotationDeg}°`],['상태',layout.referenceModel.visible?'표시':'숨김'],
 ]}/>}</div>;
 if(section==='layout')return <div className="archive-records">{[...layout.artworks,...layout.unplacedArtworks??[]].map(a=><RecordCard key={a.id} title={a.name} rows={[
  ['작가',a.artist||'미지정'],['크기 W × H × D',size(a.widthMm,a.heightMm,a.depthMm)],['벽','wallId' in a&&typeof a.wallId==='string'?layout.walls.find(w=>w.id===a.wallId)?.name??a.wallId:'미배치'],['설치 면',a.wallSide==='back'?'B면':'A면'],['벽 시작점에서',length(a.alongMm)],['중심 높이',length(a.centerHeightMm)],['면내 회전',`${a.rotationDeg??0}°`],['프레임',a.frame],['액자 포함 외곽',size(artworkPresentation(a).widthMm,artworkPresentation(a).heightMm,artworkPresentation(a).depthMm)],...(a.frame!=='none'?[['액자 폭 · 깊이',`${length(artworkPresentation(a).settings.widthMm)} · ${length(artworkPresentation(a).settings.depthMm)}`],['매트 폭 · 색상',`${length(artworkPresentation(a).settings.matWidthMm)} · ${artworkPresentation(a).settings.matColor}`],['액자 재질 · 커버',`${artworkPresentation(a).settings.material} · ${artworkPresentation(a).settings.cover}`]] as Array<[string,string]>:[]),['그룹',a.groupId??'없음'],['상태',status(a)],
 ]}>{a.imageUrl&&<img className="archive-art-image" src={a.imageUrl} alt={a.name} loading="lazy"/>}</RecordCard>)}{layout.modelArtworks?.map(a=><RecordCard key={a.id} title={a.name+' · 3D'} rows={[
  ['작가',a.artist||'미지정'],['크기 W × H × D',size(a.widthMm,a.heightMm,a.depthMm)],['위치',pose(a.position)],['회전 XYZ',`${a.rotation.x}° · ${a.rotation.y}° · ${a.rotation.z}°`],['그룹',a.groupId??'없음'],['상태',status(a)],
 ]}/>)}{!layout.artworks.length&&!layout.unplacedArtworks?.length&&!layout.modelArtworks?.length&&<p>저장된 작품이 없습니다.</p>}</div>;
 if(section==='materials')return <><p className="field-hint">가져온 3D 모델의 내부 재질은 모델 원본과 읽기 전용 3D 보기에 보존됩니다.</p><div className="archive-records">{archiveMaterials(layout).map(m=><RecordCard key={m.key} title={m.label} rows={[
  ['색상',m.color],['재질',materialPresets.find(p=>p.id===m.material?.preset)?.label??'기본 재질'],...(m.material?[
   ['거칠기',String(m.material.roughness)],['금속성',String(m.material.metalness)],['불투명도',String(m.material.opacity)],['투과',String(m.material.transmission)],['두께',length(m.material.thicknessMm)],['굴절률',String(m.material.ior)],['코팅',String(m.material.clearcoat)],['섬유 광택',String(m.material.sheen)],
  ] as Array<[string,string]>:[]),...(m.material?.texture?[['텍스처 반복 크기',`${length(m.material.texture.widthMm)} × ${length(m.material.texture.heightMm)}`]] as Array<[string,string]>:[]),...(m.material?.normal?[['노멀 반복 크기',`${length(m.material.normal.widthMm)} × ${length(m.material.normal.heightMm)}`],['노멀 강도',String(m.material.normal.strength)]] as Array<[string,string]>:[]),
 ]}>{m.material?.texture&&<img className="archive-art-image" src={m.material.texture.imageUrl} alt={m.label+' 텍스처'} loading="lazy"/>}{m.material?.normal&&<img className="archive-art-image" src={m.material.normal.imageUrl} alt={m.label+' 노멀 맵'} loading="lazy"/>}</RecordCard>)}</div></>;
 if(section==='lighting'){const env=layout.lighting??DEFAULT_LIGHTING;return <div className="archive-records"><RecordCard title="환경 조명" rows={[
  ['주변광',String(env.ambient)],['반구광',String(env.hemisphere)],['보조광',String(env.fill)],['환경 반사',String(env.environment)],['환경',layout.outdoor?.mode==='outdoor'?'야외':'실내'],...(layout.outdoor?.mode==='outdoor'?[
   ['일시',`${layout.outdoor.date} ${layout.outdoor.time} (${layout.outdoor.timeZone})`],['위도 · 경도',`${layout.outdoor.latitude} · ${layout.outdoor.longitude}`],['북쪽',`${layout.outdoor.northDeg}°`],['환경 프리셋',layout.outdoor.preset],['태양 강도',String(layout.outdoor.sunIntensity)],
  ] as Array<[string,string]>:[]),
 ]}/>{layout.lights?.map(l=><RecordCard key={l.id} title={l.name} rows={[
  ['종류',l.projection?'프로젝터':l.kind==='spot'?'스팟':'면 조명'],['위치',pose(l.position)],['조준점',pose(l.target)],['강도',String(l.intensity)],['색온도',`${l.kelvin} K`],['빔 각도',`${l.beamDeg}°`],['크기',`${length(l.widthMm)} × ${length(l.heightMm)}`],['그림자',l.shadow?'사용':'꺼짐'],['상태',status(l)],
 ]}/>)}<p className="field-hint">저장된 시각화 설정입니다. 실제 설치 장소의 Lux 측정값은 아닙니다.</p></div>;}
 if(section==='notes'){const notes=archiveNotes(layout);return <><p className="field-hint">비공개 설치 메모입니다. 프로젝트·바닥 메모는 공통 기록이고, 각 개체 메모는 선택한 배치의 기록입니다.</p><div className="archive-records">{notes.map(n=><article key={n.key} className="archive-record"><h4>{n.label}</h4>{n.text&&<p className="archive-note-text">{n.text}</p>}{n.details.checklist.length>0&&<ul>{n.details.checklist.map(c=><li key={c.id}>{c.done?'✓':'○'} {c.text}</li>)}</ul>}{Object.keys(n.details.installation??{}).length>0&&<ul>{INSTALLATION_STAGES.filter(([key])=>n.details.installation?.[key]!==undefined).map(([key,label])=><li key={key}>{n.details.installation?.[key]?'✓':'○'} {label}</li>)}</ul>}{n.details.images.map(i=><figure key={i.id}><img src={i.imageUrl} alt={i.name} loading="lazy"/><figcaption>{i.name}</figcaption></figure>)}</article>)}{!notes.length&&<p>저장된 메모가 없습니다.</p>}</div></>;}
 if(section==='scenes')return <div className="archive-records">{project.scenes.map(s=><article className="archive-record" key={s.id}><h4>{s.name}</h4>{s.thumbnail?<img className="archive-scene-image" src={s.thumbnail.imageUrl} alt={s.name+' 저장 썸네일'} loading="lazy"/>:<p className="field-hint">저장 썸네일 없음</p>}<p>벽 부착 작품 {s.artworks.length}점 · 3D 작품 {s.structure?.modelArtworks?.length??project.modelArtworks?.length??0}점{s.cameraView?' · 시점 저장됨':''}</p><button className="button secondary" onClick={()=>onScene(s.id)}>이 Scene 기록 보기</button></article>)}{!project.scenes.length&&<p>저장된 Scene이 없습니다.</p>}</div>;
 return <><p className="field-hint">현재 배치와 모든 Scene에 첨부한 비공개 참고 사진입니다. 동일한 이미지는 한 번만 표시합니다.</p><div className="archive-records">{photos.map(p=><figure className="archive-record" key={p.id}><img src={p.imageUrl} alt={p.name} loading="lazy"/><figcaption><strong>{p.name}</strong><ul>{p.sources.map(s=><li key={s}>{s}</li>)}</ul></figcaption></figure>)}{!photos.length&&<p>첨부된 참고 사진이 없습니다.</p>}</div></>;
}
