import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ getDocument: mocks.getDocument, GlobalWorkerOptions: {} }));
import { loadPlanFile } from './planImport';

const file = { name: 'plan.pdf', type: 'application/pdf', size: 100, arrayBuffer: async () => new ArrayBuffer(10) } as File;

describe('local plan PDF import', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('rejects oversized files before creating a PDF worker', async () => {
    await expect(loadPlanFile({ ...file, size: 31 * 1024 * 1024 } as File)).rejects.toThrow('30MB');
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });

  it('disposes PDF documents with too many pages', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 201 }), destroy });
    await expect(loadPlanFile(file)).rejects.toThrow('200페이지');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('rejects invalid pages without reading them and blocks use after disposal', async () => {
    const getPage = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage }), destroy });
    const loaded = await loadPlanFile(file);
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ wasmUrl: '/pdfjs/wasm/', cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', stopAtErrors: true }));
    await expect(loaded.renderPage(3)).rejects.toThrow('1~2');
    await expect(loaded.renderPage(1.5)).rejects.toThrow('1~2');
    expect(getPage).not.toHaveBeenCalled();
    await loaded.destroy();
    await loaded.destroy();
    await expect(loaded.renderPage(1)).rejects.toThrow('닫혔습니다');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('does not reuse a damaged nonempty PDF text layer as reliable plan evidence',async()=>{
    const canvas={width:0,height:0,getContext:()=>({}),toDataURL:()=> 'data:image/png;base64,AA=='};
    vi.stubGlobal('document',{createElement:()=>canvas});
    const page={getViewport:({scale}:{scale:number})=>({width:1000*scale,height:800*scale}),getTextContent:async()=>({items:[{str:'The Gallery'},{str:'\u0013\u008f\u009c\u0003 ABC'},{str:'195,,,'}]}),render:()=>({promise:Promise.resolve(),cancel:vi.fn()}),cleanup:vi.fn()};
    mocks.getDocument.mockReturnValue({promise:Promise.resolve({numPages:1,getPage:async()=>page}),destroy:vi.fn().mockResolvedValue(undefined)});
    const loaded=await loadPlanFile(file),result=await loaded.renderPage(1);
    expect(result.textSource).toBe('none');expect(result.labels).toEqual([]);expect(result.diagnostics?.warnings.join(' ')).toContain('인코딩');
    await loaded.destroy();
  });

  it('limits a large page to 2400 pixels and releases its canvas and page data', async () => {
    const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/png;base64,AA==' };
    vi.stubGlobal('document', { createElement: () => canvas });
    const cleanup = vi.fn();
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 10000 * scale, height: 5000 * scale }),
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }), cleanup,
    };
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => page }), destroy });
    const loaded = await loadPlanFile(file);
    expect(await loaded.renderPage(1)).toMatchObject({ imageUrl: 'data:image/png;base64,AA==', widthPx: 2400, heightPx: 1200 });
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(cleanup).toHaveBeenCalledOnce();
    await loaded.destroy();
  });

  it('rejects a failed PDF render instead of returning an incomplete page', async () => {
    const toDataURL = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL };
    vi.stubGlobal('document', { createElement: () => canvas });
    const cleanup = vi.fn();
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 1000 * scale, height: 1000 * scale }),
      getTextContent: async () => ({ items: [] }),
      render: () => ({ promise: Promise.reject(new Error('image decode failed')), cancel: vi.fn() }), cleanup,
    };
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => page }), destroy: vi.fn().mockResolvedValue(undefined) });
    await expect((await loadPlanFile(file)).renderPage(1)).rejects.toThrow('image decode failed');
    expect(toDataURL).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
  });

  it('cleans up failed decoding and reports password protection clearly', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('No password given')), destroy }));
    await expect(loadPlanFile(file)).rejects.toThrow('암호');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each([false, true])('compresses oversized PNG data and rejects oversized JPEG data (%s)', async (oversizedJpeg) => {
    const oversized = 'A'.repeat(12 * 1024 * 1024 + 1);
    const toDataURL = vi.fn().mockReturnValueOnce(oversized).mockReturnValueOnce(oversizedJpeg ? oversized : 'data:image/jpeg;base64,AA==');
    const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL };
    vi.stubGlobal('document', { createElement: () => canvas });
    const cleanup = vi.fn();
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 1000 * scale, height: 1000 * scale }),
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }), cleanup,
    };
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => page }), destroy: vi.fn().mockResolvedValue(undefined) });
    const loaded = await loadPlanFile(file);
    if (oversizedJpeg) await expect(loaded.renderPage(1)).rejects.toThrow('12MB');
    else expect((await loaded.renderPage(1)).imageUrl).toBe('data:image/jpeg;base64,AA==');
    expect(toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.92);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    await loaded.destroy();
  });
});

describe('plan image fidelity and diagnostics', () => {
  afterEach(() => vi.unstubAllGlobals());
  const imageFile = { name: 'plan.png', type: 'image/png', size: 100 } as File;

  function imageMocks(width: number, height: number, imageUrl = 'data:image/png;base64,AA==') {
    const close = vi.fn();
    const bitmap = { width, height, close };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    const toDataURL = vi.fn().mockReturnValue(imageUrl);
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL };
    vi.stubGlobal('document', { createElement: () => canvas });
    return { close, canvas, toDataURL };
  }

  it('keeps small source pixels without upscaling and flags low resolution', async () => {
    const { close, toDataURL } = imageMocks(600, 400);
    const loaded = await loadPlanFile(imageFile);
    const page = await loaded.renderPage(1);
    expect(page).toMatchObject({ widthPx: 600, heightPx: 400 });
    expect(page.diagnostics?.warnings.join(' ')).toContain('해상도');
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(close).toHaveBeenCalledOnce();
  });

  it('preserves lines in PNG at a 4096px limit and reports downsampling', async () => {
    const { close } = imageMocks(8000, 4000);
    const page = await (await loadPlanFile(imageFile)).renderPage(1);
    expect(page).toMatchObject({ widthPx: 4096, heightPx: 2048 });
    expect(page.diagnostics?.warnings.join(' ')).toContain('축소');
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects oversized encoded PNG without a lossy fallback and releases decode resources', async () => {
    const { close, canvas, toDataURL } = imageMocks(2000, 1000, 'A'.repeat(12 * 1024 * 1024 + 1));
    await expect(loadPlanFile(imageFile)).rejects.toThrow('12MB');
    expect(toDataURL).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
  });

  it('rejects excessive source pixels and image file sizes', async () => {
    const { close } = imageMocks(10000, 7000);
    await expect(loadPlanFile(imageFile)).rejects.toThrow('6000만');
    expect(close).toHaveBeenCalledOnce();
    await expect(loadPlanFile({ ...imageFile, size: 21 * 1024 * 1024 } as File)).rejects.toThrow('20MB');
  });
});

describe('PDF quality assessment', () => {
  afterEach(() => vi.unstubAllGlobals());
  function pdfMock(getTextContent: () => Promise<unknown>) {
    const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/png;base64,AA==' };
    vi.stubGlobal('document', { createElement: () => canvas });
    const page = { getViewport: ({ scale }: { scale: number }) => ({ width: 2400 * scale, height: 1200 * scale }), getTextContent,
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }), cleanup: vi.fn() };
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => page }), destroy: vi.fn().mockResolvedValue(undefined) });
  }

  it('counts only nonblank text and assesses its rendered pixel height', async () => {
    pdfMock(async () => ({ items: [{ str: '1200', height: 6 }, { str: 'ROOM', height: 12 }, { str: ' ', height: 1 }, { type: 'beginMarkedContent' }] }));
    const loaded = await loadPlanFile(file);
    const normal = await loaded.renderPage(1);
    expect(normal.diagnostics).toMatchObject({ textItemCount: 2, smallTextItemCount: 1 });
    const detail = await loaded.renderPage(1, true);
    expect(detail).toMatchObject({ widthPx: 4800, heightPx: 2400 });
    expect(detail.diagnostics).toMatchObject({ textItemCount: 2, smallTextItemCount: 0 });
  });

  it('reports absent text as a possibility, not proof of a scanned document', async () => {
    pdfMock(async () => ({ items: [] }));
    const page = await (await loadPlanFile(file)).renderPage(1);
    expect(page.diagnostics?.textItemCount).toBe(0);
    expect(page.diagnostics?.warnings.join(' ')).toContain('텍스트 레이어');
  });

  it('continues rendering when text assessment fails', async () => {
    pdfMock(async () => { throw new Error('unavailable'); });
    const page = await (await loadPlanFile(file)).renderPage(1);
    expect(page.widthPx).toBe(2400);
    expect(page.diagnostics?.textItemCount).toBeUndefined();
    expect(page.diagnostics?.warnings.join(' ')).toContain('점검');
  });
});
