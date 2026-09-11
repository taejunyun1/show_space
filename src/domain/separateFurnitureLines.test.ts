import {expect,it} from 'vitest';
import {separateFurnitureLines} from './separateFurnitureLines';
import {detectPlanLabels} from './planLabels';
const line=(id:string,x:number,y:number,x2:number,y2:number,thicknessPx=2)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx});
const labels=detectPlanLabels([{text:'Glass Table',source:'pdf-text',box:{x:150,y:140,width:100,height:20}}]);
const fixture=[line('wall',90,0,90,202,20),line('left',100,100,100,200),line('right',300,100,300,200),line('top',80,100,300,100),line('bottom',40,200,300,200)];
it('cuts only furniture portions supported by the adjoining thick wall',()=>{
 const result=separateFurnitureLines(labels,fixture);
 expect(result).toEqual([fixture[0],{...fixture[3],end:{x:90,y:100}},{...fixture[4],end:{x:90,y:200}}]);
 expect(fixture[3].end.x).toBe(300);
});
it('preserves a through-wall, unsupported extensions and competing supports',()=>{
 const through=fixture.map(l=>l.id==='bottom'?{...l,end:{x:400,y:200}}:l);
 expect(separateFurnitureLines(labels,through).find(l=>l.id==='bottom')).toEqual(through[4]);
 for(const input of [fixture.slice(1),[...fixture,line('other-wall',91,0,91,202,20)],fixture.map(l=>l.id==='wall'?{...l,thicknessPx:2}:l),fixture.map(l=>l.id==='top'?{...l,thicknessPx:20}:l)]){
  expect(separateFurnitureLines(labels,input).find(l=>l.id==='top')?.end.x).toBe(300);
 }
});
it('handles transposed and reversed drawings with the same supported cuts',()=>{
 const input=fixture.map(l=>({...l,start:{x:l.end.y,y:l.end.x},end:{x:l.start.y,y:l.start.x}}));
 const text=labels.map(l=>({...l,box:{x:l.box.y,y:l.box.x,width:l.box.height,height:l.box.width}}));
 const result=separateFurnitureLines(text,input);
 expect(result.find(l=>l.id==='top')).toMatchObject({start:{x:100,y:90},end:{x:100,y:80}});
 expect(result.find(l=>l.id==='wall')).toEqual(input[0]);
});
