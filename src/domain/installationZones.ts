import type {Project,Point} from './types';
export function installationZones(project:Project){
 const ref=project.planReference;
 if(!ref?.calibrated)return [];
 return (project.planAnalysis?.stairRegions??[]).filter(region=>project.planLabels?.some(label=>label.id===region.labelId&&label.kind==='stairs'&&label.status!=='dismissed')).map(region=>({id:region.id,kind:'stairs' as const,x:ref.origin.x+region.box.x*ref.mmPerPixel,z:ref.origin.z+region.box.y*ref.mmPerPixel,width:region.box.width*ref.mmPerPixel,depth:region.box.height*ref.mmPerPixel}));
}
/** Separating-axis intersection against the actual artwork footprint; no
 * regulatory clearance or unobserved stair dimensions are added. */
export function footprintOverlapsZone(footprint:Point[],zone:ReturnType<typeof installationZones>[number]):boolean{
 const rectangle=[{x:zone.x,z:zone.z},{x:zone.x+zone.width,z:zone.z},{x:zone.x+zone.width,z:zone.z+zone.depth},{x:zone.x,z:zone.z+zone.depth}];
 const axes=[{x:1,z:0},{x:0,z:1},...footprint.map((p,i)=>{const q=footprint[(i+1)%footprint.length];return {x:-(q.z-p.z),z:q.x-p.x};})];
 return axes.every(axis=>{
  const a=footprint.map(p=>p.x*axis.x+p.z*axis.z),b=rectangle.map(p=>p.x*axis.x+p.z*axis.z);
  return Math.max(...a)>=Math.min(...b)&&Math.max(...b)>=Math.min(...a);
 });
}
