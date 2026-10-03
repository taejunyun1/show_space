import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {projectSpatialBounds} from './referenceModel';
import type {ReferenceModel} from './types';
import {testGlb} from '../lib/glbTestFixture';
import {useEditor} from '../state/editor';
const model:ReferenceModel={name:'room.glb',dataUrl:'data:model/gltf-binary;base64,'+btoa(String.fromCharCode(...new Uint8Array(testGlb()))),visible:true,sizeMm:[20000,8000,10000],sourceOffsetM:[0,0,0],positionMm:[1000,0,2000],rotationDeg:90,scale:1};
it('fits the rotated imported model as well as the editable gallery',()=>{
 const p={...createDemoProject(),referenceModel:model};
 const b=projectSpatialBounds(p);expect(b.minX).toBeCloseTo(-4000);expect(b.maxX).toBeCloseTo(6000);expect(b.minZ).toBeCloseTo(-8000);expect(b.maxZ).toBeCloseTo(12000);expect(b.maxY).toBe(8000);
 expect(projectSpatialBounds({...p,referenceModel:{...model,visible:false}}).maxY).toBe(3200);
});
it('validates model assets and preserves JSON, Scene restoration and Undo',()=>{
 const p=parseProject({...createDemoProject(),referenceModel:model});expect(p.referenceModel).toEqual(model);
 useEditor.getState().loadProject(p);useEditor.getState().saveScene('Imported');useEditor.getState().patchProject({referenceModel:undefined});
 const sceneId=useEditor.getState().project.scenes.at(-1)!.id;useEditor.getState().restoreScene(sceneId);
 expect(useEditor.getState().project.referenceModel).toEqual(model);useEditor.getState().undo();expect(useEditor.getState().project.referenceModel).toBeUndefined();
});
it('rejects invalid transforms and unsafe model URLs in imported JSON',()=>{
 for(const patch of [{scale:0},{positionMm:[NaN,0,0]},{dataUrl:'https://example.com/room.glb'}])expect(()=>parseProject({...createDemoProject(),referenceModel:{...model,...patch}})).toThrow(/3D 모델/);
});

it('does not persist an invalid live camera in a new Scene',()=>{
 useEditor.getState().loadProject(createDemoProject());const count=useEditor.getState().project.scenes.length;
 useEditor.getState().saveScene('bad camera',{position:[NaN,0,0],target:[0,0,0],zoom:1});
 expect(useEditor.getState().project.scenes).toHaveLength(count);
 expect(useEditor.getState().message).toContain('시점 좌표');
});

it('fits model-only venues at their position without adding an artificial origin range',()=>{
 const bounds=projectSpatialBounds({walls:[],referenceModel:{...model,rotationDeg:0,positionMm:[50000,500,70000]}});
 expect(bounds.minX).toBe(40000);expect(bounds.maxX).toBe(60000);expect(bounds.minZ).toBe(65000);expect(bounds.maxZ).toBe(75000);
});
