import {it,expect} from 'vitest';
import {buildAutomaticVenue,extractStructuralWalls} from './automaticVenue';
import {detectPlanLabels} from './planLabels';
import {detectWallCandidates} from './wallCandidates';
import {parseProject} from './model';
import type {PlanPage} from '../lib/planImport';
const line=(id:string,x:number,y:number,x2:number,y2:number,thicknessPx=1)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx});
function fixture():PlanPage{return {imageUrl:'data:image/png;base64,AA==',widthPx:1000,heightPx:800,labels:detectPlanLabels([{text:'8000 mm',source:'pdf-text',box:{x:400,y:30,width:100,height:20}},{text:'6000 mm',source:'pdf-text',box:{x:30,y:350,width:20,height:80}}]),analysis:{textState:'complete',lineState:'complete',numericCount:2,issues:[],lines:[line('a',100,100,900,100,5),line('b',900,100,900,700,5),line('c',900,700,100,700,5),line('d',100,700,100,100,5),line('dx',100,60,900,60),line('wx1',100,50,100,105),line('wx2',900,50,900,105),line('dy',60,100,60,700),line('wy1',50,100,105,100),line('wy2',50,700,105,700)]}};}
it('builds a separate valid draft from two independent dimensions without changing input',()=>{const p=fixture(),before=structuredClone(p),r=buildAutomaticVenue(p);expect(r.project?.planReference?.mmPerPixel).toBe(10);expect(r.project?.walls).toHaveLength(4);expect(r.project?.artworks).toEqual([]);expect(parseProject(r.project).walls).toHaveLength(4);expect(p).toEqual(before);});
it('withholds conflicting scale',()=>{const p=fixture();p.labels![1].text='9000 mm';expect(buildAutomaticVenue(p).project).toBeUndefined();});
it('does not guess missing units or use a duplicate wall as independent evidence',()=>{const p=fixture();p.labels![1]={...p.labels![0],id:'duplicate'};expect(buildAutomaticVenue(p).project).toBeUndefined();for(const l of p.labels!)l.text='8000';expect(buildAutomaticVenue(p).project).toBeUndefined();});
it('withholds low confidence OCR and dismissed evidence',()=>{for(const patch of [{source:'ocr' as const,confidence:60},{status:'dismissed' as const}]){const p=fixture();Object.assign(p.labels![1],patch);expect(buildAutomaticVenue(p).project).toBeUndefined();}});
it('never closes large openings or builds incomplete analysis',()=>{const p=fixture();p.analysis!.lines[0].start.x=150;expect(buildAutomaticVenue(p).project).toBeUndefined();p.analysis!.lineState='failed';expect(buildAutomaticVenue(p).project).toBeUndefined();});
it('ignores short glyph strokes',()=>{const p=fixture();p.analysis!.lines.push(line('glyph',400,30,400,50,5));expect(buildAutomaticVenue(p).project?.walls).toHaveLength(4);});
it('connects raster detection to automatic draft generation',()=>{const p=fixture(),pixels=new Uint8ClampedArray(1000*800*4).fill(255);for(const l of p.analysis!.lines){const half=Math.floor(l.thicknessPx/2);for(let y=Math.min(l.start.y,l.end.y)-half;y<=Math.max(l.start.y,l.end.y)+half;y++)for(let x=Math.min(l.start.x,l.end.x)-half;x<=Math.max(l.start.x,l.end.x)+half;x++){const i=(y*1000+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}}p.analysis!.lines=detectWallCandidates(pixels,1000,800,{threshold:155,minLengthPx:10,minThicknessPx:1});expect(buildAutomaticVenue(p).project?.walls).toHaveLength(4);});
it('keeps internal partitions through scale inference and project validation',()=>{const p=fixture();p.analysis!.lines.push(line('partition',300,300,700,300,5));const result=buildAutomaticVenue(p).project;expect(result?.walls).toHaveLength(5);expect(result?.walls.at(-1)?.role).toBe('partition');expect(result?.planReference?.mmPerPixel).toBe(10);expect(parseProject(result).walls.at(-1)?.start).toEqual({x:3000,z:3000});});
it('keeps whole-span dimension evidence after splitting room junctions',()=>{const p=fixture();p.analysis!.lines.push(line('divider',500,100,500,700,5));const result=buildAutomaticVenue(p).project;expect(result?.planReference?.mmPerPixel).toBe(10);expect(result?.walls.filter(w=>w.role==='boundary')).toHaveLength(6);expect(result?.walls.filter(w=>w.role==='partition')).toHaveLength(1);expect(parseProject(result).walls).toHaveLength(7);});
it('restores a labelled door gap without turning it into an installation wall',()=>{const p=fixture();p.analysis!.lines=p.analysis!.lines.filter(l=>l.id!=='c');p.analysis!.lines.push(line('left-bottom',100,700,450,700,5),line('right-bottom',550,700,900,700,5));p.labels!.push(...detectPlanLabels([{text:'Door',source:'pdf-text',box:{x:470,y:710,width:60,height:20}}]).map(l=>({...l,id:'door-evidence'})));const result=buildAutomaticVenue(p).project;expect(result?.openings).toHaveLength(1);expect(result?.walls).toHaveLength(5);expect(parseProject(result).openings![0].kind).toBe('door');});
it('withholds unlabelled and low-confidence gaps rather than inventing a door',()=>{const p=fixture();p.analysis!.lines=p.analysis!.lines.filter(l=>l.id!=='c');p.analysis!.lines.push(line('left-bottom',100,700,450,700,5),line('right-bottom',550,700,900,700,5));expect(buildAutomaticVenue(p).project).toBeUndefined();p.labels!.push(...detectPlanLabels([{text:'Door',source:'ocr',confidence:40,box:{x:470,y:710,width:60,height:20}}]));expect(buildAutomaticVenue(p).project).toBeUndefined();});
it('connects capped double wall edges through topology and scale inference',()=>{
 const p=fixture(),walls=p.analysis!.lines.slice(0,4),edges=[];
 for(const w of walls){
  const horizontal=w.start.y===w.end.y,lo=horizontal?Math.min(w.start.x,w.end.x):Math.min(w.start.y,w.end.y),hi=horizontal?Math.max(w.start.x,w.end.x):Math.max(w.start.y,w.end.y),center=horizontal?w.start.y:w.start.x;
  const make=(id:string,a:number,b:number,c:number,d:number)=>horizontal?line(id,a,b,c,d):line(id,b,a,d,c);
  edges.push(make(`${w.id}-edge1`,lo,center-10,hi,center-10),make(`${w.id}-edge2`,lo,center+10,hi,center+10),make(`${w.id}-cap1`,lo,center-10,lo,center+10),make(`${w.id}-cap2`,hi,center-10,hi,center+10));
 }
 p.analysis!.lines=[...edges,...p.analysis!.lines.slice(4)];const result=buildAutomaticVenue(p).project;expect(result?.walls).toHaveLength(4);expect(result?.planReference?.mmPerPixel).toBe(10);expect(parseProject(result).walls).toHaveLength(4);
});
it('uses an explicit page unit for bare numbers while preserving original text',()=>{const p=fixture();p.labels!.forEach(l=>{l.text=l.text.replace(' mm','');});p.labels!.push(...detectPlanLabels([{text:'All measurements in mm',source:'pdf-text',box:{x:20,y:750,width:200,height:20}}]).map(l=>({...l,id:'page-unit'})));const result=buildAutomaticVenue(p).project;expect(result?.planReference?.mmPerPixel).toBe(10);expect(result?.planLabels?.[0].text).toBe('8000');expect(parseProject(result)).toBeDefined();});
it('never uses conflicting orientation readings as scale evidence',()=>{const p=fixture();p.labels![0].numericConflict=true;expect(buildAutomaticVenue(p).project).toBeUndefined();});
it('automatically cross-checks complete and partial dimension chains',()=>{
 const p=fixture();p.labels![0].box={x:400,y:0,width:100,height:10};const d=p.analysis!.lines.find(l=>l.id==='dx')!;d.start.y=d.end.y=20;for(const id of ['wx1','wx2'])p.analysis!.lines.find(l=>l.id===id)!.start.y=10;
 p.analysis!.lines.push(line('part-left',100,70,500,70),line('part-right',500,70,900,70),line('mid-witness',500,60,500,105));
 p.labels!.push(...detectPlanLabels([{text:'4000 mm',source:'pdf-text',box:{x:250,y:45,width:100,height:10}},{text:'4000 mm',source:'pdf-text',box:{x:650,y:45,width:100,height:10}}]).map((l,i)=>({...l,id:`part-label-${i}`})));
 const result=buildAutomaticVenue(p);expect(result.project?.planReference?.mmPerPixel).toBe(10);expect(result.reasons.join(' ')).toContain('전체·부분 치수 합계 1건');
 p.labels!.at(-1)!.text='4500 mm';expect(buildAutomaticVenue(p).reasons.join(' ')).toContain('부분 치수 합계와 전체 치수');
});

it('removes interior stair treads from wall reconstruction while retaining source evidence',()=>{
 const p=fixture();
 p.labels!.push(...detectPlanLabels([{text:'Stairs',source:'pdf-text',box:{x:280,y:320,width:15,height:40}}]).map(l=>({...l,id:'stairs-label'})));
 for(let i=0;i<5;i++)p.analysis!.lines.push(line(`tread-${i}`,300+i*20,300,300+i*20,450,5));
 const before=structuredClone(p),walls=extractStructuralWalls(p);
 for(const x of [320,340,360])expect(walls.some(w=>w.start.x===x&&w.end.x===x)).toBe(false);
 for(const x of [300,380])expect(walls.some(w=>w.start.x===x&&w.end.x===x)).toBe(true);
 expect(p).toEqual(before);
});
it('builds the whole venue when an existing thin outline connects two thick walls',()=>{
 const p=fixture();p.analysis!.lines.find(l=>l.id==='c')!.thicknessPx=1.5;
 const result=buildAutomaticVenue(p).project;
 expect(result?.walls).toHaveLength(4);expect(result?.planReference?.mmPerPixel).toBe(10);
 expect(parseProject(result).walls).toHaveLength(4);
});
