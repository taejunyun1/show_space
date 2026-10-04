import {afterEach,expect,it,vi} from 'vitest';
import {createPlanOcrBudget} from './planOcrBudget';
afterEach(()=>vi.useRealTimers());

it('terminates an unresponsive OCR pass and preserves time for other evidence',async()=>{
 vi.useFakeTimers();const run=createPlanOcrBudget(new AbortController().signal,45_000,12_000);
 let active:AbortSignal|undefined;
 const pending=run(signal=>{active=signal;return new Promise<never>(()=>{});});
 const outcome=expect(pending).rejects.toThrow('시간 제한');
 await vi.advanceTimersByTimeAsync(12_000);await outcome;expect(active?.aborted).toBe(true);
 expect(await run(async()=>['PDF 문자'])).toEqual(['PDF 문자']);expect(vi.getTimerCount()).toBe(0);
});

it('shares one total deadline instead of multiplying timeouts across retries',async()=>{
 vi.useFakeTimers();const run=createPlanOcrBudget(new AbortController().signal,25_000,12_000);
 const task=vi.fn(()=>new Promise<never>(()=>{}));
 for(const duration of [12_000,12_000,1000]){
  const pending=expect(run(task)).rejects.toThrow('시간 제한');await vi.advanceTimersByTimeAsync(duration);await pending;
 }
 await expect(run(task)).rejects.toThrow('시간 제한');expect(task).toHaveBeenCalledTimes(3);expect(vi.getTimerCount()).toBe(0);
});

it('cancels the active worker immediately and starts no further work',async()=>{
 vi.useFakeTimers();const parent=new AbortController(),run=createPlanOcrBudget(parent.signal);
 let active:AbortSignal|undefined;
 const pending=expect(run(signal=>{active=signal;return new Promise<never>(()=>{});})).rejects.toThrow('취소');
 parent.abort();await pending;expect(active?.aborted).toBe(true);
 const next=vi.fn(async()=>[]);await expect(run(next)).rejects.toThrow('취소');expect(next).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
