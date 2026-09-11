import {it,expect} from 'vitest';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
import {readMeasuredSpans,matchDimensionSpans,checkDimensionSums,type MeasuredSpan} from './dimensionSpans';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:1});
function fixture(){const p=createDemoProject();p.planReference={origin:{x:0,z:0},widthPx:1000,heightPx:800,mmPerPixel:1,calibrated:true};p.walls=[{...p.walls[0],id:'left',start:{x:100,z:100},end:{x:500,z:100}},{...p.walls[0],id:'right',start:{x:500,z:100},end:{x:900,z:100}}];const label=detectPlanLabels([{text:'8000 mm',source:'pdf-text',box:{x:400,y:30,width:100,height:20}}])[0];const lines=[line('d',100,60,900,60),line('a',100,50,100,105),line('b',900,50,900,105)];return {p,label,lines};}
it('connects a whole dimension over adjacent wall segments',()=>{const {p,label,lines}=fixture();expect(matchDimensionSpans(p,label,lines)).toMatchObject([{from:100,to:900,wallIds:['left','right']}]);});
it('accepts a partial dimension whose endpoints have witness lines',()=>{const {p,label}=fixture();label.box={x:220,y:30,width:60,height:20};label.text='3000 mm';expect(matchDimensionSpans(p,label,[line('d',100,60,400,60),line('a',100,50,100,105),line('b',400,50,400,105)])).toMatchObject([{from:100,to:400,wallIds:['left']}]);});
it('does not join missing wall intervals or infer dimensions from nearby text alone',()=>{const {p,label,lines}=fixture();p.walls[1].start.x=550;expect(matchDimensionSpans(p,label,lines)).toEqual([]);expect(matchDimensionSpans(fixture().p,label,[lines[0]])).toEqual([]);});
it('checks additive parts without double counting overlapping dimensions',()=>{const span=(id:string,from:number,to:number,mm:number):MeasuredSpan=>({id,labelId:id,from,to,mm,cross:100,horizontal:true,wallIds:['wall']});const a=[span('total',100,900,8000),span('part1',100,400,3000),span('part2',400,900,5000)];expect(checkDimensionSums(a)).toEqual({checked:1,conflict:false});a[2].mm=6000;expect(checkDimensionSums(a).conflict).toBe(true);a.push(span('overlap',100,600,5000));expect(checkDimensionSums(a).checked).toBe(0);});

it('collects only supported single-valued dimensions with reliable units and readings',()=>{
 const {p,label,lines}=fixture();
 expect(readMeasuredSpans(p,[label],lines)).toMatchObject([{mm:8000,from:100,to:900,labelId:label.id}]);
 for(const patch of [{text:'8000'},{numericConflict:true},{source:'ocr' as const,confidence:89},{text:'HEIGHT 8000 mm'}])expect(readMeasuredSpans(p,[{...label,...patch}],lines)).toEqual([]);
 const unit=detectPlanLabels([{text:'All measurements in cm',source:'pdf-text',box:{x:0,y:0,width:100,height:20}}])[0];
 expect(readMeasuredSpans(p,[unit,{...label,text:'800'}],lines)[0].mm).toBe(8000);
 expect(readMeasuredSpans(p,[label],[lines[0]])).toEqual([]);
});
