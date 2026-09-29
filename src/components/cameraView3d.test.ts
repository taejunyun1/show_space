import {createDemoProject,parseProject} from '../domain/model';
import { expect, it } from 'vitest';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { createCameraViewGetter, createEyeLevelView } from './cameraView3d';

it('reads the live camera and orbit target each time a view is requested', () => {
  const camera = new OrthographicCamera();
  const target = new Vector3(1, 2, 3);
  camera.position.set(4, 5, 6);
  camera.zoom = 12;
  const getView = createCameraViewGetter(camera, () => target);
  expect(getView()).toEqual({ position: [4, 5, 6], target: [1, 2, 3], zoom: 12 });
  camera.position.set(7, 8, 9);
  target.set(10, 11, 12);
  expect(getView()).toEqual({ position: [7, 8, 9], target: [10, 11, 12], zoom: 12 });
});

it('saves perspective projection and lens for Scene restoration',()=>{
  const camera=new PerspectiveCamera(55);camera.position.set(1,1.6,2);
  expect(createCameraViewGetter(camera,()=>new Vector3(0,1.6,0))()).toEqual({position:[1,1.6,2],target:[0,1.6,0],zoom:1,projection:'perspective',fov:55});
});
it('places an eye-level camera facing the selected wall with a finite direction',()=>{
  const project=createDemoProject(),view=createEyeLevelView(project,'wall-a',1600);
  expect(view.projection).toBe('perspective');expect(view.position[1]).toBe(1.6);expect(view.target[1]).toBe(1.6);
  expect(view.position).not.toEqual(view.target);
  project.scenes=[{id:'eye',name:'eye',artworks:[],wallVisibility:{},cameraView:view}];
  expect(parseProject(JSON.parse(JSON.stringify(project))).scenes[0].cameraView).toEqual(view);
  expect(()=>parseProject({...project,scenes:[{...project.scenes[0],cameraView:{...view,fov:180}}]})).toThrow();
});
