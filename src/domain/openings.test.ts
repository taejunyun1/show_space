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
