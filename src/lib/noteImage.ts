import {readImage} from './art';
import {noteImageBytes,type NoteImage} from '../domain/notes';
export async function readNoteImage(file:File):Promise<NoteImage>{
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const starts=(v:number[])=>v.every((n,i)=>bytes[i]===n);
 const valid=file.type==='image/png'?starts([137,80,78,71,13,10,26,10]):file.type==='image/jpeg'?starts([255,216,255]):file.type==='image/webp'&&starts([82,73,70,70])&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(!valid)throw new Error('메모 이미지는 실제 JPG·PNG·WebP 파일을 선택해주세요.');
 const imageUrl=await readImage(file);noteImageBytes(imageUrl);return {id:crypto.randomUUID(),name:file.name.slice(0,200),imageUrl};
}
