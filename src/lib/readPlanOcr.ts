import OcrWorker from './readPlanOcr.worker?worker';
import type {PlanText} from '../domain/planLabels';

interface OcrLine {
  text: string;
  confidence: number;
  bbox: {x0: number; y0: number; x1: number; y1: number};
}

/** OCR only returns evidence; an unreadable page is never evidence of missing equipment. */
export async function readPlanOcr(
  imageUrl: string,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
  mode: 'general'|'numbers' = 'general',
): Promise<PlanText[]> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let canvas: HTMLCanvasElement | undefined;
    let worker: Worker | undefined;
    let settled = false;
    let lastProgress = 0;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker?.terminate();
      image.src = '';
      if (canvas) canvas.width = canvas.height = 0;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(new Error('문자 인식이 취소되었습니다.'));
    const timer = setTimeout(() => fail(new Error('문자 인식 시간이 초과했습니다. 도면 영역을 더 작게 잘라 다시 시도하세요.')), 90_000);
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) {abort(); return;}

    const run = async () => {
      image.src = imageUrl;
      await image.decode();
      if (settled) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) throw new Error('문자 인식용 도면을 읽을 수 없습니다.');
      const scale = Math.min(mode==='numbers'?2:1, (mode==='numbers'?3600:2400) / Math.max(width, height));
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const xScale = width / canvas.width;
      const yScale = height / canvas.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('문자 인식용 이미지를 만들 수 없습니다.');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // The coordinator owns the nested Tesseract worker, allowing immediate cancellation
      // even while createWorker has not yet returned its public terminate handle.
      worker = new OcrWorker();
      worker.onerror = () => fail(new Error('문자 인식 엔진을 실행하지 못했습니다. 다시 시도하세요.'));
      worker.onmessage = (event: MessageEvent<{progress?: number; error?: string; lines?: OcrLine[]}>) => {
        if (settled) return;
        if (event.data.error) {fail(new Error(event.data.error)); return;}
        if (typeof event.data.progress === 'number') {
          lastProgress = Math.max(lastProgress, Math.min(99, Math.max(0, event.data.progress)));
          onProgress?.(lastProgress);
          return;
        }
        if (!Array.isArray(event.data.lines)) {fail(new Error('문자 인식 결과를 읽을 수 없습니다.')); return;}
        const texts: PlanText[] = [];
        for (const line of event.data.lines.slice(0, 2000)) {
          const text = line.text.trim().replace(/\s+/g, ' ').slice(0, 1000);
          const {x0, y0, x1, y1} = line.bbox;
          if (!text || ![x0, y0, x1, y1, line.confidence].every(Number.isFinite)) continue;
          const x = Math.max(0, Math.min(width, x0 * xScale));
          const y = Math.max(0, Math.min(height, y0 * yScale));
          const right = Math.max(0, Math.min(width, x1 * xScale));
          const bottom = Math.max(0, Math.min(height, y1 * yScale));
          if (right <= x || bottom <= y) continue;
          texts.push({text, box: {x, y, width: right - x, height: bottom - y}, source: 'ocr', confidence: Math.max(0, Math.min(100, line.confidence))});
        }
        if (!texts.length) {fail(new Error('도면에서 문자를 읽지 못했습니다. 설비가 없다는 뜻이 아닙니다. 영역을 확대해 다시 인식하거나 원본을 확인하세요.')); return;}
        settled = true;
        cleanup();
        onProgress?.(100);
        resolve(texts);
      };
      worker.postMessage({mode,imageUrl: canvas.toDataURL('image/png'), assetBase: new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href});
    };
    void run().catch(error => fail(error instanceof Error ? error : new Error('도면 문자 인식에 실패했습니다.')));
  });
}
