import type { Camera, Vector3 } from 'three';
import type {CameraView} from '../domain/types';

export type CameraView3D=CameraView;

export function createCameraViewGetter(camera: Camera, getTarget: () => Vector3): () => CameraView3D {
  return () => {
    const target = getTarget();
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
      zoom: 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1,
    };
  };
}
