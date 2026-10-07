import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDemoProject} from '../domain/model';
import {installationDrawing} from '../domain/readonlyDrawing';
import {SharedElevation} from '../components/SharedViewer';
import {VideoPosterSvg} from '../components/VideoPosterSvg';
import {pdfArtworkImageKey,videoPosterRect} from './videoPoster';
import type {VideoArtwork} from '../domain/mediaArtwork';

const video:VideoArtwork={dataUrl:'PRIVATE_VIDEO_SOURCE',widthPx:640,heightPx:360,durationSeconds:4,loop:true,fit:'contain'};

it('preserves a 16:9 video inside a square with black bars, and centrally crops cover without distortion',()=>{
 expect(videoPosterRect(1200,1200,video)).toEqual({sx:0,sy:0,sw:640,sh:360,dx:0,dy:262.5,dw:1200,dh:675});
 expect(videoPosterRect(1200,1200,{...video,fit:'cover'})).toEqual({sx:140,sy:0,sw:360,sh:360,dx:0,dy:0,dw:1200,dh:1200});
 // Portrait input inside a landscape screen crops vertically, rather than using bottom-origin UV coordinates.
 const portrait={...video,widthPx:360,heightPx:640,fit:'cover' as const};
 expect(videoPosterRect(1600,900,portrait)).toEqual({sx:0,sy:218.75,sw:360,sh:202.5,dx:0,dy:0,dw:1600,dh:900});
});

it('renders fitted editor/field/public elevation posters and strips the private video from drawing data',()=>{
 const p=createDemoProject();p.artworks=[{...p.artworks[0],imageUrl:'data:image/png;base64,poster',video,widthMm:1200,heightMm:1200,rotationDeg:15}];
 const snapshot=installationDrawing(p),editor=renderToStaticMarkup(<g transform="rotate(-15)"><VideoPosterSvg url={p.artworks[0].imageUrl} x={0} y={0} width={1200} height={1200} video={video}/></g>),field=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId={p.walls[0].id} side="front" selectedId={null} onSelect={()=>{}}/>);
 for(const html of [editor,field]){expect(html).toContain('viewBox="0 0 640 360"');expect(html).toContain('preserveAspectRatio="xMidYMid meet"');expect(html).toContain('fill="#000000"');expect(html).toContain('overflow="hidden"');expect(html).toContain('rotate(-15');expect(html).not.toContain('PRIVATE_VIDEO_SOURCE');}
 expect(snapshot.artworks[0].video).toEqual({widthPx:640,heightPx:360,fit:'contain'});
 snapshot.artworks[0].video!.fit='cover';
 expect(renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId={p.walls[0].id} side="front" selectedId={null} onSelect={()=>{}}/>)).toContain('xMidYMid slice');
 expect(video.fit).toBe('contain');
});

it('separates different Scene screen ratios and fit choices when preparing PDF images without changing photos',()=>{
 const a={...createDemoProject().artworks[0],video,widthMm:1200,heightMm:1200},key=pdfArtworkImageKey(a);
 expect(pdfArtworkImageKey({...a,widthMm:2400,heightMm:2400})).toBe(key);
 expect(pdfArtworkImageKey({...a,widthMm:1600,heightMm:900})).not.toBe(key);
 expect(pdfArtworkImageKey({...a,video:{...video,fit:'cover'}})).not.toBe(key);
 expect(pdfArtworkImageKey({...a,video:undefined})).toBe(a.imageUrl);
 expect(key).not.toContain(video.dataUrl);
});
