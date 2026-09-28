export interface ViewportBox {x:number;z:number;width:number;height:number}

export function panViewport(view:ViewportBox,drag:{x:number;y:number},pixelsPerUnit:number):ViewportBox{
  if(!Number.isFinite(pixelsPerUnit)||pixelsPerUnit<=0)throw new Error('화면 이동 배율이 올바르지 않습니다.');
  return {...view,x:view.x-drag.x/pixelsPerUnit,z:view.z-drag.y/pixelsPerUnit};
}
