import {detectPlanLabels} from './planLabels';
import {it,expect} from 'vitest';
import {detectTextPanels} from './textPanels';
const text=[{x:110,y:105,width:100,height:20}];
const image=()=>new Uint8ClampedArray(500*500*4).fill(255);
function fill(data:Uint8ClampedArray,x:number,y:number,w:number,h:number,color:number[]){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)data.set([...color,255],(j*500+i)*4);}
it('finds a compact detached color caption supported by native text',()=>{
 const data=image();fill(data,100,100,120,35,[0,0,100]);
 expect(detectTextPanels(data,500,500,text)).toEqual([{x:98,y:98,width:124,height:39}]);
 expect(detectTextPanels(data,500,500,[])).toEqual([]);
 const column=detectPlanLabels([{text:'Column',box:text[0],source:'pdf-text'}]);
 expect(detectTextPanels(data,500,500,text,column)).toEqual([]);
});
it('keeps room fills, pale furniture and attached color bands',()=>{
 const room=image();fill(room,100,100,200,200,[0,0,100]);expect(detectTextPanels(room,500,500,text)).toEqual([]);
 const furniture=image();fill(furniture,100,100,120,35,[255,255,180]);expect(detectTextPanels(furniture,500,500,text)).toEqual([]);
 const attached=image();fill(attached,100,100,120,35,[0,0,100]);fill(attached,90,90,7,50,[0,0,0]);expect(detectTextPanels(attached,500,500,text)).toEqual([]);
});
it('allows antialiased lettering but rejects mixed-color image content',()=>{
 const caption=image();fill(caption,100,100,120,35,[0,0,128]);fill(caption,110,105,100,7,[120,120,190]);
 expect(detectTextPanels(caption,500,500,text)).toHaveLength(1);
 const mixed=image();fill(mixed,100,100,120,35,[0,0,128]);fill(mixed,100,100,60,35,[0,128,0]);
 expect(detectTextPanels(mixed,500,500,text)).toEqual([]);
});
it('removes panel-contained structure while keeping a wall crossing the panel',async()=>{
 const {extractStructuralWalls}=await import('./automaticVenue');
 const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:8});
 const lines=[line('a',0,0,400,0),line('b',400,0,400,400),line('c',400,400,0,400),line('d',0,400,0,0),line('panel-top',150,150,250,150),line('panel-right',250,150,250,190),line('panel-bottom',250,190,150,190),line('panel-left',150,190,150,150),line('through',0,170,400,170)];
 const walls=extractStructuralWalls({imageUrl:'',widthPx:500,heightPx:500,textPanels:[{x:148,y:148,width:104,height:44}],analysis:{lines,issues:[],numericCount:0,textState:'complete',lineState:'complete'}});
 expect(walls).toHaveLength(5);
 expect(walls.some(w=>w.start.z===170&&w.end.z===170&&Math.abs(w.end.x-w.start.x)===400)).toBe(true);
});
