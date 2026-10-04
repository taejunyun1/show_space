import {useEffect,useState} from 'react';
import {useThree} from '@react-three/fiber';
import type {Texture} from 'three';
import {acquireArtworkTexture} from '../lib/artworkTextures';
export function useArtworkTexture(url:string,panel:number|null=null):{texture?:Texture;failed?:boolean}{
 const {invalidate}=useThree();const key=JSON.stringify([url,panel]);
 const [loaded,setLoaded]=useState<{key:string;texture?:Texture;failed?:boolean}>();
 useEffect(()=>{let active=true;const asset=acquireArtworkTexture(url,panel);void asset.promise.then(texture=>{if(active){setLoaded({key,texture});invalidate();}},()=>{if(active){setLoaded({key,failed:true});invalidate();}});return()=>{active=false;asset.release();};},[url,panel,key,invalidate]);
 return loaded?.key===key?loaded:{};
}
