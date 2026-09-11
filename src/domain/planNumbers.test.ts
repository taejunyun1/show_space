import{describe,it,expect}from'vitest';
import{readPlanNumbers,numberWarnings}from'./planNumbers';
describe('drawing number evidence',()=>{
 it('reads bare dimensions without guessing units',()=>{expect(readPlanNumbers('３２００')).toEqual([{raw:'3200',values:[3200],unit:null,axis:null}]);expect(numberWarnings('3200')).toContain('단위 미확인 · mm로 가정하지 않습니다.');});
 it('reads explicit dimension roles and metric units',()=>{expect(readPlanNumbers('H=3.2m')[0]).toMatchObject({values:[3.2],unit:'m',axis:'height'});expect(readPlanNumbers('T=200')[0]).toMatchObject({values:[200],unit:null,axis:'thickness'});});
 it('retains separator ambiguity and separate dimension chains',()=>{expect(readPlanNumbers('3,200')[0].values).toEqual([3200,3.2]);expect(readPlanNumbers('1200 2400 3600').map(n=>n.values[0])).toEqual([1200,2400,3600]);expect(readPlanNumbers('3,2 m')[0].values).toEqual([3.2]);});
 it('rejects scales, IDs, levels and malformed punctuation',()=>{for(const t of ['1:100','2026-09-11','A101','FL +3200','90°','3.2.0','ROOM 1200','3O00','0'])expect(readPlanNumbers(t),t).toEqual([]);});
 it('flags weak OCR and avoids silently repairing confused glyphs',()=>{expect(numberWarnings('3200',40).join(' ')).toContain('OCR 점수가 낮');expect(readPlanNumbers('32OO')).toEqual([]);});
});
