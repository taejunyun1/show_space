import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {rotatedArtworkOuterSize} from './artworkPresentation';
import {applyArtworkSeries,planArtworkSeries,type ArtworkSeriesOptions} from './artworkSeries';
import type {UnplacedArtwork} from './types';
export function seriesFixture(){
 const p=createDemoProject();p.walls[0].end={x:p.walls[0].start.x+12000,z:p.walls[0].start.z};p.walls[0].heightMm=4500;
 const works=Array.from({length:7},(_,i)=>({...p.artworks[0],id:`series-${i}`,name:`원본 ${i+1}`,frame:'none' as const,widthMm:400,heightMm:600,alongMm:800+i*800,centerHeightMm:1500}));
 p.artworks=works.slice(0,4);p.unplacedArtworks=works.slice(4).map(({wallId:_,...a})=>a);p.scenes=[];return p;
}
export function seriesOptions(p=seriesFixture()):ArtworkSeriesOptions{return {artworkIds:[...p.artworks,...p.unplacedArtworks??[]].map(a=>a.id),count:7,wallId:p.walls[0].id,wallSide:'front',axis:'horizontal',gapMm:250,centerHeightMm:1500,group:true};}
it('places seven existing works including unplaced works with exact 250mm gaps and centered bounds',()=>{
 const p=seriesFixture(),before=structuredClone(p),o=seriesOptions(p),preview=planArtworkSeries(p,o);
 expect(preview.widthMm).toBe(4300);expect(preview.heightMm).toBe(600);expect(preview.items.map(i=>i.artwork.alongMm)).toEqual([4050,4700,5350,6000,6650,7300,7950]);expect(p).toEqual(before);
 const next=applyArtworkSeries(p,o);expect(next.artworks).toHaveLength(7);expect(next.unplacedArtworks).toEqual([]);expect(new Set(next.artworks.map(a=>a.groupId)).size).toBe(1);expect(next.artworks[0].groupId).toBeTruthy();expect(parseProject(next)).toEqual(next);
 const original=[...p.artworks,...p.unplacedArtworks??[]];next.artworks.forEach(a=>{const source=original.find(s=>s.id===a.id)!;expect(a.imageUrl).toBe(source.imageUrl);expect([a.widthMm,a.heightMm,a.depthMm,a.name,a.artist,a.note,a.frame,a.rotationDeg]).toEqual([source.widthMm,source.heightMm,source.depthMm,source.name,source.artist,source.note,source.frame,source.rotationDeg]);});
 expect(applyArtworkSeries(next,o)).toBe(next);
});
it('uses the requested order and count with visual left-to-right placement on the back face',()=>{
 const p=seriesFixture(),o={...seriesOptions(p),artworkIds:['series-4','series-1','series-0','series-5'],count:3,wallSide:'back' as const,group:false},next=applyArtworkSeries(p,o);
 expect(o.artworkIds.slice(0,3).map(id=>next.artworks.find(a=>a.id===id)!.alongMm)).toEqual([6650,6000,5350]);expect(next.unplacedArtworks?.map(a=>a.id)).toEqual(['series-5','series-6']);expect(next.artworks.find(a=>a.id==='series-2')).toBe(p.artworks[2]);expect(next.artworks.find(a=>a.id==='series-3')).toBe(p.artworks[3]);expect(next.artworks.every(a=>!a.groupId)).toBe(true);
});
it('calculates variable rotated frame/mat bounds and top-to-bottom vertical spacing',()=>{
 const p=seriesFixture();p.artworks=p.artworks.slice(0,3).map((a,i)=>({...a,frame:'natural',frameSettings:{widthMm:10,matWidthMm:20,depthMm:40,material:'wood',matColor:'#ffffff',cover:'none'},rotationDeg:i===0?90:0}));p.unplacedArtworks=[];
 const o={...seriesOptions(p),count:3,axis:'vertical' as const,centerHeightMm:2250,group:false},preview=planArtworkSeries(p,o),next=applyArtworkSeries(p,o);
 expect(preview.widthMm).toBe(660);expect(preview.heightMm).toBe(2280);expect(next.artworks.map(a=>a.centerHeightMm)).toEqual([3160,2350,1440]);expect(next.artworks.map(a=>a.alongMm)).toEqual([6000,6000,6000]);
 for(let i=1;i<next.artworks.length;i++){const a=next.artworks[i-1],b=next.artworks[i];expect(a.centerHeightMm-rotatedArtworkOuterSize(a).heightMm/2-(b.centerHeightMm+rotatedArtworkOuterSize(b).heightMm/2)).toBe(250);}
 next.artworks.forEach((a,i)=>expect([a.frameSettings,a.rotationDeg]).toEqual([p.artworks[i].frameSettings,p.artworks[i].rotationDeg]));
});
it('rejects invalid counts, missing/duplicate works, invalid numbers and wall overflow before changing the project',()=>{
 const p=seriesFixture(),before=structuredClone(p),o=seriesOptions(p);
 for(const count of [0,1,2.5,8,NaN,Infinity])expect(()=>applyArtworkSeries(p,{...o,count})).toThrow();
 for(const gapMm of [-1,NaN,Infinity])expect(()=>applyArtworkSeries(p,{...o,gapMm})).toThrow();
 for(const centerHeightMm of [0,4500,NaN,Infinity])expect(()=>applyArtworkSeries(p,{...o,centerHeightMm})).toThrow();
 expect(()=>applyArtworkSeries(p,{...o,artworkIds:['series-0','series-0'],count:2})).toThrow();expect(()=>applyArtworkSeries(p,{...o,artworkIds:['series-0','missing'],count:2})).toThrow();
 expect(()=>applyArtworkSeries(p,{...o,wallId:'missing'})).toThrow();expect(()=>applyArtworkSeries(p,{...o,gapMm:3000})).toThrow(/벽/);expect(()=>applyArtworkSeries(p,{...o,axis:'bad' as 'horizontal'})).toThrow();expect(()=>applyArtworkSeries(p,{...o,wallSide:'bad' as 'front'})).toThrow();expect(p).toEqual(before);
});
it('preserves complete groups while rejecting partial, locked, hidden and unscaled selections',()=>{
 const p=seriesFixture();p.artworks=p.artworks.map(a=>({...a,groupId:'existing-series'}));const o={...seriesOptions(p),artworkIds:p.artworks.map(a=>a.id),count:4,group:false},next=applyArtworkSeries(p,o);
 expect(next.artworks.every(a=>a.groupId==='existing-series')).toBe(true);expect(()=>applyArtworkSeries(p,{...o,count:3})).toThrow(/그룹/);
 for(const patch of [{locked:true},{visible:false}]){const bad={...p,artworks:p.artworks.map((a,i)=>i?a:{...a,...patch})};expect(()=>applyArtworkSeries(bad,o)).toThrow();}
 const unplaced={...p,unplacedArtworks:p.unplacedArtworks!.map((a,i)=>i?a:{...a,locked:true}) as UnplacedArtwork[]};expect(()=>applyArtworkSeries(unplaced,seriesOptions(unplaced))).toThrow(/잠긴/);
 expect(()=>applyArtworkSeries({...p,planDraft:{kind:'partial',sourceEvidenceHash:'00000000',originalWalls:p.walls}},o)).toThrow(/축척/);
});
it('reports occupied outer bounds on the same face without moving unselected works',()=>{
 const p=seriesFixture();p.artworks[2]={...p.artworks[2],alongMm:5700};p.artworks[3]={...p.artworks[3],alongMm:5700,wallSide:'back'};
 const o={...seriesOptions(p),count:2,group:false},preview=planArtworkSeries(p,o),next=applyArtworkSeries(p,o);
 expect(preview.overlapping.map(a=>a.id)).toEqual(['series-2']);expect(preview.occupied.map(a=>a.id)).toEqual(['series-2']);expect(next.artworks[2]).toBe(p.artworks[2]);expect(next.artworks[3]).toBe(p.artworks[3]);
});
