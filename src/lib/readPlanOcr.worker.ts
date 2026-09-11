import {createWorker, OEM, PSM} from 'tesseract.js';
import type {Worker as TesseractWorker} from 'tesseract.js';

self.onmessage = async (event: MessageEvent<{imageUrl: string; assetBase: string; mode?: string}>) => {
  let worker: TesseractWorker | undefined;
  try {
    const {imageUrl, assetBase, mode} = event.data;
    worker = await createWorker(mode==='numbers'?'eng':'eng+kor', OEM.LSTM_ONLY, {
      workerPath: `${assetBase}worker.min.js`,
      corePath: `${assetBase}core/`,
      langPath: `${assetBase}lang/`,
      workerBlobURL: false,
      logger: ({status, progress}) => {
        const ratio = Math.max(0, Math.min(1, progress));
        const percent = status === 'recognizing text' ? 30 + ratio * 69
          : status === 'initializing api' ? 20 + ratio * 10
          : status === 'loading language traineddata' ? 10 + ratio * 10
          : ratio * 10;
        self.postMessage({progress: percent});
      },
      errorHandler: () => self.postMessage({error: '문자 인식 엔진이나 언어 파일을 읽지 못했습니다. 다시 시도하세요.'}),
    });
    await worker.setParameters({tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '150'});
    const result = await worker.recognize(imageUrl, {}, {text: true, blocks: true});
    const lines = (result.data.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines))
      .slice(0, 2000).map(({text, confidence, bbox}) => ({text, confidence, bbox}));
    self.postMessage({lines});
  } catch {
    self.postMessage({error: '도면 문자 인식에 실패했습니다. 원본이나 더 작은 영역으로 다시 시도하세요.'});
  } finally {
    await worker?.terminate();
  }
};
