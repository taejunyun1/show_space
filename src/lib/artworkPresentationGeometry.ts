import {BoxGeometry,ExtrudeGeometry,Path,Shape,MeshPhysicalMaterial,MeshStandardMaterial} from 'three';
import {artworkPresentation,frameColors,type PresentedArtwork} from '../domain/artworkPresentation';
export function artworkFrameGeometry(a:PresentedArtwork){
 const p=artworkPresentation(a),w=p.widthMm/1000,h=p.heightMm/1000,d=p.depthMm/1000;
 if(!p.framed)return new BoxGeometry(w,h,d);
 const iw=p.innerWidthMm/1000,ih=p.innerHeightMm/1000,shape=new Shape();
 shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
 const hole=new Path();hole.moveTo(-iw/2,-ih/2);hole.lineTo(-iw/2,ih/2);hole.lineTo(iw/2,ih/2);hole.lineTo(iw/2,-ih/2);hole.closePath();shape.holes.push(hole);
 return new ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1}).translate(0,0,-d/2);
}
export function artworkFrameMaterial(a:PresentedArtwork){
 const {settings,framed}=artworkPresentation(a),metal=framed&&settings.material==='metal';
 return new MeshStandardMaterial({color:frameColors[a.frame],roughness:metal ? .25 : settings.material==='paint' ? .5 : .75,metalness:metal?1:0});
}
export function artworkCoverMaterial(a:PresentedArtwork){
 const p=artworkPresentation(a),acrylic=p.settings.cover==='acrylic';
 return new MeshPhysicalMaterial({color:'#ffffff',transmission:1,opacity:1,roughness:acrylic ? .08 : .025,metalness:0,ior:acrylic?1.49:1.5,thickness:p.coverThicknessMm/1000});
}
