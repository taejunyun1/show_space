export function testGlb(patch:Record<string,unknown>={}):ArrayBuffer{
 const data=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},meshes:[{primitives:[]}],...patch}));
 const padded=Math.ceil(data.length/4)*4,buffer=new ArrayBuffer(20+padded),view=new DataView(buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);
 new Uint8Array(buffer,20).fill(32);new Uint8Array(buffer,20,data.length).set(data);return buffer;
}
