import { expect, it } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import { createCameraViewGetter } from './cameraView3d';

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
