import JSZip from 'jszip';
import type {Project} from '../domain/types';

interface GltfBuffer {uri?:string;byteLength:number}
interface GltfImage {uri?:string;mimeType?:string;bufferView?:number}
interface GltfDocument {asset:{version:string};buffers?:GltfBuffer[];images?:GltfImage[];[key:string]:unknown}

function embeddedBytes(uri:unknown,allowed:string[]){
 if(typeof uri!=='string')throw new Error('glTF 자산을 읽지 못했습니다.');
 const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
 if(!match||!allowed.includes(match[1]))throw new Error('glTF 자산이 파일에 포함되지 않았습니다.');
 try{return {mime:match[1],bytes:Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))};}
 catch{throw new Error('glTF 자산 데이터가 손상됐습니다.');}
}

/** Move embedded data to portable, relative filenames without changing scene indices. */
export function createGltfFiles(input:Record<string,unknown>,project:Project){
 const doc=structuredClone(input) as unknown as GltfDocument;
 if(doc.asset?.version!=='2.0')throw new Error('glTF 2.0 데이터를 만들지 못했습니다.');
 const files=new Map<string,Uint8Array>(),encode=(value:string)=>new TextEncoder().encode(value);
 for(const [i,buffer] of (doc.buffers??[]).entries()){
  const {bytes}=embeddedBytes(buffer.uri,['application/octet-stream','application/gltf-buffer']);
  if(!Number.isSafeInteger(buffer.byteLength)||buffer.byteLength!==bytes.byteLength)throw new Error('glTF 바이너리 크기가 일치하지 않습니다.');
  const name=`buffers/buffer-${i+1}.bin`;files.set(name,bytes);buffer.uri=name;
 }
 const images=new Map<string,string>(),extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
 for(const image of doc.images??[]){
  if(image.uri===undefined&&Number.isSafeInteger(image.bufferView))continue;
  const source=image.uri!,{mime,bytes}=embeddedBytes(source,Object.keys(extensions));
  if(image.mimeType&&image.mimeType!==mime)throw new Error('glTF 이미지 형식이 일치하지 않습니다.');
  let name=images.get(source);if(!name){name=`textures/image-${images.size+1}.${extensions[mime]}`;images.set(source,name);files.set(name,bytes);}
  image.uri=name;image.mimeType=mime;
 }
 files.set('scene.gltf',encode(JSON.stringify(doc,null,2)));
 const report={format:'gonggan-gltf-export',version:1,projectName:project.name,units:'meter',entry:'scene.gltf',
  counts:{nodes:Array.isArray(doc.nodes)?doc.nodes.length:0,meshes:Array.isArray(doc.meshes)?doc.meshes.length:0,materials:Array.isArray(doc.materials)?doc.materials.length:0,images:doc.images?.length??0},
  files:[...files].map(([path,bytes])=>({path,bytes:bytes.byteLength})),
  included:['표시 중인 벽과 실제 바닥','배치 작품·프레임·이미지와 표시 중인 3D 작품 원본 형상·재질','표시 중인 원본 참고 모델','실제 크기·위치·회전·배율','기본 PBR 색·거칠기·금속성·투과·코팅·천 광택 속성','벽·바닥 표면 텍스처·실제 크기 기반 UV와 반복 설정','표시 중인 Spot 조명과 야외 태양·조준 방향·색온도 RGB·강도(KHR_lights_punctual)'],
  omitted:['직접 숨긴 객체·미배치 작품','원본 도면·앱 내부 메모·다른 Scene','치수선·문/설비 안내선·설치 제외 표시','Area 조명·환경/보조광·그림자 설정·위치/날짜/시간 환경 설정','편집기 카메라·격자·선택 핸들'],
  notes:['Area 조명은 glTF 표준 광원으로 표현할 수 없어 제외합니다. 조명 전체 편집 복원에는 프로젝트 JSON/자산 백업을 사용하세요.','환경 반사 조명은 포함하지 않습니다. 유리·거울·반사는 여는 프로그램의 조명/재질 확장 지원에 따라 달라집니다.','벽 자동 숨김은 적용하지 않습니다.','작품 이미지·벽/바닥 표면 텍스처·참고 모델·3D 작품 텍스처는 긴 변 최대 1024px입니다.','앱의 원본 편집 데이터를 복원하려면 프로젝트 JSON을 사용하세요. 원본 참고 모델 안의 메타데이터는 유지될 수 있습니다.']};
 files.set('export-report.json',encode(JSON.stringify(report,null,2)));
 files.set('읽어주세요.txt',encode('공간 · glTF 3D 교환 파일\n\n압축을 모두 풀고 scene.gltf를 glTF 2.0을 지원하는 프로그램에서 여세요.\nbuffers/와 textures/ 폴더를 같은 위치에 유지해야 형상과 이미지가 표시됩니다.\n실제 치수 단위는 미터(m)입니다. 자세한 포함/제외 범위는 export-report.json에 있습니다.\n\n영상 스크린은 썸네일 정지 화면으로 내보냅니다. 영상 원본과 재생 설정은 프로젝트 JSON 또는 자산 백업 ZIP에 보존됩니다.\n이 묶음은 3D 형상 전달용입니다. 공간 참고 모델로 다시 불러오려면 GLB로 내보내기를 사용하세요. 3D 작품 추가에서는 정적 GLB·glTF ZIP을 12MB 이하로 가져올 수 있습니다.\n앱의 벽·작품·메모·Scene 편집 복원에는 별도의 프로젝트 JSON을 사용하세요.\n'));
 return files;
}

export async function zipGltfFiles(files:Map<string,Uint8Array>,onProgress:(message:string)=>void=()=>{}):Promise<Blob>{
 const zip=new JSZip();for(const [name,bytes] of files)zip.file(name,bytes);
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:3}},metadata=>onProgress(`glTF 파일 묶는 중 · ${Math.round(metadata.percent)}%`));
 return new Blob([bytes.slice().buffer as ArrayBuffer],{type:'application/octet-stream'});
}
