import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {createPublicShare,parsePublicShare} from './publicShare';
import {floorFromLoops,validateImportedFloor} from './importedFloor';
import {floorWithOpenings} from './openings';
import {useEditor} from '../state/editor';
const loops=[[{x:-4000,z:-3000},{x:4000,z:-3000},{x:4000,z:3000},{x:-4000,z:3000}],[{x:-1000,z:-1000},{x:-1000,z:1000},{x:1000,z:1000},{x:1000,z:-1000}]];
it('uses exact floor loops and courtyard holes independently of edited walls',()=>{
 const project={...createDemoProject(),importedFloor:loops};project.walls=project.walls.slice(0,1);project.artworks=project.artworks.filter(a=>a.wallId===project.walls[0].id);
 expect(floorWithOpenings(project).areaMm2).toBe(44_000_000);expect(floorFromLoops(loops).surfaces[0].holes).toHaveLength(1);expect(parseProject(JSON.parse(JSON.stringify(project))).importedFloor).toEqual(loops);
});
it('rejects open, self-intersecting and nonfinite floor payloads',()=>{
 for(const bad of [[],[[{x:0,z:0},{x:1,z:1}]],[[{x:0,z:0},{x:10,z:10},{x:0,z:10},{x:10,z:0}]],[[{x:NaN,z:0},{x:10,z:0},{x:0,z:10}]]])expect(()=>validateImportedFloor(bad)).toThrow(/모델 바닥/);
});
it('preserves the adopted floor in structure Scenes and the public allowlist',()=>{
 const project={...createDemoProject(),importedFloor:loops};useEditor.getState().loadProject(project);useEditor.getState().saveScene('floor');const scene=useEditor.getState().project.scenes.at(-1)!;
 useEditor.getState().loadProject({...useEditor.getState().project,importedFloor:undefined});useEditor.getState().restoreScene(scene.id);expect(useEditor.getState().project.importedFloor).toEqual(loops);
 const {snapshot}=createPublicShare(project,{includeDimensions:false});expect(snapshot.importedFloor).toEqual(loops);expect(parsePublicShare({...snapshot,privateModel:{dataUrl:'private'},importedFloor:loops.map(l=>l.map(p=>({...p,secret:'private'})))}).importedFloor).toEqual(loops);
 expect(()=>parsePublicShare({...snapshot,referenceModel:{dataUrl:'private'}})).toThrow();
 expect(JSON.stringify(snapshot)).not.toContain('referenceModel');
});
