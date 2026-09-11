import type {prepareMappedVenue} from '../domain/mappedVenue';
type Prepared=NonNullable<ReturnType<typeof prepareMappedVenue>>;
/** Re-rasterize source cells into the scalar reference shared by all mapped layers. */
export async function renderMappedPlan(imageUrl:string,prepared:Prepared,signal:AbortSignal):Promise<string>{
 const image=new Image(),canvas=document.createElement('canvas');
 const aborted=()=>{if(signal.aborted)throw new Error('도면 좌표 변환을 취소했습니다.');};
 const cancel=()=>{image.src='';};signal.addEventListener('abort',cancel,{once:true});
 try{
  aborted();image.src=imageUrl;await image.decode();aborted();
  const ref=prepared.layers.planReference!;
  if(ref.widthPx<=0||ref.heightPx<=0||ref.widthPx>2400||ref.heightPx>2400)throw new Error('변환 도면 크기가 범위를 벗어났습니다.');
  canvas.width=ref.widthPx;canvas.height=ref.heightPx;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('변환 도면을 만들 수 없습니다.');
  ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const cell of prepared.cells){
   const s=cell.source,t=cell.target;
   if(s.x<0||s.y<0||s.width<=0||s.height<=0||s.x+s.width>image.naturalWidth||s.y+s.height>image.naturalHeight)throw new Error('변환 영역이 원본을 벗어났습니다.');
   ctx.drawImage(image,s.x,s.y,s.width,s.height,t.x,t.y,t.width,t.height);
  }
  aborted();const result=canvas.toDataURL('image/png');
  if(result.length>12*1024*1024)throw new Error('변환 도면이 저장 한도를 넘습니다.');
  return result;
 }finally{signal.removeEventListener('abort',cancel);image.src='';canvas.width=canvas.height=0;}
}
