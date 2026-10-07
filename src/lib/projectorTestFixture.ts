import {createDemoProject,parseProject} from '../domain/model';
import {newLight,CUSTOM_LIGHTING} from '../domain/lighting';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
export function projectorTestFixture(){
 const p=createDemoProject();p.name='프로젝터 검증 20261007';p.id='owned-projector-fixture-20261007';p.artworks=[];p.scenes=[];
 const points=[{x:0,z:0},{x:6000,z:0},{x:6000,z:6000},{x:0,z:6000}];
 p.walls=p.walls.map((w,i)=>({...w,start:points[i],end:points[(i+1)%4],heightMm:3000,thicknessMm:120,role:'boundary'}));
 p.importedFloor=[points];
 p.walls[0].role='partition'; // Keep the receiving wall visible from every test view.
 p.walls.push({...p.walls[0],id:'occluder',name:'차폐 벽',start:{x:2700,z:1560},end:{x:3300,z:1560},heightMm:2400,visible:false});
 p.lights=[{...newLight(p,'projector'),position:{x:3000,y:1500,z:3060},target:{x:3000,y:1500,z:60},note:'PRIVATE_PROJECTOR_NOTE'}];p.lighting=CUSTOM_LIGHTING;
 const floor={...p,lights:[{...p.lights[0],position:{x:3000,y:3000,z:3000},target:{x:3000,y:0,z:3000}}]};
 p.scenes=appendSceneSnapshot(p,floor,'바닥 투사').scenes;
 return parseProject(p);
}
