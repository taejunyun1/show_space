import {resolvePlanOpenings} from './planOpenings';
import {it,expect} from 'vitest';
import {detectFramedWindows} from './framedWindows';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
const walls=[wall('left',0,100,100,100),wall('right',200,100,300,100),wall('cap-a',100,100,100,115),wall('frame',100,115,200,115),wall('cap-b',200,115,200,100)];
const labels=detectPlanLabels([{text:'Window',source:'pdf-text',box:{x:130,y:130,width:40,height:20}}]);
it('requires a confident window label and a complete unbranched frame',()=>{
 expect(detectFramedWindows(walls,labels,300)).toHaveLength(1);
 expect(detectFramedWindows(walls,[],300)).toEqual([]);
 expect(detectFramedWindows(walls,labels.map(l=>({...l,source:'ocr',confidence:60})),300)).toEqual([]);
 expect(detectFramedWindows(walls.slice(0,-1),labels,300)).toEqual([]);
 expect(detectFramedWindows([...walls,wall('branch',100,115,60,170)],labels,300)).toEqual([]);
 expect(detectFramedWindows([...walls,wall('crossing',150,90,150,170)],labels,300)).toEqual([]);
});
it('does not treat duplicate labels or a deep alcove as a window frame',()=>{
 expect(detectFramedWindows(walls,[...labels,...labels.map(l=>({...l,id:'duplicate'}))],300)).toEqual([]);
 const deep=walls.map(w=>({...w,start:{...w.start,z:w.start.z===115?180:w.start.z},end:{...w.end,z:w.end.z===115?180:w.end.z}}));
 expect(detectFramedWindows(deep,labels,300)).toEqual([]);
});

it('allows a two-pixel raster alignment difference but rejects a displaced boundary',()=>{
 const shifted=walls.map(w=>w.id==='right'?{...w,start:{...w.start,z:101},end:{...w.end,z:101}}:w.id==='cap-b'?{...w,end:{...w.end,z:101}}:w);
 expect(detectFramedWindows(shifted,labels,300)).toHaveLength(1);
 const displaced=walls.map(w=>w.id==='right'?{...w,start:{...w.start,z:108},end:{...w.end,z:108}}:w.id==='cap-b'?{...w,end:{...w.end,z:108}}:w);
 expect(detectFramedWindows(displaced,labels,300)).toEqual([]);
});

it('resolves a visible frame and an unframed gap to the same anchored window',()=>{
 const near=labels.map(l=>({...l,box:{...l.box,y:110}}));
 const framed=resolvePlanOpenings(walls,near,300),gap=resolvePlanOpenings(walls.slice(0,2),near,300);
 expect(framed.gaps).toHaveLength(1);expect(gap.gaps).toHaveLength(1);
 expect(framed.gaps[0].wall.start).toEqual(gap.gaps[0].wall.start);
 expect(framed.gaps[0].wall.end).toEqual(gap.gaps[0].wall.end);
 expect(framed.structure).toEqual(gap.structure);expect(framed.gaps[0].kind).toBe(gap.gaps[0].kind);
});
