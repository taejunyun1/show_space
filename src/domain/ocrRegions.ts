import type {PlanText} from './planLabels';
export type OcrRegion=PlanText['box'];
/** Four overlapping source-image regions; overlap keeps boundary digits intact. */
export function numericOcrRegions(width:number,height:number):OcrRegion[]{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
 const margin=Math.min(64,width/8,height/8);
 return [0,1].flatMap(row=>[0,1].map(col=>{
  const x=Math.max(0,col*width/2-margin),y=Math.max(0,row*height/2-margin);
  return {x,y,width:Math.min(width-x,width/2+margin*2),height:Math.min(height-y,height/2+margin*2)};
 }));
}
