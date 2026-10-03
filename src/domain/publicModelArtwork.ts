import type {ModelArtwork} from './types';
import type {PublicModelArtwork} from './publicShare';
/** A render-only pose with no editor command state or private metadata. */
export function publicModelArtworkPose(a:PublicModelArtwork):ModelArtwork{return {...a,model:{name:a.name,dataUrl:'',sizeMm:a.sizeMm,sourceOffsetM:a.sourceOffsetM},visible:true,locked:true,note:''};}
