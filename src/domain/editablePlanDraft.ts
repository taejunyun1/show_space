import {buildAutomaticVenue,extractStructuralWalls,planEvidenceKey} from './automaticVenue';
import {calibratePlan} from './plan';
import type {PlanPage} from '../lib/planImport';
import type {MeasurementAnchor,Opening,Point,Project,SavedDimension,SceneStructure,Wall} from './types';

export interface EditablePlanDraft {kind:'verified'|'partial'|'none';project?:Project;reasons:string[];wallCount:number}

function evidenceHash(page:PlanPage){
 const key=planEvidenceKey(page);let hash=2166136261;
 for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
 return (hash>>>0).toString(16).padStart(8,'0');
}

/** Keep the strict, measured reconstruction intact; offer isolated wall segments when it is withheld. */
export function buildEditablePlanDraft(page:PlanPage):EditablePlanDraft {
 const verified=buildAutomaticVenue(page);
 if(verified.project)return {...verified,kind:'verified'};
 if(page.analysis?.lineState!=='complete')return {...verified,kind:'none'};
 const candidates=extractStructuralWalls(page).filter(w=>Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)>0).slice(0,200);
 if(!candidates.length)return {...verified,kind:'none'};
 const walls=candidates.map(w=>({...w,role:'partition' as const,note:`축척 미정 · 구조선 후보입니다. 실제 벽인지와 길이를 확정하지 않았습니다. ${w.note}`}));
 const project:Project={schemaVersion:1,id:'partial-venue',name:'도면 편집 초안',venue:'도면에서 생성',walls,artworks:[],scenes:[],floorColor:'#f1f1ed',planImageUrl:page.imageUrl,planOpacity:.55,planLabels:page.labels??[],planAnalysis:page.analysis,planReference:{widthPx:page.widthPx,heightPx:page.heightPx,origin:{x:0,z:0},mmPerPixel:1,calibrated:false},planDraft:{kind:'partial',sourceEvidenceHash:evidenceHash(page),originalWalls:structuredClone(walls)}};
 return {kind:'partial',project,wallCount:walls.length,reasons:verified.reasons};
}

/** Reanalysis replaces evidence only. It never silently reapplies detector geometry. */
export function refreshPlanEvidence(project:Project,page:PlanPage):Project {
 if(project.planImageUrl!==page.imageUrl||project.planReference?.widthPx!==page.widthPx||project.planReference?.heightPx!==page.heightPx)throw new Error('기존 도면과 다른 이미지입니다. 새 도면으로 배치해 주세요.');
 return {...project,planLabels:page.labels??[],planAnalysis:page.analysis};
}

export function draftEditSummary(project:Project){
 const original=project.planDraft?.originalWalls??[],byId=new Map(original.map(w=>[w.id,w]));
 const current=new Map(project.walls.map(w=>[w.id,w]));
 return {added:project.walls.filter(w=>!byId.has(w.id)).length,removed:original.filter(w=>!current.has(w.id)).length,modified:project.walls.filter(w=>{const source=byId.get(w.id);return source&&JSON.stringify(w)!==JSON.stringify(source);}).length};
}

/** Pixel-space draft coordinates become millimetres while retaining the chosen image anchor. */
export function calibrateEditableDraft(project:Project,a:Point,b:Point,lengthMm:number):Project {
 const reference=project.planReference;if(!reference)throw new Error('도면 축척 정보가 없습니다.');
 const nextReference=calibratePlan(reference,a,b,lengthMm);
 if(!project.planDraft)return {...project,planReference:nextReference};
 const ratio=nextReference.mmPerPixel/reference.mmPerPixel;
 const anchor={x:reference.origin.x+a.x*reference.mmPerPixel,z:reference.origin.z+a.z*reference.mmPerPixel};
 const point=(p:Point):Point=>({x:anchor.x+(p.x-anchor.x)*ratio,z:anchor.z+(p.z-anchor.z)*ratio});
 const wall=(w:Wall):Wall=>({...w,start:point(w.start),end:point(w.end),note:w.note.startsWith('축척 미정 · 구조선 후보입니다. 실제 벽인지와 길이를 확정하지 않았습니다.')?w.note.replace('축척 미정 · 구조선 후보입니다. 실제 벽인지와 길이를 확정하지 않았습니다.','축척 보정됨 · 구조선 후보입니다. 실제 벽 여부와 도면상 위치를 확인해 주세요.'):w.note});
 const measurement=(v:MeasurementAnchor):MeasurementAnchor=>({...v,fallback:{...v.fallback,...point(v.fallback)},...(v.kind==='wall'?{offsetMm:v.offsetMm*ratio}:{})});
 const opening=(o:Opening):Opening=>({...o,start:o.start.point?{point:point(o.start.point)}:o.start,end:o.end.point?{point:point(o.end.point)}:o.end});
 const dimension=(d:SavedDimension):SavedDimension=>({...d,start:measurement(d.start),end:measurement(d.end),offsetMm:d.offsetMm*ratio});
 const structure=(s:SceneStructure):SceneStructure=>({...s,walls:s.walls.map(wall),openings:s.openings.map(opening),dimensions:s.dimensions.map(dimension),unplacedArtworks:s.unplacedArtworks.map(art=>({...art,alongMm:art.alongMm*ratio}))});
 return {...project,planReference:nextReference,walls:project.walls.map(wall),artworks:project.artworks.map(art=>({...art,alongMm:art.alongMm*ratio})),...(project.unplacedArtworks?{unplacedArtworks:project.unplacedArtworks.map(art=>({...art,alongMm:art.alongMm*ratio}))}:{}),scenes:project.scenes.map(scene=>({...scene,artworks:scene.artworks.map(art=>({...art,alongMm:art.alongMm*ratio})),...(scene.structure?{structure:structure(scene.structure)}:{})})),openings:project.openings?.map(opening),dimensions:project.dimensions?.map(dimension),planDraft:{...project.planDraft,originalWalls:project.planDraft.originalWalls.map(wall)}};
}
