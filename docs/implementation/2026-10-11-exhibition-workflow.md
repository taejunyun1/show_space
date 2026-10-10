# 같은 전시의 도면·10점 배치·Scene·출력 연결

2026-10-11. 이전까지 개별 화면에서 검증했던 도면, 작품 입력, 속성 편집, Scene과 출력을 하나의 프로젝트·실제 App 화면으로 연결했다. 원문 1의 40절 전체 24단계 인수를 대체하지 않는다.

## 발견한 오류와 수정

벽면 캡처 SVG에 `xmlns`가 두 번 직렬화됐다. SVG DOM의 namespace와 별개로 일반 `setAttribute('xmlns', ...)`를 추가하면 XMLSerializer가 namespace 선언을 생성하면서 중복 속성이 생겼다. 실제 native SVG decoder가 `Invalid SVG image`로 거절했고 캡처 화면에서는 작품 이미지를 읽지 못했다는 오류를 표시했다.

`captureSvg`가 XMLNS namespace를 사용해 선언하도록 바꿨다. 같은 연속 흐름에서 SVG XML 파싱, 작품 이미지 10장의 내장/개별 decode, PNG 인코딩이 성공한다. 이 변경은 평면도와 벽면도가 함께 쓰는 경로에 적용한다.

## 하나의 프로젝트로 수행한 흐름

새 `Exhibition.workflow.test.tsx`는 생산용 App/Header/도면 창/PlanView/Outliner/시리즈 창/Inspector/Workspace/캡처 창/PDF·내보내기 창을 실제 React StrictMode로 연결한다. 기본 Auto Save·hydrate·수동 Save·Zustand 명령과 생산용 로컬 project repository도 사용한다. 단계마다 프로젝트를 새 fixture로 바꾸지 않는다.

1. 빈 전시를 저장한 뒤 App이 실제 `readDraft`로 복구한다. 계정 설정 응답은 `enabled:false`인 로컬 adapter다.
2. 상단 도면 불러오기에 실제 2페이지 PDF를 전달한다. 표지 다음 전시장 평면도를 자동 선택하고 실제 PDF.js parser/render와 픽셀 알고리즘으로 벽 초안을 가져온다. 8000mm/문/에어컨/소화전 텍스트를 유지한다. 입력은 합성 PDF이며 실제 운영 도면 성공률 검사가 아니다.
3. 이 입력의 초안은 축척 미정으로 나온다. 실제 PlanView에서 두 점과 50cm를 입력해 축척을 보정한다. 수동 보정이 포함된 결과를 완전 자동 생성 성공으로 집계하지 않는다. 벽 높이는 Inspector에서 350cm로 수정한다.
4. 서로 다른 색의 실제 PNG 10장을 작품 파일 입력으로 올리고 실제 `readImage`의 native decode/Canvas encode를 실행한다. Inspector에서 각 작품을 40×60cm로 수정한다.
5. Outliner Shift 선택으로 10점을 선택하고 시리즈 창에서 25cm 간격으로 그룹 배열한다. 모든 ID/이미지·선택 벽과 치수를 유지한다.
6. 스팟을 추가하고 5500K/120cd를 입력한다. 버드아이뷰 요청으로 Scene A를 저장하고 첫 작품을 50cm 폭으로 바꾼 뒤 정면 요청으로 Scene B를 저장한다. 실제 Workspace 카메라 요청/Scene snapshot/thumbnail encode를 실행하지만 GPU 시점과 3D preview 렌더는 adapter다.
7. Scene A를 다시 열어 원래 10점 치수와 카메라 요청을 복원한다. 벽면도로 전환해 실제 SVG 캡처를 PNG로 인코딩한다. XML 유효성·내장 작품 이미지 10장·개별 native decode와 1920×1041px를 확인한다.
8. 상단 로컬 Save 이후 별도 repository와 `readDraft`로 전체 프로젝트·Scene을 정확히 다시 읽는다.
9. 현재/Scene A/Scene B의 실제 벡터 PDF 12페이지를 만든다. PDF.js로 한글 Scene/작품 10·400/500 치수를 추출하고 비공개 메모를 제외한 결과를 확인한다. 이 PDF는 3D 보기를 끄고 평면·벽면·치수 목록을 포함한다.
10. 실제 ZIP CRC/해시·이미지 검증과 자산 복원으로 프로젝트 전체를 정확히 되살린다. 두 Scene과 작품 10점의 공개 payload를 준비하고 비공개 메모 제외와 원래 편집 내용 보존을 확인한다. 공개 URL 발행/API/계정 검증은 이 흐름에 포함하지 않는다.

## 저장한 결과

- [입력 도면 PDF](../validation/2026-10-11-exhibition-input.pdf)
- [전시안 PDF 12페이지](../validation/2026-10-11-exhibition-output.pdf)
- [벽면 SVG](../validation/2026-10-11-exhibition-elevation.svg), [벽면 PNG](../validation/2026-10-11-exhibition-elevation.png)
- [전체 프로젝트 ZIP](../validation/2026-10-11-exhibition.gonggan.zip)
- [단계·검증 기록](../validation/2026-10-11-exhibition-workflow.json)

Native SVG rasterizer는 SVG `image href`의 내장 픽셀을 생략한다. 따라서 저장한 PNG는 벽/프레임·배열 외곽·치수 출력 근거이며 작품 이미지의 최종 픽셀 인수 근거가 아니다. SVG에는 실제 내장 PNG 10장이 있고 각각 별도로 decode했다. native PNG나 SVG 전체가 실제 브라우저 CSS·폰트 외관을 증명하지 않는다.

## 검증 결과

같은 최종 테스트 SHA-256 `854215ce3dbb58b2758e4bc238742331c55550888e2b787974de4852ff3f7918`를 이전 HEAD `b537e5f84de797d7fecfe84c5c7b4e10c9e718fd`의 captureSvg로 실행하면 캡처에서 1개 실패, 수정 후 전체 연속 흐름 1개 통과다. 전체 **1,314 통과 / 선택 10 제외**, 229 파일 통과/10 파일 제외와 TypeScript·production build·diff 검사 통과. 기존 큰 청크 안내는 유지한다. 출력 PDF/PNG/SVG/ZIP의 SHA-256을 검증 JSON에 기록했다.

## 남은 범위

실제 브라우저 파일 선택/마우스 드래그·스냅/Hand·GPU 렌더와 3D 캡처 픽셀, 직접 텍스처·야외 시간·Notes의 같은 전시 연결, GLB 수신·읽기 전용 URL 발행/회수, 실제 인증/두 기기·디스크 재시작 내구성·실사용 지표는 이번 연속 인수에서 미완료다. OCR은 빈 결과 adapter, Worker 메시지는 로컬 생산 알고리즘 adapter다. 개별 기존 근거를 새 연속 검증으로 집계하지 않는다.

다음은 같은 프로젝트에 직접 텍스처·내부 Note·야외 시간과 GLB 출력/독립 수신을 이어서 확인한다. 도면 완전 복원이나 문·설비·설치 제외 영역 직접 편집으로 범위를 확대하지 않는다. 이번 변경은 Git에 기록하고 재배포하지 않는다.
