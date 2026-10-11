import {MODEL_MAX_BYTES} from './glbPayload';
type Row=Record<string,unknown>;
// GLTFLoader copies each referenced bufferView, even when several views overlap
// the same source bytes. This bounds CPU vertex-buffer copies, not total VRAM.
export const MODEL_VERTEX_COPY_MAX_BYTES=4*MODEL_MAX_BYTES;
const componentBytes:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const components:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
function elementBytes(a:Row){
 const size=componentBytes[Number(a.componentType)],type=String(a.type);
 if(type.startsWith('MAT')){const columns=Number(type.slice(3));return columns*Math.ceil(columns*size/4)*4;}
 return size*components[type];
}
/** Run after the existing accessor-count/primitive/instance limits. */
export function inspectModelAccessorRanges(accessors:Row[],views:Row[],buffers:Row[],meshes:Row[]){
 const invalid=()=>{throw new Error('모델 정점 버퍼의 범위·간격이 올바르지 않습니다. 원본 모델을 다시 내보내세요.');};
 for(const v of views){
  const start=v.byteOffset??0,length=v.byteLength,b=buffers[Number(v.buffer)];
  if(!Number.isSafeInteger(v.buffer)||!b||!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||Number(start)<0||Number(length)<=0||!Number.isSafeInteger(b.byteLength)||Number(start)+Number(length)>Number(b.byteLength))throw new Error('모델 버퍼 범위가 올바르지 않습니다.');
  if(v.byteStride!==undefined&&(!Number.isInteger(v.byteStride)||Number(v.byteStride)<4||Number(v.byteStride)>252||Number(v.byteStride)%4||Number(v.byteStride)>Number(length)))invalid();
 }
 for(const a of accessors){
  const v=views[Number(a.bufferView)],size=componentBytes[Number(a.componentType)],element=elementBytes(a),offset=a.byteOffset??0,stride=v.byteStride??element;
  if(!Number.isSafeInteger(offset)||Number(offset)<0||Number(offset)%size||Number(v.byteOffset??0)%size||Number(stride)<element||Number(offset)+(Number(a.count)-1)*Number(stride)+element>Number(v.byteLength))invalid();
 }
 const referenced=new Set<number>();
 for(const mesh of meshes)for(const p of mesh.primitives as Row[]){
  const attrs=p.attributes as Row,position=accessors[Number(attrs.POSITION)];
  for(const index of Object.values(attrs)){
   const a=accessors[Number(index)];if(!Number.isInteger(index)||!a||a.count!==position.count)throw new Error('모델 정점 속성의 연결·수가 올바르지 않습니다. 원본 모델을 다시 내보내세요.');
   referenced.add(Number(a.bufferView));
  }
  if(p.indices!==undefined)referenced.add(Number(accessors[Number(p.indices)].bufferView));
 }
 let copies=0;for(const index of referenced){const v=views[index],stride=Number(v.byteStride??1);copies+=Math.ceil(Number(v.byteLength)/stride)*stride;if(copies>MODEL_VERTEX_COPY_MAX_BYTES)throw new Error('모델 정점 자산의 중복 버퍼가 너무 큽니다. 모델을 단순화하거나 나누어 다시 내보내세요.');}
}
