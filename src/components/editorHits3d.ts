import type {Object3D} from 'three';
import {isObjectVisible} from './wallVisibility3d';

/** Screen overlays take pointer priority over the space behind them. Pivot's
 * invisible hit cylinders are intentional and must remain interactive. */
export function editorHits3d<T extends {object:Object3D}>(items:T[]):T[]{
 return items.filter(item=>(item.object.userData.lightMoveHandle||item.object.userData.modelArtworkHandle)||isObjectVisible(item.object))
  .sort((a,b)=>Number(!!(b.object.userData.lightMoveHandle||b.object.userData.modelArtworkHandle))-Number(!!(a.object.userData.lightMoveHandle||a.object.userData.modelArtworkHandle)));
}
