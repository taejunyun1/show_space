import {parseProject} from './model';
import type {Point,Project,ReferenceModel,Wall} from './types';
export function sameModelGeometry(a:ReferenceModel|undefined,b:ReferenceModel):boolean{
 return !!a&&a.dataUrl===b.dataUrl&&a.scale===b.scale&&a.rotationDeg===b.rotationDeg&&(['sourceOffsetM','positionMm'] as const).every(key=>a[key].every((v,i)=>v===b[key][i]));
}
export function adoptModelSpace(project:Project,walls:Wall[],importedFloor?:Point[][]):Project{
 if(!project.referenceModel)throw new Error('먼저 3D 모델을 불러오세요.');
 if(!walls.length)throw new Error('편집 가능한 직선 벽을 찾지 못했습니다. 참고 모델로 계속 볼 수 있습니다.');
 if(walls.length>200)throw new Error('편집 가능한 벽은 최대 200개입니다. 전시장 구조를 단순화한 뒤 다시 시도하세요.');
 if(project.walls.some(w=>w.locked)||project.artworks.some(a=>a.locked))throw new Error('기존 공간의 벽·작품 잠금을 해제한 뒤 모델 벽으로 전환하세요.');
 const previous={floorColor:project.floorColor,...(project.floorMaterial?{floorMaterial:structuredClone(project.floorMaterial)}:{}),...(project.importedFloor?{importedFloor:structuredClone(project.importedFloor)}:{}),walls:structuredClone(project.walls),openings:structuredClone(project.openings??[]),dimensions:structuredClone(project.dimensions??[]),unplacedArtworks:structuredClone(project.unplacedArtworks??[]),referenceModel:structuredClone(project.referenceModel)};
 const occupied=new Set([...project.artworks,...(project.unplacedArtworks??[])].map(a=>a.id));
 const mapped=walls.map((wall,index)=>{let id=wall.id,suffix=index+1;while(occupied.has(id))id=`model-wall-${suffix++}`;occupied.add(id);return {...wall,id};});
 return parseProject({...project,importedFloor,walls:mapped,artworks:[],unplacedArtworks:[...(project.unplacedArtworks??[]),...project.artworks.map(({wallId,...a})=>a)],referenceModel:{...project.referenceModel,visible:false},openings:[],dimensions:[],planDraft:undefined,planImageUrl:undefined,planReference:undefined,planLabels:undefined,planAnalysis:undefined,sourcePlan:undefined,scenes:project.scenes.map(scene=>scene.structure?scene:{...scene,structure:structuredClone(previous)})});
}
