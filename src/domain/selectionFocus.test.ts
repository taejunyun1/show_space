import {expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {createDemoProject} from './model';
import {selectionFocusPoints,fitFocusViewport,elevationFocus} from './selectionFocus';
import {buildExportScene,disposeExportScene} from '../lib/exportScene';
import {projectionReceiverFixture} from '../lib/projectionReceiverFixture';

it('matches actual exported rotated walls and framed artwork bounds without changing source',()=>{
 const p=createDemoProject();p.walls[0].end={x:2000,z:1000};p.artworks[0]={...p.artworks[0],wallSide:'back',rotationDeg:37,frameSettings:{widthMm:30,depthMm:80,matWidthMm:60,matColor:'#ffffff',material:'wood',cover:'glass'}};
 const before=JSON.stringify(p),scene=buildExportScene(p);scene.updateMatrixWorld(true);
 try{for(const s of [{type:'wall' as const,id:p.walls[0].id},{type:'artwork' as const,id:p.artworks[0].id}]){
  const actual=new Box3().setFromObject(scene.getObjectByName(`${s.type}-${s.id}`)!,true),focused=new Box3().setFromPoints(selectionFocusPoints(p,[s]).map(p=>new Vector3(p.x/1000,p.y/1000,p.z/1000)));
  for(const key of ['min','max'] as const)for(const axis of ['x','y','z'] as const)expect(focused[key][axis]).toBeCloseTo(actual[key][axis],4);
 }}finally{disposeExportScene(scene);}expect(JSON.stringify(p)).toBe(before);
});
it('combines mixed selections including tilted models, skips invisible or missing objects and does not unlock them',()=>{
 const p=projectionReceiverFixture();p.modelArtworks=[{...p.modelArtworks?.[0],id:'dummy',position:{x:6000,y:500,z:7000},rotation:{x:30,y:55,z:12},widthMm:1000,heightMm:2000,depthMm:600,visible:true,locked:true} as NonNullable<typeof p.modelArtworks>[number]];
 const selected=[{type:'wall' as const,id:p.walls[0].id},{type:'modelArtwork' as const,id:'dummy'},{type:'light' as const,id:p.lights![0].id}],before=JSON.stringify(p),points=selectionFocusPoints(p,selected);
 expect(points).toHaveLength(24);expect(points.some(v=>v.y>2500)).toBe(true);
 p.walls[0].visible=false;p.modelArtworks[0].visible=false;p.lights![0].visible=false;expect(selectionFocusPoints(p,selected)).toEqual([]);expect(selectionFocusPoints(p,[{type:'artwork',id:'deleted'}])).toEqual([]);
 const untouched=JSON.parse(before);expect(untouched.modelArtworks[0].locked).toBe(true);
});
it('frames raw plan coordinates at the viewport aspect without translating or calibrating them',()=>{
 const points=[{x:120,z:50},{x:160,z:250}],before=JSON.stringify(points),view=fitFocusViewport(points,{width:900,height:300},10)!;
 expect(view.width/view.height).toBeCloseTo(3);expect(view.x+view.width/2).toBe(140);expect(view.z+view.height/2).toBe(150);expect(view.width).toBe(750);expect(JSON.stringify(points)).toBe(before);expect(fitFocusViewport([],{width:900,height:300})).toBeNull();
});
it('frames back-side rotated artwork on its own wall and excludes other faces',()=>{
 const p=createDemoProject(),a=p.artworks[0];a.wallSide='back';a.rotationDeg=90;a.frame='none';a.widthMm=400;a.heightMm=1200;a.alongMm=1800;a.centerHeightMm=1500;
 const selection=[{type:'artwork' as const,id:a.id},{type:'artwork' as const,id:p.artworks[2].id}],focused=elevationFocus(p,selection,{width:800,height:600})!;
 expect(focused.wallId).toBe(a.wallId);expect(focused.side).toBe('back');expect(focused.view.x+focused.view.width/2).toBeCloseTo(6200);expect(focused.view.z+focused.view.height/2).toBeCloseTo(1700);expect(focused.view.width).toBeCloseTo(1500);
 expect(elevationFocus(p,[{type:'modelArtwork',id:'missing'}],{width:800,height:600})).toBeNull();
});
