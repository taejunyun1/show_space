/** Decode into an owned buffer without Array.from's per-byte mapper/iterator. */
export function base64Bytes(value:string):Uint8Array<ArrayBuffer>{
 const binary=atob(value),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
