import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {snapArtworkPlacement} from './artworkSnap';
const fixture=()=>{const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,frame:'none',widthMm:i?400:200,heightMm:i?400:200,alongMm:i?2000:1000,centerHeightMm:i?1500:1000}));return p;};
const options={toleranceMm:{alongMm:12,centerHeightMm:12}};
it('snaps outer edge and center independently while preserving exact non-grid positions',()=>{
 const p=fixture(),r=snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1694,centerHeightMm:1496},options);
 expect(r.placement).toEqual({alongMm:1700,centerHeightMm:1500});expect(r.guides.map(g=>[g.axis,g.atMm,g.kind])).toEqual([['along',1800,'edge'],['height',1500,'center']]);expect(p.artworks[0].alongMm).toBe(1000);
 p.artworks[1].alongMm=2003.5;expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1999,centerHeightMm:1504},options).placement.alongMm).toBe(2003.5);
});
it('uses frame, mat and rotation instead of artwork body bounds',()=>{
 const p=fixture();p.artworks[0]={...p.artworks[0],heightMm:400,frame:'natural',frameSettings:{widthMm:30,depthMm:70,matWidthMm:60,matColor:'#ffffff',material:'metal',cover:'glass'},rotationDeg:90};
 expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1504,centerHeightMm:1000},options).placement.alongMm).toBe(1510);
});
it('moves the full group rigidly and excludes its own members from targets',()=>{
 const p=fixture();p.artworks[0].groupId='g';p.artworks.push({...p.artworks[0],id:'group-other',alongMm:1300});
 const r=snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1394,centerHeightMm:1000},options);expect(r.placement.alongMm).toBe(1400);expect(r.guides[0].targetId).toBe('artwork-2');
 p.artworks=p.artworks.filter(a=>a.id!=='artwork-2');expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1144,centerHeightMm:1224},options).guides).toEqual([]);
 expect(()=>snapArtworkPlacement({...p,artworks:p.artworks.map(a=>({...a,widthMm:9000}))},'artwork-1','wall-a','front',{alongMm:1000,centerHeightMm:1000},options)).toThrow('벽');
});
it('ignores hidden, opposite-face and other-wall targets but allows stationary locked targets',()=>{
 const p=fixture();for(const patch of [{visible:false},{wallSide:'back' as const},{wallId:'wall-b'}]){const q={...p,artworks:p.artworks.map((a,i)=>i?{...a,...patch}:a)};expect(snapArtworkPlacement(q,'artwork-1','wall-a','front',{alongMm:1694,centerHeightMm:1496},options).guides).toEqual([]);}
 p.artworks[1].locked=true;expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1694,centerHeightMm:1496},options).placement.alongMm).toBe(1700);
 expect(snapArtworkPlacement(p,'artwork-1','wall-a','back',{alongMm:1694,centerHeightMm:1496},options).guides).toEqual([]);
});
it('keeps wall and floor limits, 10mm fallback grid, and Alt/free placement',()=>{
 const p=fixture();expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1154,centerHeightMm:1638},options).placement).toEqual({alongMm:1150,centerHeightMm:1640});
 expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:106,centerHeightMm:107},options).placement).toEqual({alongMm:100,centerHeightMm:100});
 const free=snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1694.25,centerHeightMm:1496.5},{...options,bypass:true});expect(free.placement).toEqual({alongMm:1694.25,centerHeightMm:1496.5});expect(free.guides).toEqual([]);
 expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:-50,centerHeightMm:99999},{...options,bypass:true}).placement).toEqual({alongMm:100,centerHeightMm:3100});
});
it('respects per-axis screen tolerance and rejects invalid or uncalibrated input',()=>{
 const p=fixture();expect(snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1694,centerHeightMm:1496},{toleranceMm:{alongMm:5,centerHeightMm:5}}).placement).toEqual({alongMm:1690,centerHeightMm:1500});
 expect(()=>snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:NaN,centerHeightMm:1000},options)).toThrow();expect(()=>snapArtworkPlacement(p,'artwork-1','wall-a','front',{alongMm:1000,centerHeightMm:1000},{toleranceMm:{alongMm:Infinity,centerHeightMm:1}})).toThrow();
 expect(()=>snapArtworkPlacement({...p,planDraft:{kind:'partial',sourceEvidenceHash:'00000000',originalWalls:p.walls}},'artwork-1','wall-a','front',{alongMm:1000,centerHeightMm:1000},options)).toThrow('축척');
});
