import {it,expect} from 'vitest';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
import {readOpeningDimensions} from './openingDimensions';
import {solveDimensionConstraints} from './dimensionConstraints';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
const walls=[wall('left',0,100,400,100),wall('right',500,100,900,100)];
const gap={kind:'door',wall:wall('door',400,100,500,100)};
const label=detectPlanLabels([{text:'960 mm',source:'pdf-text',box:{x:425,y:120,width:50,height:20}}]);
it('assigns a width only to a known gap and uses its actual endpoints as a dimension span',()=>{
 const m=readOpeningDimensions(walls,[gap],label);expect(m).toMatchObject([{wallId:'door',mm:960,from:400,to:500}]);
 const r=solveDimensionConstraints([...walls,gap.wall],m);const x=r.axes[0].coordinates;
 expect(x.find(n=>n.pixel===500)!.mm-x.find(n=>n.pixel===400)!.mm).toBe(960);
 expect(readOpeningDimensions(walls,[],label)).toEqual([]);
});
it('preserves conflicting width labels and withholds competition with a wall',()=>{
 const other={...label[0],id:'other',text:'1000 mm'};
 const m=readOpeningDimensions(walls,[gap],[...label,other]);expect(m).toHaveLength(2);
 expect(solveDimensionConstraints([...walls,gap.wall],m).status).toBe('conflict');
 expect(readOpeningDimensions([...walls,wall('competing',400,90,500,90)],[gap],label)).toEqual([]);
 expect(readOpeningDimensions(walls,[{...gap,kind:'stair-access'}],label)).toEqual([]);
});
