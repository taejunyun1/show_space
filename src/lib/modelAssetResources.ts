import {Mesh,Texture,type Object3D,type Material} from 'three';
/** Shared loader resources are disposed exactly once, including decoded bitmaps. */
export function disposeModelAsset(scene:Object3D|Object3D[]){
 const textures=new Set<Texture>(),materials=new Set<Material>(),geometries=new Set<Mesh['geometry']>();
 for(const root of Array.isArray(scene)?scene:[scene])root.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof Texture)textures.add(v);}}});
 const images=new Set<unknown>();textures.forEach(t=>{images.add(t.source.data);t.dispose();});for(const image of images)if(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap)image.close();materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
