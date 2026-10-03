export const MODEL_MAX_BYTES=12*1024*1024;
export function inspectGlb(buffer:ArrayBuffer){
 if(buffer.byteLength<20||buffer.byteLength>MODEL_MAX_BYTES)throw new Error('GLB 모델은 올바른 파일이며 12MB 이하여야 합니다.');
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw new Error('지원하는 GLB 2.0 파일이 아닙니다.');
 const length=view.getUint32(12,true);
 if(view.getUint32(16,true)!==0x4e4f534a||length%4||20+length>buffer.byteLength)throw new Error('GLB 모델의 구조 정보가 손상됐습니다.');
 let json;try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));}catch{throw new Error('GLB 모델 정보를 읽을 수 없습니다.');}
 if(!json||typeof json!=='object'||json.asset?.version!=='2.0'||!Array.isArray(json.meshes)||!json.meshes.length)throw new Error('GLB 모델에 표시할 형상이 없습니다.');
 if((json.nodes?.length??0)>5000||json.meshes.length>2000)throw new Error('모델 객체가 너무 많습니다. 스케치업에서 모델을 단순화한 뒤 다시 내보내세요.');
 for(const item of json.buffers??[])if(item.uri!==undefined)throw new Error('외부 파일을 참조하는 모델입니다. 모든 자산을 포함한 GLB로 내보내세요.');
 for(const image of json.images??[])if(image.uri!==undefined&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.uri))throw new Error('모델 텍스처를 파일 안에 포함해 GLB로 내보내세요.');
 if((json.extensionsRequired??[]).some((name:string)=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(name)))throw new Error('압축 모델은 아직 지원하지 않습니다. 압축하지 않은 GLB로 내보내세요.');
 return json;
}
