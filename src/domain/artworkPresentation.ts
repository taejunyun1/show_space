/** Stored dimensions describe the image/body. Framing adds a symmetric border. */
export interface FrameSettings {widthMm:number;depthMm:number;material:'wood'|'metal'|'paint';matWidthMm:number;matColor:string;cover:'none'|'glass'|'acrylic'}
export interface PresentedArtwork {widthMm:number;heightMm:number;depthMm:number;frame:'black'|'natural'|'white'|'none';frameSettings?:FrameSettings;rotationDeg?:number}
export const frameColors={black:'#282827',natural:'#b9a383',white:'#f5f4ef',none:'#eee8dc'};
export const framePresets={
 slim:{label:'슬림 액자',widthMm:15,depthMm:25,material:'metal',matWidthMm:0,matColor:'#f5f4ef',cover:'none'},
 gallery:{label:'갤러리 매트',widthMm:22.5,depthMm:40,material:'wood',matWidthMm:60,matColor:'#f5f4ef',cover:'glass'},
 deep:{label:'깊은 액자',widthMm:30,depthMm:70,material:'paint',matWidthMm:40,matColor:'#f5f4ef',cover:'acrylic'},
} satisfies Record<string,FrameSettings&{label:string}>;
export function parseFrameSettings(value:unknown):FrameSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('액자 설정 형식이 올바르지 않습니다.');
 const r=value as Record<string,unknown>;
 for(const [key,min,max] of [['widthMm',1,200],['depthMm',1,5000],['matWidthMm',0,500]] as const)if(typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<min||r[key]>max)throw new Error('액자 폭·깊이·매트 여백이 허용 범위를 벗어났습니다.');
 if(!['wood','metal','paint'].includes(r.material as string)||!['none','glass','acrylic'].includes(r.cover as string)||typeof r.matColor!=='string'||!/^#[0-9a-f]{6}$/i.test(r.matColor))throw new Error('액자 재질·매트 색·유리 설정이 올바르지 않습니다.');
 return {widthMm:r.widthMm as number,depthMm:r.depthMm as number,matWidthMm:r.matWidthMm as number,material:r.material as FrameSettings['material'],cover:r.cover as FrameSettings['cover'],matColor:r.matColor};
}
export function resolvedFrameSettings(a:PresentedArtwork):FrameSettings{return a.frameSettings??{widthMm:22.5,depthMm:a.depthMm,material:'wood',matWidthMm:0,matColor:'#f5f4ef',cover:'none'};}
export function artworkPresentation(a:PresentedArtwork){
 const framed=a.frame!=='none',settings=resolvedFrameSettings(a),border=framed?settings.widthMm+settings.matWidthMm:0;
 const widthMm=a.widthMm+border*2,heightMm=a.heightMm+border*2,depthMm=framed?Math.max(a.depthMm,settings.depthMm):a.depthMm;
 const innerWidthMm=a.widthMm+(framed?settings.matWidthMm*2:0),innerHeightMm=a.heightMm+(framed?settings.matWidthMm*2:0);
 const coverThicknessMm=framed&&settings.cover!=='none'?Math.min(settings.cover==='glass'?2:3,depthMm/4):0;
 // A 0.01mm image offset avoids coplanar flicker on a frameless body.
 const imageZMm=framed?depthMm/2-Math.min(depthMm/4,coverThicknessMm+1):depthMm/2+.01;
 return {framed,settings,widthMm,heightMm,depthMm,innerWidthMm,innerHeightMm,coverThicknessMm,imageZMm};
}
export function rotatedArtworkOuterSize(a:PresentedArtwork){
 const p=artworkPresentation(a),r=(a.rotationDeg??0)*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));
 return {widthMm:p.widthMm*(c<1e-10?0:c)+p.heightMm*(s<1e-10?0:s),heightMm:p.widthMm*(s<1e-10?0:s)+p.heightMm*(c<1e-10?0:c)};
}
/** Wall-mounted footprint uses the rotated outer width and real framing depth. */
export function artworkPlanSize(a:PresentedArtwork){return {...rotatedArtworkOuterSize(a),depthMm:artworkPresentation(a).depthMm};}

/** Physical bounds on a wall face, including rotation, frame and mat. */
export function artworkFaceBounds(a:PresentedArtwork&{alongMm:number;centerHeightMm:number}){const size=rotatedArtworkOuterSize(a);return {left:a.alongMm-size.widthMm/2,right:a.alongMm+size.widthMm/2,bottom:a.centerHeightMm-size.heightMm/2,top:a.centerHeightMm+size.heightMm/2,cx:a.alongMm,cy:a.centerHeightMm};}
