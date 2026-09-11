import {it,expect} from 'vitest';
import {createDemoProject,parseProject,deleteSelection,updateWall} from './model';
import {floorWithOpenings,openingSegments} from './openings';
import {deriveFloor} from './floor';
function project(){const p=createDemoProject();p.artworks=[];const top=p.walls[0];p.walls=[{...top,end:{x:-500,z:-3000}},{...top,id:'top-right',start:{x:500,z:-3000}},...p.walls.slice(1)];p.openings=[{id:'entry',kind:'door',role:'boundary',start:{wallId:top.id,endpoint:'end'},end:{wallId:'top-right',endpoint:'start'},note:'test'}];return p;}
it('uses the door gap only for floor closure and never as a wall',()=>{const p=project();expect(deriveFloor(p.walls).surfaces).toHaveLength(0);expect(floorWithOpenings(p).areaMm2).toBe(48000000);expect(p.walls.some(w=>w.id==='entry')).toBe(false);expect(parseProject(p).openings).toEqual(p.openings);});
it('follows edited anchors and cleans up after deleting an attached wall',()=>{const p=updateWall(project(),'top-right',{start:{x:800,z:-3000}});expect(openingSegments(p)[0].end.x).toBe(800);const next=deleteSelection(p,{type:'wall',id:'top-right'});expect(next.openings).toHaveLength(0);expect(parseProject(next)).toBeDefined();});
it('rejects dangling references, zero lengths and wall-ID collisions',()=>{for(const mutate of [(p:ReturnType<typeof project>)=>p.openings![0].start.wallId='missing',(p:ReturnType<typeof project>)=>p.openings![0].end={...p.openings![0].start},(p:ReturnType<typeof project>)=>p.openings![0].id=p.walls[0].id]){const p=project();mutate(p);expect(()=>parseProject(p)).toThrow();}});
it('does not allow artwork to be mounted on an opening',()=>{const p=project();p.artworks=[{...createDemoProject().artworks[0],wallId:'entry'}];expect(()=>parseProject(p)).toThrow('존재하지 않는 벽');});
it('rejects an edit collapsing an opening',()=>{expect(()=>updateWall(project(),'top-right',{start:{x:-500,z:-3000}})).toThrow('개구부 길이');});
function adjacent(){const p=project(),door=p.openings![0];p.openings=[{...door,end:{point:{x:0,z:-3000}}},{...door,id:'glass',kind:'window',start:{point:{x:0,z:-3000}},end:{wallId:'top-right',endpoint:'start'}}];return p;}
it('preserves a shared door/window junction without inventing an installation wall',()=>{
 const p=adjacent();expect(parseProject(p).openings).toEqual(p.openings);expect(floorWithOpenings(p).areaMm2).toBe(48000000);
 expect(openingSegments(p)).toHaveLength(2);expect(p.walls.some(w=>w.id==='glass')).toBe(false);
 const edited=updateWall(p,'top-right',{start:{x:900,z:-3000}});expect(openingSegments(edited)[1]).toMatchObject({start:{x:0,z:-3000},end:{x:900,z:-3000}});
 expect(deleteSelection(p,{type:'wall',id:'top-right'}).openings).toEqual([]);
});
it('rejects malformed, unshared, and detached opening junctions',()=>{
 for(const point of [{x:NaN,z:0},{x:Infinity,z:0},{x:1e8,z:0}]){const p=adjacent();p.openings![0].end={point};expect(()=>parseProject(p)).toThrow();}
 const p=adjacent();p.openings!.pop();expect(()=>parseProject(p)).toThrow('두 개구부');
 const detached=adjacent();detached.openings![0].start={point:{x:10,z:20}};detached.openings![1].end={point:{x:10,z:20}};expect(()=>parseProject(detached)).toThrow('벽에 연결');
});
