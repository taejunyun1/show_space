# 실제 PDF 입력의 호환 빌드와 편집 연결 검증

2026-10-09. 이전 도면 입력 검증에서 제어된 응답으로 대신했던 PDF 파서·페이지 렌더를 실제 파일 바이트와 연결했다. API나 외부 업로드를 추가하지 않고 로컬 도면 입력의 실패 원인을 수정한다.

## 원인과 수정

기존 입력은 PDF.js 6.3.289의 일반 parser와 worker를 사용했다. 최신 typed-array codec API가 없는 이번 테스트 runtime에서 실제 PDF fingerprint 계산이 `n.toHex is not a function`으로 실패했다. mock 페이지 응답으로는 드러나지 않던 오류다. 동일 버전의 `legacy/build/pdf.mjs`와 `legacy/build/pdf.worker.min.mjs`를 함께 사용해 호환 처리 코드를 연결했다. PDF.js 패키지 README도 최신 JavaScript 기능이 없는 환경에는 legacy 디렉터리를 안내한다. 특정 Safari/Firefox 버전의 실제 실행을 확인한 것으로 확대하지 않는다.

페이지·해상도·원본 보존·이미지와 벡터 후보 처리·파일 한도는 기존 동작을 유지한다. 버전 업그레이드나 별도 수동 polyfill을 추가하지 않는다. 기존 단위 테스트의 mock 경로는 새로운 parser entry에 맞춘다.

이 빌드에서 PDF parser 청크는 437.74→495.64kB (gzip 131.10→151.46kB), worker 파일은 1,265.41→1,317.03kB다. PDF parser는 기존처럼 동적 import이며 호환성 때문에 추가 전송량이 생긴다. 이 수치는 minified 산출물의 크기이며 실제 네트워크 압축·로딩 시간·기기 메모리 측정은 아니다. 기존 Vite 큰 청크 안내는 유지한다.

## 실제 파일과 UI 근거

새 `PlanPdf.workflow.test.tsx` 4개는 실제 React/StrictMode의 PlanImportDialog·PlanView, PDF.js parser·worker 메시지 처리·텍스트/원본 operator list와 native Canvas 렌더, 생산용 벽/표지 픽셀 알고리즘 및 analyzePlan·자동 페이지 선택을 실행한다. PDF.js는 Node의 same-thread fake-worker transport로 실제 worker 코드를 실행한다. 브라우저 Worker 스레드를 실행한 근거는 아니다. worker asset URL만 실제 로컬 모듈 경로로 바꾼다. getDocument/getPage/renderPage/page.render 결과는 mock하지 않는다.

- 표지와 평면도를 포함한 실제 2페이지 PDF를 preview 900px, 일반 2400px, 상세 4800px로 읽는다. 숫자 `8000 mm`·`6000 mm`, DOOR·AC·FIRE HYDRANT를 PDF 텍스트에서 보존하고 후보 종류를 확인한다.
- preview 렌더 뒤에도 일반/상세의 원본 사각 벽 4개 좌표·크기가 유지된다. native PNG에서 검은 벽과 흰 내부 픽셀을 확인한다. destroy 뒤에는 추가 렌더를 거절한다.
- 실제 자동 페이지 선택에서 평면도 2페이지가 선택된다. 초안 적용은 기존 프로젝트 ID·이름·내부 메모를 유지하고 벽/도면/표기를 parser 왕복과 단일 Undo/Redo로 확인한다. 모든 물리 벽·문 점유 범위나 치수 자동 적용의 정확도를 보증하지 않는다.
- 수동 1페이지 선택과 상세 4800×4000 렌더를 실제 화면에서 실행하고 선택 원본을 배치 callback으로 전달한다. 이 사례의 callback 자체는 spy다.
- 300×250 PNG를 포함한 실제 스캔 PDF를 입력한다. 텍스트 레이어 없음 안내와 최소 두 벽의 축척 미정 초안, 100px를 100cm로 보정한 10mm/px, 원본 이미지 불변과 Undo/Redo를 확인한다. 확대가 원본 세부 정보를 복원한다는 뜻은 아니다.

OCR만 빈 결과로 대체해 문자 레이어와 실제 픽셀 처리 경계를 구분했다. 실제 OCR 숫자 정확도/시간을 증명하지 않는다. 벽/표지 Worker 메시지 transport는 main-thread adapter이며 실제 생산용 검출 함수가 실행된다. File·Image·Canvas·DOMMatrix·Path2D·dialog·SVG 좌표 입력은 Node/native/jsdom adapter다. 실제 브라우저 입력·GPU·운영 계정·기기 근거로 확대하지 않는다.

## 결과와 저장 자료

같은 파일 테스트와 transport를 이전 HEAD `0527969`의 planImport에 대조하면 **4 실패 / 0 통과**, 수정 후 **4 통과**다. 기존 입력 단위 테스트를 포함한 대상 **22개 통과**, 전체 **1,240 통과 / 선택 10 제외**, 224 파일 통과/10 파일 제외. TypeScript/production build와 diff 검사 통과.

- [검증 기록](../validation/2026-10-09-real-pdf-input.json)
- [생성한 표지·평면도 PDF](../validation/2026-10-09-pdf-vector-input.pdf)
- [생성한 저해상도 스캔 PDF](../validation/2026-10-09-pdf-scanned-input.pdf)
- [실제 일반 해상도 렌더 PNG](../validation/2026-10-09-pdf-plan-render.png)

위 입력은 재현 가능한 합성 도면이다. 사용자 파일 전체 인식 성공률·실제 브라우저/PDF Worker·GPU·동일 전시 24단계·두 계정/기기·사용자 모델 성능/지표·SketchUp 수신은 계속 남는다. 이번 수정은 Git에 기록하며 즉시 재배포하지 않는다. 마지막 공개 배포의 기록상 소스는 `8fb69dc`이며 운영 상태를 새로 조회하지 않았다. 다음은 작품 선택·치수/간격·재질·조명의 실제 편집 화면 연결 검증이다.
