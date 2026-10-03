import type {Artwork,ModelArtwork} from '../domain/types';
import {artworkTypes,presentationTypes,artworkTypeLabels,presentationTypeLabels,ARTWORK_YEAR_MAX,ARTWORK_MEDIUM_MAX,ARTWORK_DESCRIPTION_MAX,type ArtworkInformation} from '../domain/artworkInformation';
import {TextEditor} from './Controls';
export function ArtworkInformationEditor({artwork:a,onChange}:{artwork:Artwork|ModelArtwork;onChange:(patch:ArtworkInformation&{artist?:string})=>void}){
 const isModel='model' in a,prefix=isModel?'3D 작품':'작품',type=a.artworkType??(isModel?a.kind:''),presentation=a.presentationType??(isModel?(a.kind==='sculpture'?'sculpture':'object'):a.frame==='none'?'':'framed-print');
 return <section className="inspector-section artwork-information"><h3>작품 정보</h3>
  <label className="select-field"><span>작가</span><TextEditor label={`${prefix} 작가`} value={a.artist} maxLength={200} disabled={a.locked} onCommit={artist=>onChange({artist})}/></label>
  <label className="select-field"><span>연도</span><TextEditor label={`${prefix} 연도`} value={a.year??''} maxLength={ARTWORK_YEAR_MAX} disabled={a.locked} placeholder="2026 또는 제작 기간" onCommit={year=>onChange({year})}/></label>
  <label className="select-field"><span>작품 종류</span><select aria-label={`${prefix} 종류`} value={type} disabled={a.locked} onChange={e=>onChange({artworkType:(e.target.value||undefined) as ArtworkInformation['artworkType']})}>{!isModel&&<option value="">미지정</option>}{artworkTypes.map(value=><option key={value} value={value}>{artworkTypeLabels[value]}</option>)}</select></label>
  <label className="select-field"><span>설치 형식</span><select aria-label={`${prefix} 설치 형식`} value={presentation} disabled={a.locked} onChange={e=>onChange({presentationType:(e.target.value||undefined) as ArtworkInformation['presentationType']})}>{!isModel&&<option value="">미지정</option>}{presentationTypes.map(value=><option key={value} value={value}>{presentationTypeLabels[value]}</option>)}</select></label>
  <label className="select-field"><span>재료</span><TextEditor label={`${prefix} 재료`} value={a.medium??''} maxLength={ARTWORK_MEDIUM_MAX} disabled={a.locked} placeholder="예: 아카이벌 피그먼트 프린트" onCommit={medium=>onChange({medium})}/></label>
  <label className="artwork-description"><span>작품 설명</span><TextEditor label={`${prefix} 설명`} value={a.description??''} maxLength={ARTWORK_DESCRIPTION_MAX} disabled={a.locked} multiline placeholder="공개용 작품 설명을 입력하세요" onCommit={description=>onChange({description})}/></label>
  <p className="field-hint">이름·작가·연도는 공유 기본 정보입니다. 재료·설명·분류는 공유 창에서 상세 정보 공개를 켠 링크에만 표시됩니다. 설치 메모는 별도로 비공개 저장됩니다.{isModel?' 원본 3D 형상은 그대로 유지됩니다.':' 설치 형식을 바꾸면 액자 표시도 맞춰집니다.'}</p>
 </section>;
}
