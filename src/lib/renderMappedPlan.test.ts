import {afterEach,it,expect,vi} from 'vitest';
import {renderMappedPlan} from './renderMappedPlan';
import type {prepareMappedVenue} from '../domain/mappedVenue';
afterEach(()=>vi.unstubAllGlobals());
it('renders each source cell at its mapped position and releases the canvas',async()=>{
 const drawImage=vi.fn(),canvas={width:0,height:0,getContext:()=>({fillStyle:'',fillRect:vi.fn(),drawImage}),toDataURL:()=> 'data:image/png;base64,AA=='};
 vi.stubGlobal('Image',class{naturalWidth=300;naturalHeight=200;src='';decode=async()=>{};});vi.stubGlobal('document',{createElement:()=>canvas});
 const prepared={layers:{walls:[],planReference:{widthPx:200,heightPx:200,mmPerPixel:10,calibrated:true,origin:{x:0,z:0}}},stairs:[],lines:[],outsideLabels:[],outsideLines:[],cells:[{source:{x:0,y:0,width:100,height:200},target:{x:0,y:0,width:100,height:200}},{source:{x:100,y:0,width:200,height:200},target:{x:100,y:0,width:100,height:200}}]} as NonNullable<ReturnType<typeof prepareMappedVenue>>;
 expect(await renderMappedPlan('source',prepared,new AbortController().signal)).toContain('data:image/png');
 expect(drawImage.mock.calls.map(c=>c.slice(1))).toEqual([[0,0,100,200,0,0,100,200],[100,0,200,200,100,0,100,200]]);expect(canvas.width).toBe(0);
 const controller=new AbortController();controller.abort();await expect(renderMappedPlan('source',prepared,controller.signal)).rejects.toThrow('취소');
});
