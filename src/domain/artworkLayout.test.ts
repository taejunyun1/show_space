import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {rotatedArtworkOuterSize} from './artworkPresentation';
import {layoutArtworks,type ArtworkLayout} from './artworkLayout';
const fixture=()=>{const p=createDemoProject();p.walls[0].end.x=p.walls[0].start.x+16000;p.walls[0].heightMm=9000;p.artworks=p.artworks.slice(0,3).map((a,i)=>({...a,frame:'none',widthMm:[200,400,600][i],heightMm:[200,500,600][i],alongMm:[1000,3000,6000][i],centerHeightMm:[500,1700,3000][i]}));return p;};
const ids=(p:ReturnType<typeof fixture>)=>p.artworks.map(a=>a.id);
const edges=(a:ReturnType<typeof fixture>['artworks'][number])=>{const s=rotatedArtworkOuterSize(a);return {left:a.alongMm-s.widthMm/2,right:a.alongMm+s.widthMm/2,bottom:a.centerHeightMm-s.heightMm/2,top:a.centerHeightMm+s.heightMm/2};};
it('aligns all six outer edges or centers without changing artwork design',()=>{
 const p=fixture();
 for(const [edge,property,expected] of [['left','left',900],['right','right',6300],['top','top',3300],['bottom','bottom',400],['center-x','alongMm',3600],['center-y','centerHeightMm',1850]] as const){
  const next=layoutArtworks(p,ids(p),{kind:'align',edge});expect(next.artworks.map(a=>property in a?a[property as 'alongMm'|'centerHeightMm']:edges(a)[property as keyof ReturnType<typeof edges>])).toEqual([expected,expected,expected]);
  next.artworks.forEach((a,i)=>expect({...a,alongMm:p.artworks[i].alongMm,centerHeightMm:p.artworks[i].centerHeightMm}).toEqual(p.artworks[i]));expect(parseProject(next)).toEqual(next);
 }
 expect(p.artworks.map(a=>a.alongMm)).toEqual([1000,3000,6000]);
});
it('uses frame, mat and rotated physical bounds with visual left/right on the back face',()=>{
 const p=fixture();p.artworks=p.artworks.slice(0,2).map(a=>({...a,wallSide:'back'}));
 expect(layoutArtworks(p,ids(p),{kind:'align',edge:'left'}).artworks.map(a=>a.alongMm)).toEqual([3100,3000]);
 expect(layoutArtworks(p,ids(p),{kind:'align',edge:'right'}).artworks.map(a=>a.alongMm)).toEqual([1000,1100]);
 const framed=fixture();framed.artworks[0]={...framed.artworks[0],frame:'natural',frameSettings:{widthMm:30,depthMm:70,matWidthMm:60,matColor:'#f5f4ef',material:'metal',cover:'glass'},rotationDeg:90};
 const next=layoutArtworks(framed,ids(framed),{kind:'align',edge:'bottom'});expect(next.artworks[0].centerHeightMm).toBe(500);expect(new Set(next.artworks.map(a=>edges(a).bottom)).size).toBe(1);
});
it('places ten works with exact 250mm frame-to-frame gaps, preserves order and centers the row',()=>{
 const p=fixture(),base=p.artworks[0];p.artworks=Array.from({length:10},(_,i)=>({...base,id:'row-'+i,widthMm:400,heightMm:500,frame:'natural',frameSettings:{widthMm:30,depthMm:70,matWidthMm:60,matColor:'#f5f4ef',material:'metal',cover:'glass'},alongMm:1000+i*950,centerHeightMm:1450}));
 const next=layoutArtworks(p,ids(p).reverse(),{kind:'spacing',axis:'horizontal',gapMm:250});
 for(let i=1;i<10;i++)expect(edges(next.artworks[i]).left-edges(next.artworks[i-1]).right).toBe(250);
 expect(next.artworks.map(a=>a.widthMm)).toEqual(Array(10).fill(400));expect(edges(next.artworks[0]).left).toBe(710);
 const centered=layoutArtworks(next,ids(p),{kind:'center-wall'});expect(edges(centered.artworks[0]).left).toBe(3975);expect(edges(centered.artworks.at(-1)!).right).toBe(12025);
 expect(centered.artworks.map(a=>a.centerHeightMm)).toEqual(Array(10).fill(1450));
});
it('distributes horizontal and vertical gaps within the selected bounds or a numeric gap',()=>{
 const p=fixture(),horizontal=layoutArtworks(p,ids(p),{kind:'spacing',axis:'horizontal'}),vertical=layoutArtworks(p,ids(p),{kind:'spacing',axis:'vertical'});
 expect(edges(horizontal.artworks[0]).left).toBe(900);expect(edges(horizontal.artworks[2]).right).toBe(6300);expect(horizontal.artworks.map(a=>a.alongMm)).toEqual([1000,3400,6000]);
 expect(vertical.artworks.map(a=>a.centerHeightMm)).toEqual([500,1650,3000]);expect(edges(vertical.artworks[1]).bottom-edges(vertical.artworks[0]).top).toBe(800);expect(edges(vertical.artworks[2]).bottom-edges(vertical.artworks[1]).top).toBe(800);
 expect(layoutArtworks(p,ids(p),{kind:'spacing',axis:'vertical',gapMm:250}).artworks.map(a=>a.centerHeightMm)).toEqual([1600,2200,3000]);
 expect(layoutArtworks(p,ids(p),{kind:'center-height',heightMm:1450}).artworks.map(a=>a.centerHeightMm)).toEqual([1450,1450,1450]);
});
it('rejects locked, missing, mixed, partial group, unscaled and out-of-wall layouts atomically',()=>{
 const p=fixture(),before=structuredClone(p);
 for(const bad of [{...p,artworks:p.artworks.map((a,i)=>i?a:{...a,locked:true})},{...p,artworks:p.artworks.map((a,i)=>i?a:{...a,wallId:'wall-b'})},{...p,artworks:p.artworks.map((a,i)=>i?a:{...a,wallSide:'back' as const})},{...p,planDraft:{kind:'partial' as const,sourceEvidenceHash:'00000000',originalWalls:p.walls}}])expect(()=>layoutArtworks(bad,ids(p),{kind:'align',edge:'top'})).toThrow();
 const grouped={...p,artworks:p.artworks.map(a=>({...a,groupId:'g'}))};expect(()=>layoutArtworks(grouped,ids(p).slice(0,2),{kind:'align',edge:'top'})).toThrow('그룹');expect(layoutArtworks(grouped,ids(p),{kind:'align',edge:'top'}).artworks.every(a=>a.groupId==='g')).toBe(true);
 expect(()=>layoutArtworks(p,['missing','artwork-1'],{kind:'center-wall'})).toThrow();
 for(const gap of [-1,-0.00000001,NaN,Infinity,100000])expect(()=>layoutArtworks(p,ids(p),{kind:'spacing',axis:'horizontal',gapMm:gap})).toThrow();
 expect(()=>layoutArtworks(p,ids(p),{kind:'center-height',heightMm:50})).toThrow('벽');expect(()=>layoutArtworks(p,ids(p),{kind:'align',edge:'bad'} as unknown as ArtworkLayout)).toThrow();
 const overlapping={...p,artworks:p.artworks.map(a=>({...a,alongMm:1000}))};expect(()=>layoutArtworks(overlapping,ids(p),{kind:'spacing',axis:'horizontal'})).toThrow('공간');expect(p).toEqual(before);
});
it('returns the same project for a no-op and leaves unselected artworks untouched',()=>{
 const p=fixture(),next=layoutArtworks(p,ids(p),{kind:'align',edge:'top'});expect(layoutArtworks(next,ids(p),{kind:'align',edge:'top'})).toBe(next);
 const partial=layoutArtworks(p,ids(p).slice(0,2),{kind:'align',edge:'top'});expect(partial.artworks[2]).toBe(p.artworks[2]);
});
