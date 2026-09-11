import {it,expect} from 'vitest';
import {assessPdfText} from './pdfTextQuality';
it('rejects broken font mappings even with readable navigation and incidental numbers',()=>{
 const r=assessPdfText([{str:'The Gallery Gallery plan'},{str:'\u0013\u008f\u009c\u0003 À measurements \u0085'},{str:'195,,,'}]);
 expect(r.usable).toBe(false);expect(r.badCharacters).toBeGreaterThan(3);
});
it('retains normal Korean, Latin and dimension symbols without language guessing',()=>{
 expect(assessPdfText([{str:'전시장 층고 2.75m / 8,000 mm ±5 Ø100 × 200 – 東京'}]).usable).toBe(true);
 expect(assessPdfText([{str:'ABC\n8000 mm\t'}]).usable).toBe(true);
 expect(assessPdfText([{str:'\ue001 ' + 'normal text '.repeat(20)}]).usable).toBe(true);
 expect(assessPdfText([{type:'beginMarkedContent'}]).usable).toBe(false);
});
