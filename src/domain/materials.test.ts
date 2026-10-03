import {expect,it} from 'vitest';
import {materialPresetIds,materialPreset,parseSurfaceMaterial} from './materials';
import {createDemoProject,parseProject} from './model';
import {createPublicShare,parsePublicShare} from './publicShare';

it('validates all fifteen presets and returns independent editable settings',()=>{
 expect(materialPresetIds).toHaveLength(15);
 for(const id of materialPresetIds){const a=materialPreset(id),b=materialPreset(id);expect(parseSurfaceMaterial(a.material)).toEqual(a.material);a.material.roughness=0;expect(b.material).toEqual(materialPreset(id).material);}
});
it('rejects invalid numbers, presets and conflicting transmission/opacity',()=>{
 const m=materialPreset('glass').material;
 for(const patch of [{preset:'other'},{roughness:NaN},{metalness:Infinity},{opacity:-1},{transmission:1.01},{clearcoat:2},{sheen:'1'},{thicknessMm:-1},{thicknessMm:2001},{ior:0},{ior:2.334},{opacity:.5}])expect(()=>parseSurfaceMaterial({...m,...patch})).toThrow();
});
it('roundtrips wall, artwork, floor and saved Scene finishes while retaining old projects',()=>{
 const p=createDemoProject();expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 p.floorMaterial=materialPreset('epoxy-floor').material;p.walls[0].material=materialPreset('glass').material;p.artworks[0].material=materialPreset('glossy-photo-paper').material;
 p.scenes=[{id:'scene-1',name:'finish',artworks:structuredClone(p.artworks),wallVisibility:{},structure:{floorColor:p.floorColor,floorMaterial:structuredClone(p.floorMaterial),walls:structuredClone(p.walls),openings:[],dimensions:[],unplacedArtworks:[]}}];
 expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 expect(()=>parseProject({...p,floorMaterial:{...p.floorMaterial,roughness:2}})).toThrow();
 expect(()=>parseProject({...p,walls:[{...p.walls[0],material:{...p.walls[0].material,ior:3}},...p.walls.slice(1)]})).toThrow();
 expect(()=>parseProject({...p,scenes:[{...p.scenes[0],structure:{...p.scenes[0].structure,floorColor:undefined}}]})).toThrow(/색상/);
});
it('shares only validated material properties and strips unknown private fields',()=>{
 const p=createDemoProject();const material={...materialPreset('metal').material,privateNote:'SECRET'};
 p.floorMaterial=material;p.walls[0].material=material;p.artworks[0].material=material;
 const {snapshot}=createPublicShare(p,{includeDimensions:false});expect(JSON.stringify(snapshot)).not.toContain('SECRET');
 const raw={...snapshot,floorMaterial:material,walls:snapshot.walls.map(w=>({...w,material})),artworks:snapshot.artworks.map(a=>({...a,material}))};
 const publicSnapshot=parsePublicShare(raw);expect(JSON.stringify(publicSnapshot)).not.toContain('SECRET');expect(publicSnapshot.floorMaterial).toEqual(materialPreset('metal').material);
 expect(()=>parsePublicShare({...raw,floorMaterial:{...material,roughness:2}})).toThrow();
 expect(()=>parsePublicShare({...raw,artworks:[{...raw.artworks[0],material:{...material,transmission:1,opacity:.5}},...raw.artworks.slice(1)]})).toThrow();
});
