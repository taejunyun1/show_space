import type {PublicSceneSnapshot} from './publicShare';
import type {Project} from './types';
import {floorWithOpenings,openingSegments} from './openings';
import {installationZones} from './installationZones';
import {resolveMeasurement} from './measurements';
import {artPanel} from '../lib/art';
export type ReadonlyDrawingSnapshot=Pick<PublicSceneSnapshot,'displayUnit'|'floorColor'|'walls'|'openings'|'zones'|'importedFloor'|'dimensions'>&{
 artworks:Array<Omit<PublicSceneSnapshot['artworks'][number],'imageId'>&{imageId?:string;imageUrl?:string}>;
 modelArtworks?:Array<Omit<NonNullable<PublicSceneSnapshot['modelArtworks']>[number],'modelId'>>;
 referenceModel?:Omit<NonNullable<PublicSceneSnapshot['referenceModel']>,'modelId'>;
};
/** Local drawing data only. No asset publishing or owner credentials are needed. */
export function installationDrawing(project:Project):ReadonlyDrawingSnapshot{
 const walls=project.walls.filter(w=>w.visible),ids=new Set(walls.map(w=>w.id));
 return {displayUnit:project.displayUnit,floorColor:project.floorColor,walls:walls.map(w=>({id:w.id,name:w.name,start:w.start,end:w.end,heightMm:w.heightMm,thicknessMm:w.thicknessMm,color:w.color})),artworks:project.artworks.filter(a=>a.visible&&ids.has(a.wallId)).map(a=>({id:a.id,name:a.name,artist:a.artist,widthMm:a.widthMm,heightMm:a.heightMm,depthMm:a.depthMm,wallId:a.wallId,wallSide:a.wallSide??'front',alongMm:a.alongMm,centerHeightMm:a.centerHeightMm,rotationDeg:a.rotationDeg,frame:a.frame,frameSettings:a.frameSettings,imageUrl:a.imageUrl,...(artPanel(a.imageUrl)!==null?{spritePanel:artPanel(a.imageUrl)!}:{})})),modelArtworks:project.modelArtworks?.filter(a=>a.visible).map(a=>({id:a.id,name:a.name,artist:a.artist,year:a.year,kind:a.kind,widthMm:a.widthMm,heightMm:a.heightMm,depthMm:a.depthMm,position:a.position,rotation:a.rotation,sizeMm:a.model.sizeMm,sourceOffsetM:a.model.sourceOffsetM})),referenceModel:project.referenceModel?.visible?{sizeMm:project.referenceModel.sizeMm,sourceOffsetM:project.referenceModel.sourceOffsetM,positionMm:project.referenceModel.positionMm,rotationDeg:project.referenceModel.rotationDeg,scale:project.referenceModel.scale}:undefined,importedFloor:floorWithOpenings(project).surfaces.flatMap(s=>[s.outer,...s.holes]),openings:openingSegments({walls:project.walls,openings:(project.openings??[]).filter(o=>[o.start,o.end].every(a=>!a.wallId||ids.has(a.wallId)))}).map(o=>({id:o.id,kind:o.kind,start:o.start,end:o.end})),zones:installationZones(project),dimensions:project.planDraft&&!project.planReference?.calibrated?undefined:(project.dimensions??[]).filter(d=>!d.elevationWallId||ids.has(d.elevationWallId)).map(d=>{const r=resolveMeasurement(project,d);return {id:d.id,view:d.view,elevationWallId:d.elevationWallId,start:r.start,end:r.end,distanceMm:r.distanceMm};})};
}
