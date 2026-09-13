import {it,expect} from 'vitest';import {pdfFilledRects,visibleFilledRects} from './pdfFilledRects';
const codes={save:1,restore:2,transform:3,setFillRGBColor:4,constructPath:5,fill:22,eoFill:23,stroke:20,clip:6,setGState:7};
const rect=[0,10,20,1,50,20,1,50,60,1,10,60,4];
const ops=(fnArray:number[],argsArray:unknown[][])=>({fnArray,argsArray});
it('tracks nested matrices and fill color and copies paths before renderer mutation',()=>{
 const path=new Float32Array(rect),r=pdfFilledRects(ops([4,1,3,5,2,5],[['#969696'],[],[2,0,0,2,5,7],[22,[path]],[],[22,[rect]]]),codes,[1,0,0,1,0,0]);
 expect(r.map(({x,y,width,height})=>({x,y,width,height}))).toEqual([{x:25,y:47,width:80,height:80},{x:10,y:20,width:40,height:40}]);path.fill(0);expect(r[0].width).toBe(80);
});
it('does not turn stroke bounds, curves, compound paths or clipped/translucent content into filled rectangles',()=>{
 for(const path of [[...rect,...rect],[0,0,0,2,1,2,3,4,5,6,4],[0,0,0,1,10,0,1,0,0,1,0,10,4]])expect(pdfFilledRects(ops([5],[[22,[path]]]),codes,[1,0,0,1,0,0])).toEqual([]);
 for(const barrier of [6,7])expect(pdfFilledRects(ops([barrier,5],[[],[22,[rect]]]),codes,[1,0,0,1,0,0])).toEqual([]);
 expect(pdfFilledRects(ops([5],[[20,[rect]]]),codes,[1,0,0,1,0,0])).toEqual([]);
});
it('accepts right-angle rotation but rejects skewed and invalid geometry',()=>{
 expect(pdfFilledRects(ops([5],[[22,[rect]]]),codes,[0,1,-1,0,100,0])[0]).toMatchObject({x:40,y:10,width:40,height:40});
 expect(pdfFilledRects(ops([5],[[22,[rect]]]),codes,[1,0,.2,1,0,0])).toEqual([]);
});
it('requires the final rendered interior to corroborate fill color',()=>{
 const r={id:'r',color:'#969696',x:10,y:10,width:40,height:40},pixels=new Uint8ClampedArray(100*100*4).fill(255);
 for(let y=10;y<50;y++)for(let x=10;x<50;x++)pixels.set([150,150,150,255],(y*100+x)*4);
 expect(visibleFilledRects([r],pixels,100,100)).toEqual([r]);pixels.fill(255);expect(visibleFilledRects([r],pixels,100,100)).toEqual([]);
});
