import {expect,it} from 'vitest';
import {venueDimensions} from './venueDimensions';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
import type {PlanPage} from '../lib/planImport';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
it('connects measured wall chains across a detected opening in the application calculation',()=>{
 const walls=[wall('top',100,100,300,100),wall('bottom',101,500,400,500),wall('jamb-a',100,100,100,200),wall('jamb-b',101,400,101,500)];
 const labels=detectPlanLabels([{text:'2000 mm',source:'pdf-text',box:{x:175,y:65,width:50,height:15}},{text:'3000 mm',source:'pdf-text',box:{x:225,y:520,width:50,height:15}}]);
 const page:PlanPage={imageUrl:'',widthPx:600,heightPx:600,labels};
 const gap={kind:'window',wall:wall('gap',100,200,101,400)};
 const without=venueDimensions(page,walls,walls,[]),withGap=venueDimensions(page,walls,walls,[gap]);
 expect(without.solution.axes[0].status).toBe('underdetermined');
 expect(withGap.annotations.allMatches).toHaveLength(2);
 expect(withGap.solution.axes[0].status).toBe('determined');
 expect(withGap.solution.axes[0].coordinates.map(n=>n.mm)).toEqual([0,2000,3000]);
 expect(withGap.solution.axes[0].appliedEqualities).toEqual([{axis:'x',from:100,to:101,sourceId:'gap'}]);
 // Axis alignment supplies neither opening width nor the missing vertical scale.
 expect(withGap.openingDimensions).toEqual([]);
 expect(withGap.solution.status).toBe('underdetermined');
 expect(venueDimensions(page,walls,walls,[{kind:'door',wall:wall('corner',100,200,130,400)}]).solution.axes[0].status).toBe('underdetermined');
});
