import {expect,it} from 'vitest';
import {pageSignSymbols,redSignPanels} from './pageSignSymbols';
import {fireHoseTemplate} from './fireHoseTemplate';
const page=()=>{
 const data=new Uint8ClampedArray(160*120*4).fill(255);
 for(let y=0;y<46;y++)for(let x=0;x<32;x++)data.set([...(y<32&&fireHoseTemplate[y][x]==='1'?[255,255,255]:[230,0,0]),255],((y+20)*160+x+30)*4);
 return data;
};
it('locates a known sign in the page and deduplicates crop variants without altering pixels',()=>{
 const data=page(),before=data.slice(),results=pageSignSymbols(data,160,120);
 expect(results).toHaveLength(1);
 expect(results[0].box.x).toBeCloseTo(30,0);expect(results[0].box.y).toBeCloseTo(20,0);
 expect(results[0].symbol.templateId).toBe('paragon-hose-reel-v1');expect(data).toEqual(before);
});
it('does not classify bare red CAD panels or a sign without its lower caption panel',()=>{
 const data=new Uint8ClampedArray(160*120*4).fill(255);
 for(let y=20;y<75;y++)for(let x=30;x<70;x++)data.set([230,0,0,255],(y*160+x)*4);
 expect(pageSignSymbols(data,160,120)).toEqual([]);
 const withoutFooter=page();for(let y=51;y<66;y++)for(let x=30;x<62;x++)withoutFooter.set([255,255,255,255],(y*160+x)*4);
 expect(pageSignSymbols(withoutFooter,160,120)).toEqual([]);
});
it('rejects malformed input and returns no detections on an empty page',()=>{
 expect(()=>pageSignSymbols(new Uint8ClampedArray(4),100,100)).toThrow();
 expect(()=>pageSignSymbols(new Uint8ClampedArray(4),2401,1)).toThrow();
 expect(pageSignSymbols(new Uint8ClampedArray(100*100*4).fill(255),100,100)).toEqual([]);
});
it('retains a sign when rasterization joins its icon and caption backgrounds',()=>{
 const data=page();
 for(let y=31;y<46;y++)for(const x of [0,1,30,31])data.set([255,255,255,255],((y+20)*160+x+30)*4);
 for(let y=28;y<=32;y++)data.set([230,0,0,255],((y+20)*160+32)*4);
 expect(pageSignSymbols(data,160,120)).toHaveLength(1);
});
it('keeps thin red frames as candidates without treating the frame itself as equipment',()=>{
 const data=new Uint8ClampedArray(100*100*4).fill(255);
 for(let y=0;y<45;y++)for(let x=0;x<47;x++)if(x<3||x>=44||y<4||y>=42)data.set([230,0,0,255],((y+10)*100+x+10)*4);
 expect(redSignPanels(data,100,100)).toHaveLength(1);expect(pageSignSymbols(data,100,100)).toEqual([]);
});
