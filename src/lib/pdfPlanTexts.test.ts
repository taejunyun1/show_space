import {it,expect} from 'vitest';
import {pdfPlanTexts} from './pdfPlanTexts';
it('converts PDF baseline coordinates into bounded top-left image boxes',()=>{const result=pdfPlanTexts([{str:'EXIT',transform:[10,0,0,10,20,30],width:30,height:10}],[2,0,0,-2,0,200],200,200);expect(result[0].box).toEqual({x:40,y:120,width:60,height:20});});
it('handles rotated text and skips unsupported/outside records',()=>{expect(pdfPlanTexts([{str:'STAIR',transform:[0,10,-10,0,50,30],width:30,height:10}],[1,0,0,-1,0,100],100,100)[0].box).toEqual({x:40,y:40,width:10,height:30});expect(pdfPlanTexts([{},null,{str:'bad',transform:[1,0,0,1,999,999],width:10,height:10}],[1,0,0,-1,0,100],100,100)).toEqual([]);});
