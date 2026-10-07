import {createContext,useContext} from 'react';
export interface ReadonlyAssets {images:ReadonlyMap<string,string>;models:ReadonlyMap<string,string>}
/** Local presentation assets never fall through to public share endpoints. */
export const ReadonlyAssetsContext=createContext<ReadonlyAssets|null>(null);
export const useReadonlyAssets=()=>useContext(ReadonlyAssetsContext);
export function readonlyImageUrl(shareId:string,imageId:string,assets:ReadonlyAssets|null){
 return assets?assets.images.get(imageId):`/api/public/${shareId}/images/${imageId}`;
}
