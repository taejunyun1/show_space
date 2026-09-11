import type {PlanText} from '../domain/planLabels';
interface TextItem {str:string;transform:number[];width:number;height:number}
export function pdfPlanTexts(items:unknown[],matrix:number[],width:number,height:number):PlanText[]{
 const result:PlanText[]=[];
 for(const raw of items.slice(0,20000)){
 const item=raw as TextItem;if(!item||typeof item.str!=='string'||!item.str.trim()||!Array.isArray(item.transform)||item.transform.length!==6||![...item.transform,item.width,item.height].every(Number.isFinite))continue;
 const [a,b,,,x,y]=item.transform;const n=Math.hypot(a,b);if(!n||item.width<=0||item.height<=0)continue;const ux=a/n,uy=b/n;
 const corners=[[x,y],[x+ux*item.width,y+uy*item.width],[x-uy*item.height,y+ux*item.height],[x+ux*item.width-uy*item.height,y+uy*item.width+ux*item.height]].map(([x,y])=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]}));
 const left=Math.max(0,Math.min(...corners.map(p=>p.x))),top=Math.max(0,Math.min(...corners.map(p=>p.y))),right=Math.min(width,Math.max(...corners.map(p=>p.x))),bottom=Math.min(height,Math.max(...corners.map(p=>p.y)));
 if(right>left&&bottom>top)result.push({text:item.str.slice(0,2000),box:{x:left,y:top,width:right-left,height:bottom-top},source:'pdf-text'});
 }return result;
}
