import type { Camera, Vector3 } from 'three';

export interface CameraView3D {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

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
