import {base64Bytes} from './base64Bytes';
import {inspectStaticArtworkGlb} from './artworkModelPayload';
import {MODEL_MAX_BYTES} from './glbPayload';
export function localPresentationModelBytes(url:string){
 if(!/^data:model\/gltf-binary;base64,[A-Za-z0-9+/]+={0,2}$/.test(url)||url.length>MODEL_MAX_BYTES*4/3+100)throw new Error('발표 모델 데이터가 올바르지 않습니다.');
 const bytes=base64Bytes(url.split(',')[1]).buffer;
 inspectStaticArtworkGlb(bytes);return bytes;
}
