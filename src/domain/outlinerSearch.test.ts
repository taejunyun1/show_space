import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {searchProjectObjects} from './outlinerSearch';
import {materialPreset} from './materials';
import {newLight} from './lighting';
import {addModelArtwork} from './modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';

it('finds Korean decomposed names, case-insensitive metadata and multiple terms in the same current object',()=>{
 const p=createDemoProject();p.artworks[0].name='고요한 면'.normalize('NFD');p.artworks[0].artist='Taejun Yun';p.artworks[0].medium='Archival pigment print';
 expect(searchProjectObjects(p,'고요한 면')).toEqual([{type:'artwork',id:'artwork-1'}]);
 expect(searchProjectObjects(p,'TAEJUN pigment')).toEqual([{type:'artwork',id:'artwork-1'}]);
 expect(searchProjectObjects(p,'벽 A 고요한')).toEqual([{type:'artwork',id:'artwork-1'}]);
 expect(searchProjectObjects(p,'TAEJUN 없는말')).toEqual([]);
});
it('searches assigned surface and frame materials without treating every default wall as white paint',()=>{
 const p=createDemoProject();p.walls[0].material=materialPreset('concrete').material;p.floorMaterial=materialPreset('epoxy-floor').material;p.artworks[0].material=materialPreset('baryta').material;
 expect(searchProjectObjects(p,'콘크리트')).toEqual([{type:'wall',id:'wall-a'}]);expect(searchProjectObjects(p,'에폭시')).toEqual([{type:'floor',id:''}]);
 expect(searchProjectObjects(p,'baryta')).toEqual([{type:'artwork',id:'artwork-1'}]);expect(searchProjectObjects(p,'화이트 페인트')).toEqual([]);
 expect(searchProjectObjects(p,'목재').map(r=>r.type)).toEqual(p.artworks.filter(a=>a.frame!=='none').map(()=> 'artwork'));
});
it('includes hidden and locked objects, unplaced works, lights and imported models without modifying their geometry',()=>{
 const p=addModelArtwork(createDemoProject(),testArtworkModel()).project;
 p.walls[0].visible=false;p.walls[0].locked=true;p.artworks[0].visible=false;p.lights=[newLight(p,'spot')];
 p.unplacedArtworks=[{...p.artworks.pop()!,id:'loose',name:'미배치 조각 도면'}];
 p.referenceModel={name:'전시장 전체',dataUrl:'do-not-index',visible:false,sizeMm:[1000,2000,3000],sourceOffsetM:[0,0,0],positionMm:[0,0,0],rotationDeg:0,scale:1};
 const before=JSON.stringify(p),all=searchProjectObjects(p,'');
 expect(all).toHaveLength(p.walls.length+p.artworks.length+1+1+1+1+1);
 expect(all).toContainEqual({type:'wall',id:'wall-a'});expect(searchProjectObjects(p,'스팟')).toEqual([{type:'light',id:p.lights[0].id}]);
 expect(searchProjectObjects(p,'미배치')).toEqual([{type:'unplacedArtwork',id:'loose'}]);expect(searchProjectObjects(p,'전시장 전체')).toEqual([{type:'referenceModel',id:''}]);
 expect(searchProjectObjects(p,'','artwork').every(r=>['artwork','unplacedArtwork','modelArtwork'].includes(r.type))).toBe(true);
 expect(searchProjectObjects(p,'스팟','artwork')).toEqual([]);expect(JSON.stringify(p)).toBe(before);
});
it('does not search historical scenes, private notes or image/model payloads and keeps original object order',()=>{
 const p=createDemoProject();p.artworks[0].note='PRIVATE';p.artworks[0].imageUrl='data:image/png;base64,ASSET';p.walls[0].noteDetails={images:[],checklist:[{id:'task',text:'PRIVATE',done:true}]};p.scenes=[{id:'old',name:'History',artworks:[{...p.artworks[0],name:'OLD_TITLE'}],wallVisibility:{}}];
 for(const term of ['PRIVATE','ASSET','OLD_TITLE','History'])expect(searchProjectObjects(p,term)).toEqual([]);
 expect(searchProjectObjects(p,'작품','artwork').map(r=>r.id)).toEqual(p.artworks.map(a=>a.id));
});
