# PDF·백업·3D 내보내기의 작업 보호 및 전달 흐름

2026-10-08. 원문 1 §27–30/40과 문서 2 §49/53/55의 전달 흐름을 실제 React 창, PDF 파일 및 프로젝트 ZIP 복원으로 검증했다. 운영 인증과 브라우저 연결 대기는 보류하며 원문 24단계 전체 인수로 집계하지 않는다.

## 변경

PDF/Export 창은 비동기 생성 뒤 창이나 프로젝트가 바뀌어도 파일 다운로드·알림·onClose를 실행했다. 시작한 창의 수명을 확인하고 실제 editor store의 모든 프로젝트 ID 전환을 감시하는 `useProjectDialogScope`를 두 창에 연결했다. A→B→A가 한 React batch에 있어도 이전 창을 닫고 작업을 폐기한다. 이전 결과·진행 메시지·오류·finally는 새 창에 적용하지 않는다. 이미 생성 중인 encoder/GPU/ZIP 처리를 강제 종료하지 않으며 결과 전달만 차단한다.

동일 프로젝트에서 생성 중 추가 편집을 한 경우에는 시작 시점의 전시를 보관한다. 생성 뒤 살아 있는 편집 데이터를 예전 상태로 덮어쓰지 않는다. PDF 시점은 저장 버튼을 누를 때 읽고 복제해 지연 module import 뒤 다른 시점을 섞지 않는다. getter 실패도 PDF 창에 표시하며 재시도를 허용한다. GLB/glTF의 기존 포함/제외 범위와 파일 예산, ZIP의 원본 및 Scene 자산 보존 정책은 유지한다.

## 검증

`Delivery.workflow.test.tsx`의 새 회귀 12개는 실제 React createRoot/StrictMode/act, Zustand, ExportDialog, PdfDialog, PdfPageBuilder와 출력 코드를 실행한다. 작업 수명 회귀는 encoder 완료/오류를 제어한다. 정상 전달 시나리오는 실제 `exportProjectPdf`, 한글 글꼴, `artworkTexture`, native PNG decoder/Canvas, `pdf-lib` 및 독립 `pdfjs` reader/raster, `exportProjectBackup`, ZIP CRC32/해시와 `readProjectBackup`를 실행한다. Image/Canvas는 native backend를 연결한 transport이며 native dialog와 다운로드 위치, 글꼴 요청은 adapter다. 실제 브라우저·WebGL·운영 공개 API 검증으로 확대하지 않는다.

- PDF·ZIP·GLB·glTF 네 형식의 지연 완료를 A→B→A 뒤 폐기한다. 새 프로젝트·편집 이력·알림을 유지한다.
- PDF/백업 창 unmount 이후 결과를 다운로드하거나 새 창을 닫지 않는다 (2개).
- 현재 PDF 실패는 오류를 표시하고 중복 저장을 차단하며 재시도한다.
- 동일 프로젝트의 생성 중 편집은 유지하고 시작 당시 이름/내용의 백업을 전달한다.
- 시점 getter 실패 뒤 정상 재시도를 확인한다.
- 이전 PDF/백업의 지연 진행·실패가 새로 연 창에 들어가지 않는다 (2개).
- 작품 10점의 현재/저장 Scene을 같은 프로젝트에서 페이지 직접 구성→제목 변경→순서 이동→PDF→ZIP→정확한 복원→공유용 데이터 생성까지 연결한다 (1개).

마지막 전달 시나리오의 여섯 페이지 구성 항목은 치수 목록의 연속 페이지를 포함해 **실제 8페이지 A4 가로 PDF**가 된다. 첫 페이지는 저장 Scene의 평면, 두 번째는 현재 표지다. 현재 벽 높이 3,500mm와 Scene의 3,200mm, 작품 10점 목록과 현재 400×600mm/Scene 777×600mm 상세를 독립 PDF reader로 확인한다. 두 상세 페이지를 실제 native Canvas에 rasterise해 중심 빨강과 너비가 달라 생기는 왼쪽 여백 픽셀을 확인했고 렌더 이미지를 열어 레이아웃과 한글도 검사했다. PDF/공유용 데이터에는 내부 메모가 없고, ZIP은 메모와 현재/Scene의 이미지·치수·구조 전체를 그대로 복원한다.

[검증 기록](../validation/2026-10-08-delivery-workflow.json)에 파일 크기/해시·명령·범위를 기록했다. [현재 상세](../validation/2026-10-08-gonggan-delivery-detail-7-20261008.png)와 [Scene 상세](../validation/2026-10-08-gonggan-delivery-detail-8-20261008.png)는 브라우저 캡처가 아닌 실제 생성 PDF의 raster 결과다. `GONGGAN_DELIVERY_PROOF=1 npx vitest run src/components/Delivery.workflow.test.tsx`로 `/tmp`의 PDF·백업·미리보기를 다시 생성할 수 있다.

수정 전 동일한 12개 회귀는 6개 실패/6개 통과, 수정 후 모두 통과한다. 전체 **1,187 통과 / 선택 10 제외**, 220 파일 통과/10 파일 제외. TypeScript와 production build, diff 검사 통과. 기존 Vite 큰 청크 안내는 유지한다.

실제 브라우저 다운로드/불러오기·포인터·공개 URL 발행 왕복, 실제 계정·두 기기·GPU 투사/PNG·PDF 3D 픽셀·24단계 전시 전체 흐름·사용자 지표 및 SketchUp 수신은 여전히 남긴다. 공유용 데이터의 Scene 선택/메모 제외를 확인했지만 공유 창의 비동기 credential/발행 및 목록 UI 인수는 다음 독립 검증으로 남는다. 이번 변경은 Git에 기록하며 즉시 재배포하지 않는다. 직전 공개 배포 소스는 `8fb69dc`다.
