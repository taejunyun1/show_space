import {expect,it,vi} from 'vitest';
import {DirectionalLight,SpotLight,Vector3} from 'three';
import {createDemoProject} from '../domain/model';import {DEFAULT_OUTDOOR,solarPosition} from '../domain/outdoor';import {newLight} from '../domain/lighting';import {createSceneLighting,disposeLighting} from './sceneLighting';import {disposeExportScene} from './exportScene';
it('fits translated, large exhibition geometry inside the sun shadow frustum and budgets sun + spots together',()=>{
 const p=createDemoProject();p.artworks=[];p.walls=p.walls.map(w=>({...w,start:{x:w.start.x*5+500000,z:w.start.z*5-200000},end:{x:w.end.x*5+500000,z:w.end.z*5-200000}}));p.outdoor={...DEFAULT_OUTDOOR,mode:'outdoor',northDeg:35};const spot=newLight(p,'spot');p.lights=Array.from({length:5},(_,i)=>({...spot,id:`spot-${i}`}));
 const rig=createSceneLighting(p),sun=rig.getObjectByName('outdoor-sun') as DirectionalLight,expected=new Vector3(...solarPosition(p.outdoor).direction).negate();expect(sun.target.getWorldPosition(new Vector3()).x).toBeCloseTo(500);expect(sun.getWorldPosition(new Vector3()).sub(sun.target.getWorldPosition(new Vector3())).normalize().distanceTo(expected.negate())).toBeLessThan(1e-8);
 sun.shadow.updateMatrices(sun);for(const w of p.walls)for(const a of [w.start,w.end])for(const y of [0,w.heightMm]){const v=new Vector3(a.x/1000,y/1000,a.z/1000).project(sun.shadow.camera);expect(Math.abs(v.x)).toBeLessThan(1);expect(Math.abs(v.y)).toBeLessThan(1);expect(Math.abs(v.z)).toBeLessThan(1);}
 const shadows:Array<DirectionalLight|SpotLight>=[];rig.traverse(o=>{if((o instanceof DirectionalLight||o instanceof SpotLight)&&o.castShadow)shadows.push(o);});expect(shadows).toHaveLength(4);disposeLighting(rig);
 p.outdoor.time='23:00';const night=createSceneLighting(p);expect(night.getObjectByName('outdoor-sun')).toBeUndefined();const spots:SpotLight[]=[];night.traverse(o=>{if(o instanceof SpotLight&&o.castShadow)spots.push(o);});expect(spots).toHaveLength(4);expect(spots[0].intensity).toBe(spot.intensity);disposeLighting(night);
});
it('roundtrips actual GLB sun direction and glTF package without claiming date/location metadata portability',async()=>{
 vi.stubGlobal('FileReader',class{result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}});
 try{
  const p=createDemoProject();p.artworks=[];p.outdoor={...DEFAULT_OUTDOOR,mode:'outdoor',time:'08:00',northDeg:90};
  const {exportProjectGlb,exportProjectGltf}=await import('./modelExport'),{GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
  const buffer=await(await exportProjectGlb(p)).arrayBuffer(),scene=(await new GLTFLoader().parseAsync(buffer,'')).scene;let sun:DirectionalLight|undefined;scene.traverse(o=>{if(o instanceof DirectionalLight)sun=o;});expect(sun).toBeDefined();expect(sun!.intensity).toBe(3);expect(sun!.getWorldDirection(new Vector3()).negate().distanceTo(new Vector3(...solarPosition(p.outdoor).direction).negate())).toBeLessThan(1e-6);disposeExportScene(scene);
  const {default:JSZip}=await import('jszip'),zip=await JSZip.loadAsync(await(await exportProjectGltf(p)).arrayBuffer(),{checkCRC32:true}),doc=JSON.parse(await zip.file('scene.gltf')!.async('string')),report=JSON.parse(await zip.file('export-report.json')!.async('string'));expect(doc.extensions.KHR_lights_punctual.lights[0].type).toBe('directional');expect(report.included.join(' ')).toContain('태양');expect(report.omitted.join(' ')).toContain('날짜');
 }finally{vi.unstubAllGlobals();}
});
