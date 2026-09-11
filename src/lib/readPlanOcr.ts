import type {OcrRegion} from '../domain/ocrRegions';
import {unrotateTextBox} from '../domain/orientedNumbers';
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
  rotation:0|90|180|270=0,
  region?:OcrRegion,
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
      const crop=region??{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
      if(![crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>image.naturalWidth||crop.y+crop.height>image.naturalHeight)throw new Error('문자 인식 영역이 원본 범위를 벗어났습니다.');
      const width = crop.width;
      const height = crop.height;
      if (!width || !height) throw new Error('문자 인식용 도면을 읽을 수 없습니다.');
      const scale = Math.min(mode==='numbers'?2:1, (mode==='numbers'?3600:2400) / Math.max(width, height));
      canvas = document.createElement('canvas');
      const rotatedWidth=rotation%180?height:width,rotatedHeight=rotation%180?width:height;
      canvas.width = Math.max(1, Math.round(rotatedWidth * scale));
      canvas.height = Math.max(1, Math.round(rotatedHeight * scale));
      const xScale = rotatedWidth / canvas.width;
      const yScale = rotatedHeight / canvas.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('문자 인식용 이미지를 만들 수 없습니다.');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if(rotation===90)context.translate(canvas.width,0);
      if(rotation===180)context.translate(canvas.width,canvas.height);
      if(rotation===270)context.translate(0,canvas.height);
      if(rotation)context.rotate(rotation*Math.PI/180);
      context.drawImage(image,crop.x,crop.y,width,height,0,0,rotation%180?canvas.height:canvas.width,rotation%180?canvas.width:canvas.height);
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
          const x = Math.max(0, Math.min(rotatedWidth, x0 * xScale));
          const y = Math.max(0, Math.min(rotatedHeight, y0 * yScale));
          const right = Math.max(0, Math.min(rotatedWidth, x1 * xScale));
          const bottom = Math.max(0, Math.min(rotatedHeight, y1 * yScale));
          if (right <= x || bottom <= y) continue;
          const box=unrotateTextBox({x,y,width:right-x,height:bottom-y},width,height,rotation);
          texts.push({text, box:{...box,x:box.x+crop.x,y:box.y+crop.y}, source: 'ocr', confidence: Math.max(0, Math.min(100, line.confidence))});
        }
        if (!texts.length&&!region) {fail(new Error('도면에서 문자를 읽지 못했습니다. 설비가 없다는 뜻이 아닙니다. 영역을 확대해 다시 인식하거나 원본을 확인하세요.')); return;}
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
