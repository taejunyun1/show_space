import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {adoptModelSpace} from './modelSpace';
import {testGlb} from '../lib/glbTestFixture';
import {useEditor} from '../state/editor';
function project(){return {...createDemoProject(),referenceModel:{name:'room.glb',dataUrl:'data:model/gltf-binary;base64,'+btoa(String.fromCharCode(...new Uint8Array(testGlb()))),visible:true,sizeMm:[8000,3000,6000] as [number,number,number],sourceOffsetM:[0,0,0] as [number,number,number],positionMm:[0,0,0] as [number,number,number],rotationDeg:0,scale:1}};}
it('replaces walls without losing artwork bytes, legacy Scenes or the source model',()=>{
 const p=project();p.scenes=[{id:'old',name:'old',wallVisibility:{'wall-a':true},artworks:structuredClone(p.artworks)}];
 const wall={...p.walls[0],id:'model-wall-1',heightMm:3000};const next=adoptModelSpace(p,[wall]);
 expect(next.walls).toEqual([wall]);expect(next.artworks).toEqual([]);expect(next.unplacedArtworks).toHaveLength(5);
 expect(next.unplacedArtworks?.[0].imageUrl).toBe(p.artworks[0].imageUrl);expect(next.referenceModel).toEqual({...p.referenceModel,visible:false});
 expect(parseProject(JSON.parse(JSON.stringify(next))).scenes[0].structure?.walls).toEqual(p.walls);
 expect(p.walls).toHaveLength(4);expect(p.referenceModel.visible).toBe(true);
});
it('refuses empty extraction or locked edits and keeps measurements from referencing removed walls',()=>{
 const p=project();expect(()=>adoptModelSpace(p,[])).toThrow(/벽/);p.walls[0].locked=true;expect(()=>adoptModelSpace(p,[p.walls[1]])).toThrow(/잠금/);
 p.walls[0].locked=false;p.dimensions=[{id:'d',view:'3d',offsetMm:0,start:{kind:'wall',wallId:'wall-a',t:0,heightRatio:0,offsetMm:0,fallback:{x:0,y:0,z:0}},end:{kind:'fixed',fallback:{x:1000,y:0,z:0}}}];
 expect(adoptModelSpace(p,[{...p.walls[1],id:'model-wall-1'}]).dimensions).toEqual([]);
});
it('adopts the model in one Undo transaction and restores the old model, walls and artwork',()=>{
 const p=project();useEditor.getState().loadProject(p);useEditor.getState().adoptModelWalls([{...p.walls[0],id:'model-wall-1'}],p.referenceModel);
 expect(useEditor.getState().project.walls).toHaveLength(1);expect(useEditor.getState().project.artworks).toEqual([]);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(p);
});
it('does not apply asynchronous extraction after the model transform changes',()=>{
 const p=project();useEditor.getState().loadProject(p);useEditor.getState().patchProject({referenceModel:{...p.referenceModel,rotationDeg:90}});
 useEditor.getState().adoptModelWalls([{...p.walls[0],id:'model-wall-1'}],p.referenceModel);
 expect(useEditor.getState().project.walls).toHaveLength(4);expect(useEditor.getState().message).toContain('모델이 변경');
});
