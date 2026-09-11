import {pageTextPanels} from './textPanels';
import {pdfSignImages,type PdfSignImage} from './pdfSignImages';
import {pageRasterProfile,type PageRasterProfile} from '../domain/pageRasterProfile';
import {assessPdfText} from './pdfTextQuality';
import type {PlanAnalysis} from './analyzePlan';
import { detectPlanLabels } from '../domain/planLabels';
import type { PlanLabel } from '../domain/planLabels';
import { pdfPlanTexts } from './pdfPlanTexts';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { RenderTask } from 'pdfjs-dist';

export interface PlanPage {
  overlaidDoors?:import('../domain/overlaidDoors').OverlaidDoor[];
  textPanels?:import('../domain/textStrokes').TextRegion[];
  textRegions?:import('../domain/textStrokes').TextRegion[];
  embeddedSigns?:PdfSignImage[];
  resolvedVenue?:{project:import('../domain/types').Project;sourceImageUrl:string;sourceEvidenceKey:string};
  dimensionRechecks?:import('../domain/dimensionRecheck').DimensionRecheckResult[];
  analysis?:PlanAnalysis;
  imageUrl: string;
  labels?: PlanLabel[];
  textSource?: 'pdf-text'|'ocr'|'none';
  widthPx: number;
  heightPx: number;
  diagnostics?: { rasterProfile?:PageRasterProfile; warnings: string[]; textItemCount?: number; smallTextItemCount?: number };
}

export interface PlanFile {
  pageCount: number;
  renderPage(pageNumber: number, detail?: boolean): Promise<PlanPage>;
  previewPage?(pageNumber: number): Promise<PlanPage>;
  destroy(): Promise<void>;
}

const MAX_IMAGE_URL_LENGTH = 12 * 1024 * 1024;

function validateImageSize(imageUrl: string) {
  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
    throw new Error('변환된 도면 이미지가 저장 한도 12MB를 넘습니다. 해상도를 줄인 사본을 올려주세요.');
  }
}

function validatePage(pageNumber: number, pageCount: number) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`1~${pageCount} 사이의 페이지를 선택해주세요.`);
  }
}

/** Decodes locally; the source PDF is never uploaded or saved in the project. */
export async function loadPlanFile(file: File): Promise<PlanFile> {
  if (file.size > 30 * 1024 * 1024) throw new Error('도면 파일은 30MB 이하로 올려주세요.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG, JPG, WEBP 또는 PDF 도면을 올려주세요.');
    if (file.size > 20 * 1024 * 1024) throw new Error('이미지 도면은 20MB 이하로 올려주세요.');
    const bitmap = await createImageBitmap(file);
    let imageUrl: string;
    let widthPx: number;
    let heightPx: number;
    const warnings: string[] = [];
    const canvas = document.createElement('canvas');
    try {
      if (bitmap.width <= 0 || bitmap.height <= 0 || bitmap.width * bitmap.height > 60_000_000) {
        throw new Error('이미지는 6000만 픽셀 이하로 올려주세요.');
      }
      if (Math.min(bitmap.width, bitmap.height) < 800) warnings.push('원본 해상도가 낮을 수 있습니다. 작은 숫자와 가는 선은 자동 검증에서 확정되지 않을 수 있습니다.');
      const scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
      if (scale < 1) warnings.push('작업용 도면을 최대 4096px로 축소했습니다. 원본 해상도 이상의 세부 정보는 복원하지 않습니다.');
      widthPx = canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
      heightPx = canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('도면 이미지를 읽을 수 없습니다.');
      context.drawImage(bitmap, 0, 0, widthPx, heightPx);
      imageUrl = canvas.toDataURL('image/png');
      validateImageSize(imageUrl);
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 0;
    }
    let destroyed = false;
    return {
      pageCount: 1,
      async renderPage(pageNumber) {
        if (destroyed) throw new Error('도면 파일이 닫혔습니다. 다시 불러와주세요.');
        validatePage(pageNumber, 1);
        return { imageUrl, widthPx, heightPx, textSource: 'none', diagnostics: { warnings: [...warnings] } };
      },
      async destroy() { destroyed = true; imageUrl = ''; },
    };
  }

  const { getDocument, GlobalWorkerOptions, OPS } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    stopAtErrors: true,
  });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > 200) throw new Error('PDF는 200페이지 이하로 나눠서 올려주세요.');
    let destroyed = false;
    const activeTasks = new Set<RenderTask>();
    const renderPage = async (pageNumber:number, detail = false, preview = false):Promise<PlanPage> => {
        if (destroyed) throw new Error('도면 파일이 닫혔습니다. 다시 불러와주세요.');
        validatePage(pageNumber, pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        const canvas = document.createElement('canvas');
        let renderTask: RenderTask | undefined;
        try {
          if (destroyed) throw new Error('도면 파일이 닫혔습니다. 다시 불러와주세요.');
          const original = page.getViewport({ scale: 1 });
          if (!Number.isFinite(original.width) || !Number.isFinite(original.height) || original.width <= 0 || original.height <= 0) {
            throw new Error('PDF 페이지 크기를 읽을 수 없습니다.');
          }
          const scale = Math.min((preview ? 900 : detail ? 4800 : 2400) / Math.max(original.width, original.height), Math.sqrt((detail ? 24_000_000 : 6_000_000) / (original.width * original.height)));
          const viewport = page.getViewport({ scale });
          let labels:PlanLabel[]=[];
          let textRegions:NonNullable<PlanPage['textRegions']>=[];
          let textSource:PlanPage['textSource']='none';
          const diagnostics: NonNullable<PlanPage['diagnostics']> = { warnings: [] };
          // A text-layer heuristic only: this neither performs OCR nor detects walls.
          try {
            const text = await page.getTextContent();
            const items = text.items.filter(item => 'str' in item && item.str.trim().length > 0);
            const quality=assessPdfText(items);
            if(quality.usable){textSource='pdf-text';const texts=pdfPlanTexts(items,viewport.transform??[scale,0,0,-scale,0,viewport.height],Math.floor(viewport.width),Math.floor(viewport.height));labels=detectPlanLabels(texts);textRegions=texts.map(t=>t.box);}
            diagnostics.textItemCount = items.length;
            diagnostics.smallTextItemCount = items.filter(item => 'height' in item && Math.abs(item.height) * scale < 9).length;
            if(items.length&&!quality.usable)diagnostics.warnings.push('PDF 문자 인코딩이 손상되어 로컬 OCR로 자동 분석합니다.');
            if (!items.length) diagnostics.warnings.push('텍스트 레이어를 찾지 못했습니다. 로컬 OCR로 자동 분석합니다.');
            if (diagnostics.smallTextItemCount) diagnostics.warnings.push(`현재 해상도에서 9px 미만인 문자 항목이 ${diagnostics.smallTextItemCount}개 있습니다. 작은 문자는 확정 가능한 인식 근거만 사용합니다.`);
          } catch {
            diagnostics.warnings.push('텍스트 품질 점검을 완료하지 못했습니다. 문자 자동 분석 결과에 따라 생성을 보류할 수 있습니다.');
          }
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('PDF를 이미지로 변환할 수 없습니다.');
          renderTask = page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' });
          activeTasks.add(renderTask);
          await renderTask.promise;
          if (destroyed) throw new Error('도면 파일이 닫혔습니다. 다시 불러와주세요.');
          diagnostics.rasterProfile=pageRasterProfile(context.getImageData(0,0,canvas.width,canvas.height).data);
          let textPanels:NonNullable<PlanPage['textPanels']>=[];
          if(!preview){try{textPanels=pageTextPanels(canvas,textRegions,labels);}catch{diagnostics.warnings.push('안내 상자 배경을 분리하지 못해 기존 선 분석을 유지합니다.');}}
          let embeddedSigns:PdfSignImage[]=[];
          if(!preview){try{embeddedSigns=await pdfSignImages(page,viewport.transform as import('../domain/pdfImagePlacements').Matrix6,canvas,OPS);}catch{diagnostics.warnings.push('PDF 원본 이미지 표기 추출을 완료하지 못했습니다. 페이지 OCR을 유지합니다.');}}
          if (destroyed) throw new Error('도면 파일이 닫혔습니다. 다시 불러와주세요.');
          let imageUrl = canvas.toDataURL('image/png');
          if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
            imageUrl = canvas.toDataURL('image/jpeg', 0.92);
            diagnostics.warnings.push('저장 한도에 맞춰 JPEG로 압축했습니다. 작은 숫자와 가는 선에 압축 흔적이 있을 수 있습니다.');
          }
          validateImageSize(imageUrl);
          return {
            imageUrl,
            labels,textSource,embeddedSigns,textRegions,textPanels,
            widthPx: canvas.width,
            heightPx: canvas.height,
            diagnostics,
          };
        } finally {
          if (renderTask) activeTasks.delete(renderTask);
          canvas.width = canvas.height = 0;
          page.cleanup();
        }
      };
    return {
      pageCount:pdf.numPages,
      renderPage,
      previewPage:pageNumber=>renderPage(pageNumber,false,true),
      async destroy() {
        if (destroyed) return;
        destroyed = true;
        for (const task of activeTasks) task.cancel();
        activeTasks.clear();
        await loadingTask.destroy();
      },
    };
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    if (error instanceof Error && /password|destroyed/i.test(error.message)) {
      throw new Error('암호가 설정된 PDF입니다. 암호를 해제한 사본을 올려주세요.');
    }
    throw error;
  }
}
