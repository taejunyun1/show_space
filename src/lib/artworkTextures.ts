import {SRGBColorSpace,TextureLoader,type Texture} from 'three';
type Load=(url:string,ready:(texture:Texture)=>void,failed:(error:unknown)=>void)=>void;

/** Share only identical image/UV variants, and release GPU storage at the last consumer. */
export function createArtworkTexturePool(load:Load){
 const entries=new Map<string,{refs:number;texture?:Texture;promise:Promise<Texture>}>();
 return (url:string,panel:number|null=null)=>{
  const key=JSON.stringify([url,panel]);let entry=entries.get(key);
  if(!entry){
   let ready!:(texture:Texture)=>void,failed!:(error:unknown)=>void;
   entry={refs:0,promise:new Promise<Texture>((resolve,reject)=>{ready=resolve;failed=reject;})};entries.set(key,entry);
   const current=entry;
   try{load(url,texture=>{
    texture.colorSpace=SRGBColorSpace;
    if(panel!==null){texture.repeat.set(.2,1);texture.offset.set(panel*.2,0);}
    texture.needsUpdate=true;current.texture=texture;
    if(entries.get(key)!==current)texture.dispose();
    ready(texture);
   },error=>{if(entries.get(key)===current)entries.delete(key);failed(error);});}
   catch(error){entries.delete(key);failed(error);}
  }
  const current=entry;current.refs++;let released=false;
  return {promise:current.promise,release:()=>{if(released)return;released=true;current.refs--;if(current.refs===0){if(entries.get(key)===current)entries.delete(key);current.texture?.dispose();}}};
 };
}
export const acquireArtworkTexture=createArtworkTexturePool((url,ready,failed)=>{new TextureLoader().load(url,ready,undefined,failed);});
