import type {VideoArtwork} from '../domain/mediaArtwork';

export type VideoPosterMetadata=Pick<VideoArtwork,'widthPx'|'heightPx'|'fit'>;

/** The same centred contain/cover framing as the live 3D screen, without video sources. */
export function VideoPosterSvg({url,x,y,width,height,video,onError}:{url:string;x:number;y:number;width:number;height:number;video:VideoPosterMetadata;onError?:()=>void}){
 return <g pointerEvents="none" data-video-fit={video.fit}>
  <rect x={x} y={y} width={width} height={height} fill="#000000"/>
  <svg x={x} y={y} width={width} height={height} viewBox={`0 0 ${video.widthPx} ${video.heightPx}`} preserveAspectRatio={video.fit==='cover'?'xMidYMid slice':'xMidYMid meet'} overflow="hidden">
   <image data-video-poster href={url} x={0} y={0} width={video.widthPx} height={video.heightPx} preserveAspectRatio="none" onError={onError}/>
  </svg>
 </g>;
}
