import {it,expect} from 'vitest';
import {structureRegion} from './structureRegion';
import {detectPlanLabels} from './planLabels';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:10});
const room=[line('top',200,200,800,200),line('right',800,200,800,800),line('bottom',800,800,200,800),line('left',200,800,200,200)];
const labels=detectPlanLabels([{text:'6000mm',source:'pdf-text',box:{x:440,y:210,width:100,height:20}},{text:'6000mm',source:'pdf-text',box:{x:220,y:450,width:20,height:100}},{text:'6000mm',source:'pdf-text',box:{x:760,y:450,width:20,height:100}}]);
it('locates a dominant network while allowing small isolated logo strokes outside',()=>{
 const logo=[line('logo-a',100,50,150,50),line('logo-b',150,50,150,100)];
 expect(structureRegion([...room,...logo],labels,1000,1000)).toEqual({x:175,y:175,width:650,height:650});
});
it('withholds focusing when a second substantial network or recognized facility lies outside',()=>{
 expect(structureRegion([...room,line('second',850,100,850,500)],labels,1000,1000)).toBeUndefined();
 expect(structureRegion([...room,{...line('thin-second',850,100,850,500),thicknessPx:2}],labels,1000,1000)).toBeUndefined();
 const facility=detectPlanLabels([{text:'Fire Exit',source:'pdf-text',box:{x:850,y:400,width:70,height:20}}]);
 expect(structureRegion(room,[...labels,...facility],1000,1000)).toBeUndefined();
 expect(structureRegion(room,labels.slice(0,2),1000,1000)).toBeUndefined();
});
it('retains a large wing connected through a verified thin structural segment',()=>{
 const first=[line('a',100,100,500,100),line('b',500,100,500,500),line('c',500,500,100,500),line('d',100,500,100,100)];
 const second=[line('e',600,100,900,100),line('f',900,100,900,500),line('g',900,500,600,500),line('h',600,500,600,100)];
 const text=detectPlanLabels([{text:'4000mm',source:'pdf-text',box:{x:200,y:120,width:100,height:20}},{text:'4000mm',source:'pdf-text',box:{x:120,y:250,width:20,height:100}},{text:'3000mm',source:'pdf-text',box:{x:700,y:120,width:100,height:20}}]);
 expect(structureRegion([...first,...second],text,1000,1000)).toBeUndefined();
 expect(structureRegion([...first,...second,{...line('bridge',500,300,600,300),thicknessPx:2}],text,1000,1000)).toEqual({x:75,y:75,width:850,height:450});
});
