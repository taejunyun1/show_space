import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readPlanOcr} from './readPlanOcr';

const workers = vi.hoisted(() => [] as Array<{
  onmessage: ((event: {data: unknown}) => void) | null;
  onerror: (() => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}>);
vi.mock('./readPlanOcr.worker?worker', () => ({default: class {
  onmessage = null;
  onerror = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {workers.push(this);}
}}));

describe('readPlanOcr', () => {
  const canvas = {width: 0, height: 0, getContext: () => ({fillRect: vi.fn(), drawImage: vi.fn(),translate:vi.fn(),rotate:vi.fn()}), toDataURL: () => 'data:image/png;base64,AAA'};
  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal('Image', class {naturalWidth = 4800; naturalHeight = 2400; src = ''; decode = vi.fn().mockResolvedValue(undefined);});
    vi.stubGlobal('document', {createElement: () => canvas});
    vi.stubGlobal('location', {href: 'http://localhost:5173/'});
  });
  afterEach(() => {vi.unstubAllGlobals(); vi.useRealTimers();});

  it('maps OCR boxes back to original pixels, clamps bounds, and cleans resources', async () => {
    const result = readPlanOcr('image', new AbortController().signal);
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    expect(canvas.width).toBe(2400);
    workers[0].onmessage!({data: {lines: [
      {text: '  소화전\n', confidence: 86, bbox: {x0: 10, y0: 20, x1: 60, y1: 40}},
      {text: '계단', confidence: 101, bbox: {x0: -5, y0: 100, x1: 2600, y1: 120}},
      {text: 'invalid', confidence: 90, bbox: {x0: 20, y0: 30, x1: 10, y1: 20}},
    ]}});
    expect(await result).toEqual([
      {text: '소화전', box: {x: 20, y: 40, width: 100, height: 40}, source: 'ocr', confidence: 86},
      {text: '계단', box: {x: 0, y: 200, width: 4800, height: 40}, source: 'ocr', confidence: 100},
    ]);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
  });

  it('uses a larger numeric pass and preserves original coordinates',async()=>{
    const result=readPlanOcr('image',new AbortController().signal,undefined,'numbers');
    await vi.waitFor(()=>expect(workers).toHaveLength(1));
    expect(canvas.width).toBe(3600);
    expect(workers[0].postMessage.mock.calls[0][0].mode).toBe('numbers');
    workers[0].onmessage!({data:{lines:[{text:'3200',confidence:90,bbox:{x0:75,y0:150,x1:150,y1:180}}]}});
    expect((await result)[0].box).toEqual({x:100,y:200,width:100,height:40});
  });

  it('rotates the numeric raster and maps the worker box back to original coordinates',async()=>{
    const result=readPlanOcr('image',new AbortController().signal,undefined,'numbers',90);
    await vi.waitFor(()=>expect(workers).toHaveLength(1));expect(canvas.width).toBe(1800);expect(canvas.height).toBe(3600);
    workers[0].onmessage!({data:{lines:[{text:'125',confidence:95,bbox:{x0:75,y0:150,x1:105,y1:225}}]}});
    expect((await result)[0].box).toEqual({x:200,y:2260,width:100,height:40});
  });

  it('cancels during initialization without waiting for OCR worker startup', async () => {
    const controller = new AbortController();
    const result = readPlanOcr('image', controller.signal);
    const rejected = expect(result).rejects.toThrow('취소');
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    controller.abort();
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });

  it('times out even when image decoding never resolves', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class {src = ''; decode = () => new Promise(() => {});});
    const result = readPlanOcr('image', new AbortController().signal);
    const rejected = expect(result).rejects.toThrow('초과');
    await vi.advanceTimersByTimeAsync(90_000);
    await rejected;
    expect(workers).toHaveLength(0);
  });

  it('reports unreadable text as unable to read, rather than absence of equipment', async () => {
    const result = readPlanOcr('image', new AbortController().signal);
    const rejected = expect(result).rejects.toThrow('문자를 읽지 못했습니다');
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    workers[0].onmessage!({data: {lines: []}});
    await rejected;
  });
});
