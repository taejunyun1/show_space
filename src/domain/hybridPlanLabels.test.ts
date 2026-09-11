import {it,expect} from 'vitest';
import {detectPlanLabels} from './planLabels';
import {mergePdfFacilityOcr} from './hybridPlanLabels';
const box={x:10,y:10,width:80,height:20};
it('adds raster-only facility signs while retaining native text and dimension readings',()=>{
 const native=detectPlanLabels([{text:'1200 mm',source:'pdf-text',box}]);
 const result=mergePdfFacilityOcr(native,[{text:'FIRE EXIT',source:'ocr',confidence:96,box:{...box,y:50}},{text:'1700 mm',source:'ocr',confidence:99,box},{text:'All measurements in cm',source:'ocr',confidence:99,box}]);
 expect(result).toHaveLength(2);expect(result[0]).toEqual(native[0]);expect(result[1]).toMatchObject({kind:'entrance',source:'ocr',confidence:96});
});
it('does not duplicate native facilities or accept weak and unscored OCR',()=>{
 const native=detectPlanLabels([{text:'EXIT',source:'pdf-text',box}]);
 expect(mergePdfFacilityOcr(native,[{text:'FIRE EXIT',source:'ocr',confidence:98,box},{text:'HYDRANT',source:'ocr',confidence:70,box:{...box,y:100}},{text:'AIR CONDITIONER',source:'ocr',box:{...box,y:150}}])).toEqual(native);
});
it('does not resurrect a dismissed symbol through later caption OCR',()=>{
 const native=detectPlanLabels([{text:'FIRE HOSE',source:'pdf-text',box}]).map(l=>({...l,source:'symbol' as const,status:'dismissed' as const}));
 const result=mergePdfFacilityOcr(native,[{text:'FIRE HOSE REEL',source:'ocr',confidence:99,box},{text:'FIRE HOSE',source:'ocr',confidence:96,box:{...box,y:100}}]);
 expect(result).toHaveLength(2);expect(result[0]).toEqual(native[0]);expect(result[1].box.y).toBe(100);
});
