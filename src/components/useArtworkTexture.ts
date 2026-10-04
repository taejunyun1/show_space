import {useEffect,useRef,useState} from 'react';
import {useThree} from '@react-three/fiber';
import type {Texture} from 'three';
import {acquireArtworkTexture} from '../lib/artworkTextures';
export function useArtworkTexture(url:string,panel:number|null=null,maxSide?:number):{texture?:Texture;failed?:boolean;ready:boolean;appliedSize?:number}{
 const {invalidate}=useThree();const key=JSON.stringify([url,panel,maxSide??null]),sourceKey=JSON.stringify([url,panel]);
 const leases=useRef(new Map<string,ReturnType<typeof acquireArtworkTexture>>()),wanted=useRef(key);wanted.current=key;
 const shown=useRef<string|undefined>(undefined);
 const [loaded,setLoaded]=useState<{key:string;sourceKey:string;texture?:Texture;failed?:boolean;maxSide?:number}>();
 useEffect(()=>{let active=true,settled=false;const asset=leases.current.get(key)??acquireArtworkTexture(url,panel,maxSide);leases.current.set(key,asset);
  void asset.promise.then(texture=>{settled=true;if(active){setLoaded({key,sourceKey,texture,maxSide});invalidate();}else if(shown.current!==key&&wanted.current!==key){asset.release();if(leases.current.get(key)===asset)leases.current.delete(key);}},()=>{settled=true;if(active){setLoaded({key,sourceKey,failed:true});invalidate();}});
  return()=>{active=false;if(!settled&&shown.current!==key){asset.release();if(leases.current.get(key)===asset)leases.current.delete(key);}};
 },[url,panel,maxSide,key,sourceKey,invalidate]);
 // Retain the old tier until React has attached its replacement to the material.
 useEffect(()=>{shown.current=loaded?.key;for(const [k,asset] of leases.current)if(k!==loaded?.key&&k!==wanted.current){asset.release();leases.current.delete(k);}},[loaded]);
 useEffect(()=>()=>{for(const asset of leases.current.values())asset.release();leases.current.clear();shown.current=undefined;},[]);
 return loaded?.sourceKey===sourceKey?{texture:loaded.texture,failed:loaded.key===key&&loaded.failed,ready:loaded.key===key&&!!loaded.texture,appliedSize:loaded.maxSide}:{ready:false};
}
