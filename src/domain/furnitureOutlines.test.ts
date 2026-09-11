import {extractStructuralWalls} from './automaticVenue';
import {it,expect} from 'vitest';
import {detectFurnitureOutlines} from './furnitureOutlines';
import {detectPlanLabels,validatePlanLabels} from './planLabels';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:5});
const lines=[line('left',100,50,100,250),line('right',150,50,150,250),line('top',100,50,150,50),line('shared',0,250,400,250)];
const labels=detectPlanLabels([{text:'Bar',source:'pdf-text',box:{x:115,y:110,width:15,height:60}}]);
it('separates a labelled counter outline while retaining its shared boundary wall',()=>{
 expect(validatePlanLabels(labels,500,500)[0].kind).toBe('furniture');
 expect(detectFurnitureOutlines(labels,lines)).toEqual([{labelId:labels[0].id,box:{x:100,y:50,width:50,height:200},lineIds:['left','right','top']}]);
});
it('does not remove unlabelled, incomplete, weakly read or ambiguous rectangles',()=>{
 expect(detectFurnitureOutlines([],lines)).toEqual([]);
 expect(detectFurnitureOutlines(labels,lines.slice(0,3))).toEqual([]);
 expect(detectFurnitureOutlines(labels,[...lines,line('crossing',0,180,300,180)])).toEqual([]);
 expect(detectFurnitureOutlines(labels.map(l=>({...l,source:'ocr',confidence:60})),lines)).toEqual([]);
 expect(detectFurnitureOutlines(labels,[...lines,line('alternate',102,50,102,250)])).toEqual([]);
 expect(detectPlanLabels([{text:'5 bar',source:'pdf-text',box:{x:0,y:0,width:30,height:10}}]).some(l=>l.kind==='furniture')).toBe(false);
});

it('keeps the room boundary after separating a counter attached to it',()=>{
 const input=[...lines,line('room-top',0,0,400,0),line('room-left',0,0,0,250),line('room-right',400,0,400,250)];
 const walls=extractStructuralWalls({imageUrl:'data:image/png;base64,AA==',widthPx:500,heightPx:500,labels,analysis:{lines:input,issues:[],numericCount:0,textState:'complete',lineState:'complete'}});
 expect(walls).toHaveLength(4);
 expect(walls.some(w=>w.start.z===250&&w.end.z===250&&Math.abs(w.end.x-w.start.x)===400)).toBe(true);
});
it('removes a glass table attached along a vertical wall while retaining the shared wall',()=>{
 const input=[line('shared-left',100,0,100,400),line('top',100,100,300,100),line('bottom',100,200,300,200),line('right',300,100,300,200)];
 const text=detectPlanLabels([{text:'Glass Table',source:'pdf-text',box:{x:150,y:140,width:100,height:20}}]);
 const result=detectFurnitureOutlines(text,input);
 expect(result).toHaveLength(1);
 expect(result[0].box).toEqual({x:100,y:100,width:200,height:100});
 expect(new Set(result[0].lineIds)).toEqual(new Set(['top','bottom','right']));
 expect(detectPlanLabels([{text:'Glass Table Room',source:'pdf-text',box:{x:0,y:0,width:100,height:20}}]).some(l=>l.kind==='furniture')).toBe(false);
});
