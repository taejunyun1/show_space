import {artworkPresentation,frameColors,type PresentedArtwork} from '../domain/artworkPresentation';
/** Same image/body and outer framing dimensions as the Three.js shell. */
export function ArtworkPresentationSvg({artwork:a,x,y,children}:{artwork:PresentedArtwork;x:number;y:number;children:React.ReactNode}){
 const p=artworkPresentation(a);
 return <g data-artwork-outer-width-mm={p.widthMm} data-artwork-outer-height-mm={p.heightMm}><rect x={x-p.widthMm/2} y={y-p.heightMm/2} width={p.widthMm} height={p.heightMm} fill={frameColors[a.frame]}/>{p.framed&&p.settings.matWidthMm>0&&<rect x={x-p.innerWidthMm/2} y={y-p.innerHeightMm/2} width={p.innerWidthMm} height={p.innerHeightMm} fill={p.settings.matColor}/>} {children}{p.coverThicknessMm>0&&<rect x={x-p.innerWidthMm/2} y={y-p.innerHeightMm/2} width={p.innerWidthMm} height={p.innerHeightMm} fill="#e6f0f5" fillOpacity={.055} pointerEvents="none"/>}</g>;
}
