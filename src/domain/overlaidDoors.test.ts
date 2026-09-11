import {floorWithOpenings} from './openings';
import {anchorOpeningPoint} from './openingAnchors';
import {it,expect} from 'vitest';
import {detectOverlaidDoors,applyOverlaidDoors} from './overlaidDoors';
import {createDemoProject} from './model';
const lines=[{id:'band',start:{x:100,y:100},end:{x:100,y:240},thicknessPx:30},{id:'leaf',start:{x:85,y:234},end:{x:250,y:234},thicknessPx:7},{id:'brace',start:{x:115,y:155},end:{x:180,y:234},thicknessPx:2}];
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
it('recognizes both orientations and reversed source strokes',()=>{
 expect(detectOverlaidDoors(lines)).toHaveLength(1);
 expect(detectOverlaidDoors(lines.map(l=>({...l,start:l.end,end:l.start})))).toHaveLength(1);
 expect(detectOverlaidDoors(lines.map(l=>({...l,start:{x:l.start.y,y:l.start.x},end:{x:l.end.y,y:l.end.x}})))).toHaveLength(1);
});
it('requires all three independent symbol strokes and rejects repeated brace evidence',()=>{
 for(let i=0;i<3;i++)expect(detectOverlaidDoors(lines.filter((_,j)=>j!==i))).toEqual([]);
 expect(detectOverlaidDoors([...lines,{...lines[2],id:'other'}])).toEqual([]);
 expect(detectOverlaidDoors(lines.map(l=>l.id==='band'?{...l,thicknessPx:3}:l))).toEqual([]);
});
it('cuts the covered interval and removes the leaf while preserving both wall spans',()=>{
 const doors=detectOverlaidDoors(lines),original=[wall('wall',100,0,100,400),wall('leaf',85,234,250,234)];
 const r=applyOverlaidDoors(original,doors);expect(r.gaps).toHaveLength(1);expect(r.walls).toHaveLength(2);
 expect(r.walls.map(w=>[w.start.z,w.end.z])).toEqual([[0,100],[240,400]]);expect(original).toHaveLength(2);
 const boundaries=[...r.walls,wall('top',100,0,400,0),wall('right',400,0,400,400),wall('bottom',100,400,400,400)];
 const openings=r.gaps.map(g=>({id:g.wall.id,kind:g.kind,role:'boundary' as const,note:g.wall.note,start:anchorOpeningPoint(g.wall.start,boundaries,r.gaps)!,end:anchorOpeningPoint(g.wall.end,boundaries,r.gaps)!}));
 expect(floorWithOpenings({walls:boundaries,openings}).areaMm2).toBe(120000);
});
it('vetoes parallel boundaries, interior branches, and a mark without wall support',()=>{
 const doors=detectOverlaidDoors(lines),base=wall('wall',100,0,100,400);
 expect(applyOverlaidDoors([base,wall('parallel',115,0,115,400)],doors).gaps).toEqual([]);
 expect(applyOverlaidDoors([base,wall('branch',100,180,200,180)],doors).gaps).toEqual([]);
 expect(applyOverlaidDoors([base,wall('crossing',0,180,200,180)],doors).gaps).toEqual([]);
 expect(applyOverlaidDoors([],doors).gaps).toEqual([]);
});
it('marks symbols without OCR confidence, deduplicates and respects dismissal during resolution',async()=>{
 const {mergeDoorSymbols}=await import('./overlaidDoors'),{resolvePlanOpenings}=await import('./planOpenings');
 const doors=detectOverlaidDoors(lines),labels=mergeDoorSymbols([],doors);
 expect(labels).toHaveLength(1);expect(labels[0]).toMatchObject({kind:'door',source:'symbol'});expect(labels[0].confidence).toBeUndefined();expect(mergeDoorSymbols(labels,doors)).toEqual(labels);
 const base=[wall('wall',100,0,100,400),wall('leaf',85,234,250,234)];
 expect(resolvePlanOpenings(base,labels,200,[],lines,doors).gaps).toHaveLength(1);
 const dismissed=labels.map(l=>({...l,status:'dismissed' as const}));expect(mergeDoorSymbols(dismissed,doors)).toEqual(dismissed);expect(resolvePlanOpenings(base,dismissed,200,[],lines,doors).gaps).toEqual([]);
});
