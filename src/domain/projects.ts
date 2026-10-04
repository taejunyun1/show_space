import type {LengthUnit} from './lengthUnits';
import {createDemoProject,parseProject} from './model';
import {DEFAULT_OUTDOOR} from './outdoor';
import type {Project} from './types';
export function newProject({name,venue,widthMm,depthMm,heightMm,outdoor=false,displayUnit='mm'}:{name:string;venue:string;widthMm:number;depthMm:number;heightMm:number;outdoor?:boolean;displayUnit?:LengthUnit}):Project{
  for(const [label,value,max] of [['너비',widthMm,200000],['깊이',depthMm,200000],['벽 높이',heightMm,30000]] as const)if(!Number.isFinite(value)||value<100||value>max)throw new Error(`${label}은 100~${max.toLocaleString()}mm 범위로 입력해주세요.`);
  const cleanName=name.trim(),cleanVenue=venue.trim();if(!cleanName||cleanName.length>200||cleanVenue.length>200)throw new Error('프로젝트 이름은 1~200자, 전시장 이름은 200자 이내로 입력해주세요.');
  const base=createDemoProject(),points=[{x:-widthMm/2,z:-depthMm/2},{x:widthMm/2,z:-depthMm/2},{x:widthMm/2,z:depthMm/2},{x:-widthMm/2,z:depthMm/2}];
  return parseProject({...base,displayUnit,id:crypto.randomUUID(),name:cleanName,venue:cleanVenue,artworks:[],scenes:[],walls:base.walls.map((w,i)=>({...w,start:points[i],end:points[(i+1)%4],heightMm,role:'boundary'})),...(outdoor?{outdoor:{...DEFAULT_OUTDOOR,mode:'outdoor'}}:{})});
}
export function copyProject(project:Project,name=project.name+' 복사본'):Project{
  if(!name.trim())throw new Error('복사본 이름을 입력해주세요.');
  return structuredClone(parseProject({...project,id:crypto.randomUUID(),name:name.trim()}));
}
