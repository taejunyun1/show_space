export type Matrix6=[number,number,number,number,number,number];
export interface PdfImagePlacement {id:string;matrix:Matrix6}
const multiply=(a:Matrix6,b:Matrix6):Matrix6=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
/** Track image transforms; callers must corroborate visibility against the
 * rendered page because clipping and optional-content visibility are not inferred. */
export function pdfImagePlacements(ops:{fnArray:number[];argsArray:unknown[][]},codes:Record<string,number>,viewport:Matrix6):PdfImagePlacement[]{
 let matrix:Matrix6=[...viewport];const stack:Matrix6[]=[],result:PdfImagePlacement[]=[];
 for(let i=0;i<ops.fnArray.length;i++){
  const op=ops.fnArray[i],args=ops.argsArray[i]??[];
  if(op===codes.save||op===codes.paintFormXObjectBegin){stack.push([...matrix]);if(op===codes.paintFormXObjectBegin&&Array.isArray(args[0]))matrix=multiply(matrix,args[0] as Matrix6);}
  else if(op===codes.restore||op===codes.paintFormXObjectEnd){matrix=stack.pop()??[...viewport];}
  else if(op===codes.transform&&args.length===6)matrix=multiply(matrix,args as Matrix6);
  else if(op===codes.paintImageXObject&&typeof args[0]==='string'&&matrix.every(Number.isFinite))result.push({id:args[0],matrix:[...matrix]});
 }
 return result;
}
export function imagePlacementBox(m:Matrix6){
 const x=[m[4],m[0]+m[4],m[2]+m[4],m[0]+m[2]+m[4]],y=[m[5],m[1]+m[5],m[3]+m[5],m[1]+m[3]+m[5]];
 return {x:Math.min(...x),y:Math.min(...y),width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)};
}
