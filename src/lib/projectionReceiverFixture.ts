import {parseProject} from '../domain/model';
import {newLight} from '../domain/lighting';
import {projectorTestFixture} from './projectorTestFixture';
import {testArtworkModel} from './modelArtworkTestFixture';
/** Owned synthetic scene, shared by export regressions and the independent receiver. */
export function projectionReceiverFixture(){
 const p=projectorTestFixture();p.id='synthetic-projection-receiver-20261007';p.name='프로젝터 제외 수신 검증';
 const wall=p.lights![0],floor={...p.scenes[0].structure!.lights![0],id:'floor-projector',name:'바닥 투사',note:'PRIVATE_FLOOR_PROJECTOR_NOTE'};
 p.lights=[wall,floor,{...newLight(p,'area'),id:'area-excluded',note:'PRIVATE_AREA_NOTE'},{...newLight(p,'spot'),id:'normal-spot',name:'수신 스팟',position:{x:1000,y:2700,z:4500},target:{x:3000,y:1300,z:60},intensity:75,beamDeg:48,penumbra:.25},{...newLight(p,'area'),id:'hidden-area',visible:false}];
 p.referenceModel={...testArtworkModel(),name:'reference-space',positionMm:[4000,0,4000],rotationDeg:25,scale:1};
 return parseProject(p);
}
