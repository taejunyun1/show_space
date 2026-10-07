import {videoScreenLayout,type VideoArtwork} from '../domain/mediaArtwork';
import type {Artwork} from '../domain/types';

/** One poster can have different framing in the current layout and saved Scenes. */
export function pdfArtworkImageKey(art:Pick<Artwork,'imageUrl'|'widthMm'|'heightMm'|'video'>){
 return art.video?JSON.stringify(['video-poster',art.imageUrl,art.widthMm/art.heightMm,art.video.widthPx,art.video.heightPx,art.video.fit]):art.imageUrl;
}

export function videoPosterRect(width:number,height:number,video:Pick<VideoArtwork,'widthPx'|'heightPx'|'fit'>){
 const layout=videoScreenLayout(width,height,video.widthPx,video.heightPx,video.fit);
 return {sx:layout.offset[0]*video.widthPx,sy:layout.offset[1]*video.heightPx,sw:layout.repeat[0]*video.widthPx,sh:layout.repeat[1]*video.heightPx,dx:(width-layout.widthMm)/2,dy:(height-layout.heightMm)/2,dw:layout.widthMm,dh:layout.heightMm};
}

/** Bake static framing for PDF; the original poster and embedded video stay untouched. */
export function framedVideoPoster(source:CanvasImageSource,widthMm:number,heightMm:number,video:VideoArtwork):HTMLCanvasElement{
 const scale=2048/Math.max(widthMm,heightMm),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(widthMm*scale));canvas.height=Math.max(1,Math.round(heightMm*scale));
 const context=canvas.getContext('2d');if(!context)throw new Error('영상 포스터를 만들 수 없습니다.');
 const r=videoPosterRect(canvas.width,canvas.height,video);
 context.fillStyle='#000000';context.fillRect(0,0,canvas.width,canvas.height);
 // Export texture may be downsampled. Source crop coordinates follow its real dimensions.
 const image=source as HTMLCanvasElement,fx=image.width/video.widthPx,fy=image.height/video.heightPx;
 context.drawImage(source,r.sx*fx,r.sy*fy,r.sw*fx,r.sh*fy,r.dx,r.dy,r.dw,r.dh);
 return canvas;
}
