import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createDemoProject} from '../domain/model';
import {flushAutosave,startAutosave,useEditor} from './editor';

let stop=()=>{};
beforeEach(()=>{useEditor.setState({project:createDemoProject(),hydrated:true,saveStatus:'saved',past:[],future:[]});});
afterEach(()=>{stop();stop=()=>{};vi.useRealTimers();vi.unstubAllGlobals();});
function lifecycle(){
 const document=Object.assign(new EventTarget(),{visibilityState:'visible'});
 const browser=Object.assign(new EventTarget(),{document});
 vi.stubGlobal('window',browser);return {document,browser};
}
const leaving=()=>new Event('beforeunload',{cancelable:true});

it('guards only unsaved writes, starts the pending save on reload and releases the guard after completion',async()=>{
 vi.useFakeTimers();const {browser}=lifecycle(),writer=vi.fn();
 let release!:()=>void;writer.mockImplementation(()=>new Promise<void>(resolve=>{release=resolve;}));
 stop=startAutosave(writer,250);
 const clean=leaving();browser.dispatchEvent(clean);expect(clean.defaultPrevented).toBe(false);
 useEditor.getState().renameProject('새로고침 직전 이름');
 const dirty=leaving();browser.dispatchEvent(dirty);expect(dirty.defaultPrevented).toBe(true);
 await vi.advanceTimersByTimeAsync(0);expect(writer).toHaveBeenCalledTimes(1);
 expect(writer.mock.calls[0][0].name).toBe('새로고침 직전 이름');
 const writing=leaving();browser.dispatchEvent(writing);expect(writing.defaultPrevented).toBe(true);
 release();await flushAutosave();expect(useEditor.getState().saveStatus).toBe('saved');
 const saved=leaving();browser.dispatchEvent(saved);expect(saved.defaultPrevented).toBe(false);
 expect(writer).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});

it('flushes on hidden or pagehide without waiting for the debounce timer or writing duplicates',async()=>{
 vi.useFakeTimers();const {browser,document}=lifecycle(),writer=vi.fn<(project:ReturnType<typeof createDemoProject>)=>Promise<void>>(async()=>{});
 stop=startAutosave(writer,250);useEditor.getState().renameProject('배경 이동');
 document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(0);expect(writer).not.toHaveBeenCalled();
 document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));await flushAutosave();expect(writer).toHaveBeenCalledTimes(1);
 useEditor.getState().renameProject('다음 변경');browser.dispatchEvent(new Event('pagehide'));await flushAutosave();
 expect(writer).toHaveBeenCalledTimes(2);expect(writer.mock.calls[1][0].name).toBe('다음 변경');
 await vi.advanceTimersByTimeAsync(250);expect(writer).toHaveBeenCalledTimes(2);
});

it('keeps failed work guarded, then allows leaving after a subsequent successful save',async()=>{
 vi.useFakeTimers();const {browser}=lifecycle(),writer=vi.fn().mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValue(undefined);
 stop=startAutosave(writer,250);useEditor.getState().renameProject('실패한 작업');
 await expect(flushAutosave()).rejects.toThrow('저장 실패');expect(useEditor.getState().saveStatus).toBe('error');
 const failed=leaving();browser.dispatchEvent(failed);expect(failed.defaultPrevented).toBe(true);
 useEditor.getState().renameProject('복구한 작업');await flushAutosave();
 const saved=leaving();browser.dispatchEvent(saved);expect(saved.defaultPrevented).toBe(false);
});

it('flushes pending edits on editor cleanup and removes every lifecycle listener',async()=>{
 vi.useFakeTimers();const {browser,document}=lifecycle(),writer=vi.fn<(project:ReturnType<typeof createDemoProject>)=>Promise<void>>(async()=>{});
 stop=startAutosave(writer,250);useEditor.getState().renameProject('편집 종료 직전');stop();stop=()=>{};
 await vi.advanceTimersByTimeAsync(0);expect(writer).toHaveBeenCalledTimes(1);expect(writer.mock.calls[0][0].name).toBe('편집 종료 직전');
 useEditor.setState({saveStatus:'saving'});const event=leaving();browser.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
 document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));browser.dispatchEvent(new Event('pagehide'));
 await vi.advanceTimersByTimeAsync(250);expect(writer).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
