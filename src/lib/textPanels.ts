import type {PlanLabel} from '../domain/planLabels';
import {detectTextPanels} from '../domain/textPanels';
import type {TextRegion} from '../domain/textStrokes';
export function pageTextPanels(rendered:HTMLCanvasElement,text:TextRegion[],labels:PlanLabel[]=[]):TextRegion[]{
 if(!text.length)return [];
 const canvas=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(rendered.width,rendered.height));
 canvas.width=Math.max(1,Math.round(rendered.width*scale));canvas.height=Math.max(1,Math.round(rendered.height*scale));
 try{
  const ctx=canvas.getContext('2d')!;ctx.drawImage(rendered,0,0,canvas.width,canvas.height);
  const sx=rendered.width/canvas.width,sy=rendered.height/canvas.height;
  return detectTextPanels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,text.map(b=>({x:b.x/sx,y:b.y/sy,width:b.width/sx,height:b.height/sy})),labels.map(l=>({...l,box:{x:l.box.x/sx,y:l.box.y/sy,width:l.box.width/sx,height:l.box.height/sy}}))).map(b=>({x:b.x*sx,y:b.y*sy,width:b.width*sx,height:b.height*sy}));
 }finally{canvas.width=canvas.height=0;}
}
