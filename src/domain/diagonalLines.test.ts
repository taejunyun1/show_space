import {buildAutomaticVenue} from './automaticVenue';
import {detectPlanLabels} from './planLabels';
import {it,expect} from 'vitest';
import {detectWallCandidates} from './wallCandidates';
function raster(segments:{a:[number,number];b:[number,number];thickness:number}[]){
 const width=240,height=240,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const {a,b,thickness} of segments){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const px=x+.5-a[0],py=y+.5-a[1],along=(px*dx+py*dy)/length,across=Math.abs(px*dy-py*dx)/length;
   if(along>=0&&along<=length&&across<=thickness/2){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
  }
 }
 return detectWallCandidates(data,width,height,{minLengthPx:11,minThicknessPx:1,maxCandidates:500});
}
it('detects non-axis walls at arbitrary positive and negative angles from raster pixels',()=>{
 for(const degrees of [7,17,35,45,63,80,-35,-80]){
  const angle=degrees*Math.PI/180,a:[number,number]=[120-90*Math.cos(angle),120-90*Math.sin(angle)],b:[number,number]=[120+90*Math.cos(angle),120+90*Math.sin(angle)];
  const detected=raster([{a,b,thickness:5}]).filter(l=>l.id.startsWith('diagonal:'));
  expect(detected,`angle ${degrees}`).toHaveLength(1);
  const line=detected[0];expect(Math.hypot(line.start.x-a[0],line.start.y-a[1])).toBeLessThan(3);expect(Math.hypot(line.end.x-b[0],line.end.y-b[1])).toBeLessThan(3);
  expect(line.thicknessPx).toBeGreaterThan(4);
 }
});
it('keeps an actual opening between diagonal segments',()=>{
 const lines=raster([{a:[20,20],b:[90,90],thickness:4},{a:[110,110],b:[200,200],thickness:4}]).filter(l=>l.id.startsWith('diagonal:'));
 expect(lines).toHaveLength(2);expect(lines.every(l=>Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)<130)).toBe(true);
});
it('rejects bent ink and preserves connected axis wall detection',()=>{
 expect(raster([{a:[20,20],b:[110,110],thickness:4},{a:[110,110],b:[200,40],thickness:4}]).filter(l=>l.id.startsWith('diagonal:'))).toEqual([]);
 const lines=raster([{a:[20,20],b:[100,20],thickness:5},{a:[100,20],b:[200,120],thickness:5}]);
 expect(lines.some(l=>l.id.startsWith('diagonal:'))).toBe(true);expect(lines.some(l=>l.start.y===l.end.y&&Math.abs(l.start.y-20)<2)).toBe(true);
});
it('connects raster diagonal walls to a scaled closed venue with independent dimension evidence',()=>{
 const lines=raster([
  {a:[20,20],b:[200,20],thickness:5},{a:[200,20],b:[160,200],thickness:5},
  {a:[160,200],b:[20,200],thickness:5},{a:[20,200],b:[20,20],thickness:5},
 ]);
 const witness=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:1});
 lines.push(witness('dx',20,8,200,8),witness('wx1',20,3,20,22),witness('wx2',200,3,200,22),witness('dy',8,20,8,200),witness('wy1',3,20,22,20),witness('wy2',3,200,22,200));
 const result=buildAutomaticVenue({imageUrl:'data:image/png;base64,AA==',widthPx:240,heightPx:240,labels:detectPlanLabels([{text:'1800 mm',source:'pdf-text',box:{x:90,y:0,width:40,height:5}},{text:'1800 mm',source:'pdf-text',box:{x:0,y:90,width:5,height:40}}]),analysis:{lines,issues:[],numericCount:2,textState:'complete',lineState:'complete'}});
 expect(result.project?.walls).toHaveLength(4);expect(result.project?.planReference?.mmPerPixel).toBeCloseTo(10,0);
});
