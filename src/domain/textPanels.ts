import type {PlanLabel} from './planLabels';
import type {TextRegion} from './textStrokes';
/** Compact, uniformly colored caption backgrounds containing reliable text.
 * Geometry alone and color alone are insufficient: large room fills, pale
 * furniture fills and panels without text are not selected. */
export function detectTextPanels(data:Uint8ClampedArray,width:number,height:number,text:TextRegion[],labels:PlanLabel[]=[]):TextRegion[]{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1600||height>1600||data.length!==width*height*4)return [];
 const count=width*height,seen=new Uint8Array(count),queue=new Int32Array(count),result:TextRegion[]=[];
 const colored=(i:number)=>{const o=i*4,r=data[o],g=data[o+1],b=data[o+2];return data[o+3]>=250&&Math.max(r,g,b)<=220&&Math.max(r,g,b)-Math.min(r,g,b)>=40;};
 for(let seed=0;seed<count;seed++){
  if(seen[seed]||!colored(seed))continue;
  let head=0,tail=1,x0=width,y0=height,x1=0,y1=0,dominant=0;const palette=new Map<number,number>();queue[0]=seed;seen[seed]=1;
  while(head<tail){
   const i=queue[head++],x=i%width,y=Math.floor(i/width),o=i*4;
   x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);const color=(data[o]>>4)*256+(data[o+1]>>4)*16+(data[o+2]>>4),frequency=(palette.get(color)??0)+1;palette.set(color,frequency);dominant=Math.max(dominant,frequency);
   for(const n of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1])if(n>=0&&!seen[n]&&colored(n)){seen[n]=1;queue[tail++]=n;}
  }
  const w=x1-x0+1,h=y1-y0+1,area=w*h;
  if(w<40||h<12||w/h<1.8||w/h>15||area>count*.03||tail/area<.65||dominant/tail<.7)continue;
  if(labels.some(l=>l.status!=='dismissed'&&!['dimension','unit'].includes(l.kind)&&l.box.x<x1+2&&l.box.x+l.box.width>x0-1&&l.box.y<y1+2&&l.box.y+l.box.height>y0-1))continue;
  const contained=text.filter(t=>t.x>=x0-1&&t.y>=y0-1&&t.x+t.width<=x1+2&&t.y+t.height<=y1+2);
  if(!contained.length||contained.length>6||Math.max(...contained.map(t=>t.width))<w*.45||h>Math.max(...contained.map(t=>t.height))*(contained.length+1.8))continue;
  // A light surround distinguishes a detached caption from a colored wall band.
  let light=0,samples=0;
  for(let i=1;i<=12;i++)for(const [x,y] of [[Math.round(x0+w*i/13),y0-4],[Math.round(x0+w*i/13),y1+4],[x0-4,Math.round(y0+h*i/13)],[x1+4,Math.round(y0+h*i/13)]]){
   if(x<0||y<0||x>=width||y>=height)continue;
   const o=(y*width+x)*4;if(Math.min(data[o],data[o+1],data[o+2])>=230)light++;samples++;
  }
  if(samples<40||light/samples<.9)continue;
  const x=Math.max(0,x0-2),y=Math.max(0,y0-2);
  result.push({x,y,width:Math.min(width,x1+3)-x,height:Math.min(height,y1+3)-y});
 }
 return result;
}
