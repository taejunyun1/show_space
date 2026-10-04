import {SRGBColorSpace,TextureLoader,type Texture} from 'three';
import {artworkDerivativeLayout} from './artworkTextureLod';
type Load=(url:string,ready:(texture:Texture)=>void,failed:(error:unknown)=>void,maxSide?:number,panel?:number|null)=>void|(()=>void);

/** Share only identical image/UV variants, and release GPU storage at the last consumer. */
export function createArtworkTexturePool(load:Load){
 const entries=new Map<string,{refs:number;texture?:Texture;promise:Promise<Texture>;cancel?:void|(()=>void)}>();
 return (url:string,panel:number|null=null,maxSide?:number)=>{
  const key=JSON.stringify([url,panel,maxSide??null]);let entry=entries.get(key);
  if(!entry){
   let ready!:(texture:Texture)=>void,failed!:(error:unknown)=>void;
   entry={refs:0,promise:new Promise<Texture>((resolve,reject)=>{ready=resolve;failed=reject;})};entries.set(key,entry);
   const current=entry;
   try{current.cancel=load(url,texture=>{
    texture.colorSpace=SRGBColorSpace;
    if(panel!==null&&maxSide===undefined){texture.repeat.set(.2,1);texture.offset.set(panel*.2,0);}
    texture.needsUpdate=true;current.texture=texture;
    if(entries.get(key)!==current)texture.dispose();
    ready(texture);
   },error=>{if(entries.get(key)===current)entries.delete(key);failed(error);},maxSide,panel);}
   catch(error){entries.delete(key);failed(error);}
  }
  const current=entry;current.refs++;let released=false;
  return {promise:current.promise,release:()=>{if(released)return;released=true;current.refs--;if(current.refs===0){if(entries.get(key)===current)entries.delete(key);current.cancel?.();current.texture?.dispose();}}};
 };
}
const pending:Array<()=>void>=[];let active=0;
function drain(){while(active<4&&pending.length){active++;pending.shift()!();}}
export const acquireArtworkTexture=createArtworkTexturePool((url,ready,failed,maxSide,panel)=>{
 let started=false;
 const job=()=>{started=true;
  const done=()=>{active--;drain();};
  try{new TextureLoader().load(url,texture=>{
   try{
    if(maxSide!==undefined){
     const image=texture.image as HTMLImageElement,layout=artworkDerivativeLayout(image.width,image.height,panel??null,maxSide);
     const canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
     const context=canvas.getContext('2d');if(!context)throw new Error('작품 미리보기 이미지를 만들지 못했습니다.');
     context.drawImage(image,layout.x,0,layout.sourceWidth,layout.sourceHeight,0,0,layout.width,layout.height);
     texture.image=canvas;
    }
    ready(texture);
   }catch(error){texture.dispose();failed(error);}finally{done();}
  },undefined,error=>{failed(error);done();});}catch(error){failed(error);done();}
 };pending.push(job);drain();
 return ()=>{if(!started){const index=pending.indexOf(job);if(index>=0){pending.splice(index,1);failed(new Error('작품 미리보기 요청이 취소됐습니다.'));}}};
});
