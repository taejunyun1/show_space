import {it,expect} from 'vitest';
import {pdfImagePlacements,imagePlacementBox} from './pdfImagePlacements';
const codes={save:1,restore:2,transform:3,paintImageXObject:4,paintFormXObjectBegin:5,paintFormXObjectEnd:6};
it('tracks rotated image placement and restores the previous graphics transform',()=>{
 const found=pdfImagePlacements({fnArray:[1,3,4,2,4],argsArray:[[],[0,50,-80,0,200,100],['sign'],[],['untransformed']]},codes,[1,0,0,-1,0,400]);
 expect(imagePlacementBox(found[0].matrix)).toEqual({x:120,y:250,width:80,height:50});expect(found[1].matrix).toEqual([1,0,0,-1,0,400]);
});
it('handles nested form transforms without leaking them to later image placements',()=>{
 const found=pdfImagePlacements({fnArray:[5,3,4,6,4],argsArray:[[[2,0,0,2,10,20]],[30,0,0,40,5,6],['inside'],[],['outside']]},codes,[1,0,0,1,0,0]);
 expect(imagePlacementBox(found[0].matrix)).toEqual({x:20,y:32,width:60,height:80});expect(found[1].matrix).toEqual([1,0,0,1,0,0]);
});
