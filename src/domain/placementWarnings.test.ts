import {expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {createDemoProject,parseProject} from './model';
import {projectionReceiverFixture} from '../lib/projectionReceiverFixture';
import {modelArtworkBounds} from './modelArtworks';
import {placementWarningIndex} from './placementWarnings';
import type {ModelArtwork,Project} from './types';
const model=(id='sculpture',patch:Partial<ModelArtwork>={}):ModelArtwork=>({id,name:id,artist:'',year:'',kind:'sculpture',model:{name:'owned synthetic',dataUrl:'',sizeMm:[1000,1000,1000],sourceOffsetM:[0,0,0]},widthMm:1000,heightMm:1000,depthMm:1000,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},visible:true,locked:false,note:'PRIVATE',...patch});
const empty=():Project=>({...createDemoProject(),walls:[],artworks:[],modelArtworks:[],importedFloor:[]});
const query=(p:Project,id='sculpture')=>placementWarningIndex(p).query({type:'modelArtwork',id});
it('warns below the reference floor using tilted corners, while resting/contact and hidden models stay quiet',()=>{
 const p=empty(),a=model();p.modelArtworks=[a];expect(query(p)).toEqual([]);a.position.y=-.8;expect(query(p)).toEqual([]);a.position.y=-2;expect(query(p).map(w=>w.code)).toEqual(['below-floor']);a.position.y=0;a.rotation.z=45;expect(a.position.y).toBe(0);expect(modelArtworkBounds(a).minY).toBeLessThan(-300);expect(query(p).map(w=>w.code)).toEqual(['below-floor']);a.visible=false;expect(query(p)).toEqual([]);
});
it('warns against actual finite wall boxes, and leaves doors/gaps and wall contact open',()=>{
 const p=empty(),w={...createDemoProject().walls[0],id:'obstacle',name:'가벽',start:{x:-2000,z:0},end:{x:2000,z:0},heightMm:3000,thicknessMm:200};p.walls=[w];p.modelArtworks=[model('sculpture',{position:{x:0,y:0,z:300}})];expect(query(p).find(w=>w.code==='wall-overlap')?.targetIds).toEqual(['obstacle']);p.modelArtworks[0].position.z=600;expect(query(p)).toEqual([]);p.modelArtworks[0].position={x:2600,y:0,z:0};expect(query(p)).toEqual([]);p.modelArtworks[0].position={x:0,y:3100,z:0};expect(query(p)).toEqual([]);
 p.walls=[{...w,id:'left',end:{x:-600,z:0}},{...w,id:'right',start:{x:600,z:0}}];p.modelArtworks[0].position={x:0,y:0,z:0};expect(query(p)).toEqual([]);p.modelArtworks[0].position.x=150;expect(query(p).find(w=>w.code==='wall-overlap')?.targetIds).toEqual(['right']);p.walls[1].visible=false;expect(query(p)).toEqual([]);
});
it('distinguishes parallel rotated boxes whose axis-aligned bounds overlap but physical envelopes do not',()=>{
 const p=empty(),a=model('sculpture',{widthMm:4000,heightMm:200,depthMm:100,position:{x:0,y:100,z:0},rotation:{x:0,y:45,z:0}}),b=model('neighbor',{...a,id:'neighbor',name:'neighbor',position:{x:300/Math.sqrt(2),y:100,z:300/Math.sqrt(2)}});p.modelArtworks=[a,b];const ba=modelArtworkBounds(a),bb=modelArtworkBounds(b),aabb=(b:typeof ba)=>new Box3(new Vector3(b.minX,b.minY,b.minZ),new Vector3(b.maxX,b.maxY,b.maxZ));expect(aabb(ba).intersectsBox(aabb(bb))).toBe(true);expect(query(p)).toEqual([]);b.position={x:40/Math.sqrt(2),y:100,z:40/Math.sqrt(2)};expect(query(p).find(w=>w.code==='artwork-overlap')?.targetIds).toEqual(['neighbor']);
});
it('checks XYZ rotations and both image/model artwork types symmetrically, without flagging self, hidden or separated objects',()=>{
 const p=empty(),wall={...createDemoProject().walls[0],id:'picture-wall',start:{x:-2000,z:0},end:{x:2000,z:0},thicknessMm:100,heightMm:3000};p.walls=[wall];const picture={...createDemoProject().artworks[0],id:'picture',wallId:wall.id,alongMm:2000,centerHeightMm:1500,widthMm:600,heightMm:600,depthMm:60,frame:'none' as const,rotationDeg:25};p.artworks=[picture];p.modelArtworks=[model('sculpture',{widthMm:400,heightMm:400,depthMm:400,position:{x:0,y:1300,z:300},rotation:{x:15,y:20,z:25}})];expect(query(p).find(w=>w.code==='artwork-overlap')?.targetIds).toEqual(['picture']);expect(placementWarningIndex(p).query({type:'artwork',id:'picture'}).find(w=>w.code==='artwork-overlap')?.targetIds).toEqual(['sculpture']);p.modelArtworks[0].position.z=900;expect(query(p).some(w=>w.code==='artwork-overlap')).toBe(false);p.modelArtworks[0].position.z=300;picture.visible=false;expect(query(p).some(w=>w.code==='artwork-overlap')).toBe(false);
});
it('warns on extreme source-relative deformation, keeps intended grouping collisions visible, and aggregates names',()=>{
 const p=empty(),a=model();p.modelArtworks=[a,...Array.from({length:5},(_,i)=>model('neighbor-'+i,{groupId:'g'}))];a.groupId='g';a.model.sizeMm[0]=10;a.widthMm=2000;const warnings=query(p);expect(warnings.find(w=>w.code==='artwork-overlap')?.targetIds).toHaveLength(5);expect(warnings.find(w=>w.code==='artwork-overlap')?.message).toContain('외 2개');expect(warnings.some(w=>w.code==='scale')).toBe(true);a.widthMm=1000;a.heightMm=9;expect(query(p).some(w=>w.code==='scale')).toBe(true);
});
it('does not change stored layout, locks, Notes, Scene or Undo semantics and skips uncalibrated px drawings',()=>{
 const p=projectionReceiverFixture();p.modelArtworks=[{...model(),model:p.referenceModel!,position:{x:0,y:-300,z:0},locked:true}];const before=JSON.stringify(p);query(p);expect(JSON.stringify(p)).toBe(before);const baseline=parseProject(JSON.parse(before));expect(baseline.modelArtworks?.[0].locked).toBe(true);p.planDraft={kind:'partial',sourceEvidenceHash:'00000000',originalWalls:p.walls};expect(query(p)).toEqual([]);expect(placementWarningIndex(p).query({type:'artwork',id:'deleted'})).toEqual([]);
});

it('does not turn a diagonal wall AABB into a filled obstacle beyond its real rotated thickness',()=>{
 const p=empty(),wall={...createDemoProject().walls[0],id:'diagonal',start:{x:0,z:0},end:{x:3000,z:3000},thicknessMm:200,heightMm:3000};p.walls=[wall];const offset=(distance:number)=>({x:1500-distance/Math.sqrt(2),y:100,z:1500+distance/Math.sqrt(2)});p.modelArtworks=[model('sculpture',{widthMm:1000,heightMm:200,depthMm:100,rotation:{x:0,y:-45,z:0},position:offset(300)})];expect(query(p)).toEqual([]);p.modelArtworks[0].position=offset(80);expect(query(p).find(w=>w.code==='wall-overlap')?.targetIds).toEqual(['diagonal']);
});
