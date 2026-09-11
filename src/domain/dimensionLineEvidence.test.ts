import {detectWallCandidates} from './wallCandidates';
import{it,expect}from'vitest';
import{createDemoProject}from'./model';
import{fitPlan}from'./plan';
import{detectPlanLabels}from'./planLabels';
import{matchDimensionLines}from'./dimensionLineEvidence';
import type{WallCandidate}from'./wallCandidates';
const p={...createDemoProject(),planReference:{...fitPlan(1000,800,{x:-5000,z:-4000},10000),calibrated:true}};
const label=detectPlanLabels([{text:'8000 mm',source:'pdf-text',box:{x:400,y:30,width:100,height:20}}])[0];
const line=(id:string,x:number,y:number,x2:number,y2:number):WallCandidate=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:1});
const lines=[line('dimension',100,60,900,60),line('left',100,50,100,105),line('right',900,50,900,105)];
it('matches a complete dimension line and two endpoint witnesses',()=>{expect(matchDimensionLines(p,label,lines).map(m=>m.wallId)).toEqual(['wall-a']);expect(matchDimensionLines(p,label,lines)[0].evidence).toHaveLength(3);});
it('does not equate proximity or a single witness with a dimension',()=>{expect(matchDimensionLines(p,label,lines.slice(0,2))).toEqual([]);expect(matchDimensionLines(p,label,[lines[0]])).toEqual([]);});
it('rejects partial dimensions and ambiguous or non-length text',()=>{expect(matchDimensionLines(p,label,[line('partial',100,60,500,60),...lines.slice(1)])).toEqual([]);for(const text of ['H=8000','T=200','3,200','3 x 2 m'])expect(matchDimensionLines(p,{...label,text},lines)).toEqual([]);});
it('requires calibrated aligned walls and supports reversed endpoints',()=>{expect(matchDimensionLines({...p,planReference:{...p.planReference,calibrated:false}},label,lines)).toEqual([]);const reversed={...p,walls:p.walls.map(w=>({...w,start:w.end,end:w.start}))};expect(matchDimensionLines(reversed,label,lines)).toHaveLength(1);});

it('connects thin raster lines through the actual stripe detector',()=>{
 const data=new Uint8ClampedArray(1000*800*4).fill(255);
 const paint=(x:number,y:number,w:number,h:number)=>{for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){const i=(row*1000+col)*4;data[i]=data[i+1]=data[i+2]=0;}};
 paint(100,100,801,3);paint(100,60,801,1);paint(100,50,1,60);paint(900,50,1,60);
 const detected=detectWallCandidates(data,1000,800,{threshold:155,minLengthPx:10,minThicknessPx:1});
 expect(matchDimensionLines(p,label,detected).map(m=>m.wallId)).toEqual(['wall-a']);
});
it('matches vertical dimension lines and witnesses',()=>{
 const vertical={...p,planReference:{...p.planReference,heightPx:1000},walls:[{...p.walls[0],start:{x:-4000,z:-3000},end:{x:-4000,z:5000}}]};
 const rotated=lines.map(l=>({...l,start:{x:l.start.y,y:l.start.x},end:{x:l.end.y,y:l.end.x}}));
 expect(matchDimensionLines(vertical,{...label,box:{x:30,y:400,width:20,height:100}},rotated)).toHaveLength(1);
});
it('joins only the label-sized interruption and retains original evidence',()=>{
 const pieces=[line('a',100,40,390,40),line('b',510,40,900,40),line('l',100,30,100,105),line('r',900,30,900,105)];
 const matches=matchDimensionLines(p,label,pieces);
 expect(matches).toHaveLength(1);expect(matches[0].evidence).toHaveLength(4);expect(matches[0].gap).toMatchObject({start:{x:390,y:40},end:{x:510,y:40}});
 expect(matchDimensionLines(p,label,pieces.slice(0,3))).toEqual([]);
});
it('rejects arbitrary gaps, staggered pieces and lines beside rather than through text',()=>{
 const witnesses=[line('l',100,20,100,105),line('r',900,20,900,105)];
 for(const [a,b] of [[line('a',100,40,300,40),line('b',600,40,900,40)],[line('a',100,40,390,40),line('b',510,45,900,45)],[line('a',100,60,390,60),line('b',510,60,900,60)]])expect(matchDimensionLines(p,label,[a,b,...witnesses])).toEqual([]);
});
it('joins a vertical label gap with reversed input endpoints',()=>{
 const vertical={...p,planReference:{...p.planReference,heightPx:1000},walls:[{...p.walls[0],start:{x:-4000,z:-3000},end:{x:-4000,z:5000}}]};
 const pieces=[line('a',40,390,40,100),line('b',40,900,40,510),line('l',30,100,105,100),line('r',30,900,105,900)];
 expect(matchDimensionLines(vertical,{...label,box:{x:30,y:400,width:20,height:100}},pieces)[0].gap).toBeDefined();
});
