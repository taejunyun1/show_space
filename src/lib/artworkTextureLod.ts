export const ARTWORK_TEXTURE_BUDGET = 192 * 1024 * 1024;
export type TextureRequest = {id:string;key:string;visible:boolean;selected:boolean;pixels:number;previous?:number};
export function textureBytes(edge:number){return Math.ceil(edge*edge*4*4/3);}
/** Finish downgrades before adding high-detail maps on another part of the venue. */
export function stageArtworkTextureSizes(target:Map<string,number>,applied:Map<string,number>){
 const lowering=[...target].some(([id,edge])=>(applied.get(id)??128)>edge);
 return lowering?new Map([...target].map(([id,edge])=>[id,Math.min(edge,applied.get(id)??128)])):target;
}

/** Conservative square RGBA+mip budget. Identical image/UV consumers share a tier. */
export function allocateArtworkTextures(requests:TextureRequest[],budget=ARTWORK_TEXTURE_BUDGET){
 const unique=new Map<string,TextureRequest>();
 for(const r of requests){const old=unique.get(r.key);unique.set(r.key,old?{...old,visible:old.visible||r.visible,selected:old.selected||r.selected,pixels:Math.max(old.pixels,r.pixels),previous:Math.max(old.previous??0,r.previous??0)}:{...r});}
 let base=512;
 while(base>32&&[...unique.values()].reduce((sum,r)=>sum+textureBytes(r.visible?base:Math.min(base,128)),0)>budget*.9)base/=2;
 const sizes=new Map([...unique.values()].map(r=>[r.key,r.visible?base:Math.min(base,128)]));
 let used=[...sizes.values()].reduce((sum,edge)=>sum+textureBytes(edge),0);
 const sorted=[...unique.values()].filter(r=>r.visible).sort((a,b)=>Number(b.selected)-Number(a.selected)||b.pixels-a.pixels||a.key.localeCompare(b.key));
 for(const r of sorted){
  const pixels=Number.isFinite(r.pixels)?Math.max(0,r.pixels):0;
  const desired=r.selected||pixels>768||(r.previous===2048&&pixels>640)?2048:pixels>384||(r.previous===1024&&pixels>320)?1024:base;
  const current=sizes.get(r.key)!;
  for(const edge of [2048,1024,512,256,128,64,32])if(edge<=desired&&edge>current&&used+textureBytes(edge)-textureBytes(current)<=budget){used+=textureBytes(edge)-textureBytes(current);sizes.set(r.key,edge);break;}
 }
 return {sizes:new Map(requests.map(r=>[r.id,sizes.get(r.key)!])),bytes:used};
}

/** Crop demo sprite panels before resizing so each panel retains its own pixel density. */
export function artworkDerivativeLayout(width:number,height:number,panel:number|null,maxSide:number){
 const sourceWidth=panel===null?width:width/5,scale=Math.min(1,maxSide/Math.max(sourceWidth,height));
 return {x:panel===null?0:panel*sourceWidth,sourceWidth,sourceHeight:height,width:Math.max(1,Math.round(sourceWidth*scale)),height:Math.max(1,Math.round(height*scale))};
}
