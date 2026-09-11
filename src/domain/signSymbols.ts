import {fireHoseTemplate,fireHoseTones} from './fireHoseTemplate';
import type {PlanLabel} from './planLabels';

/** Recognizes one known cabinet pictogram, not arbitrary red safety signs.
 * The footer is deliberately excluded: this is visual evidence, not OCR. */
export function scoreFireHoseSymbol(data:Uint8ClampedArray,width:number,height:number){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<32||height<32||width>2048||height>2048||data.length!==width*height*4||height/width<1.35||height/width>1.6)return undefined;
 let intersection=0,observed=0,expected=0,red=0,dot=0,energy=0;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  let r=0,g=0,b=0,count=0;
  for(let sy=Math.floor(y*width/32);sy<Math.ceil((y+1)*width/32);sy++)for(let sx=Math.floor(x*width/32);sx<Math.ceil((x+1)*width/32);sx++){
   const i=(sy*width+sx)*4;if(data[i+3]<250)return undefined;
   r+=data[i];g+=data[i+1];b+=data[i+2];count++;
  }
  r/=count;g/=count;b/=count;
  if(r>150&&r-g>70&&r-b>70)red++;
  // Match the hose and cabinet interior, excluding the outer sheet border.
  if(x<4||x>27||y<4||y>27)continue;
  const white=Math.min(r,g,b)>170,reference=fireHoseTemplate[y][x]==='1';
  const tone=Math.min(r,g,b),referenceTone=parseInt(fireHoseTones[y].slice(x*2,x*2+2),16);
  dot+=tone*referenceTone;energy+=tone*tone+referenceTone*referenceTone;
  if(white)observed++;if(reference)expected++;if(white&&reference)intersection++;
 }
 const similarity=2*intersection/(observed+expected);
 // Continuous tones retain anti-aliased hose edges that cross the binary cutoff
 // on small page renderings. Still require substantial binary shape agreement.
 const appearanceSimilarity=2*dot/energy;
 return {similarity,appearanceSimilarity,redFraction:red/1024};
}
export function matchFireHoseSymbol(data:Uint8ClampedArray,width:number,height:number){
 const score=scoreFireHoseSymbol(data,width,height);
 return score&&score.redFraction>=.45&&(score.similarity>=.9||(score.similarity>=.8&&score.appearanceSimilarity>=.96))?{templateId:'paragon-hose-reel-v1' as const,similarity:score.similarity}:undefined;
}

export function mergeSignSymbol(labels:PlanLabel[],box:PlanLabel['box'],match:ReturnType<typeof matchFireHoseSymbol>):PlanLabel[]{
 if(!match)return labels;
 const overlaps=(b:PlanLabel['box'])=>Math.min(box.x+box.width,b.x+b.width)>Math.max(box.x,b.x)&&Math.min(box.y+box.height,b.y+b.height)>Math.max(box.y,b.y);
 // Preserve an existing annotation, including a user's explicit dismissal.
 if(labels.some(l=>['fire-hydrant','fire-extinguisher'].includes(l.kind)&&overlaps(l.box)))return labels;
 let id='symbol:fire-hose';for(let i=1;labels.some(l=>l.id===id);i++)id=`symbol:fire-hose:${i}`;
 if(labels.length>=500)return labels;
 return [...labels,{id,kind:'fire-hydrant',source:'symbol',status:'unreviewed',text:'소화전 · 호스 릴 표지',box:{...box},note:`기호 대조 검출 (${match.templateId}). 문자 판독 결과가 아닙니다. 상자는 표지 위치이며 설비의 실제 크기·접근 여유 공간은 미확인입니다.`}];
}
