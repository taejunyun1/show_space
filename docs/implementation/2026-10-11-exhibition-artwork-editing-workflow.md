# 작품 드래그·스냅·회전과 벽면도 작업 전환 보호

2026-10-11. [벽 경계·끝점·Hand·바닥](2026-10-11-exhibition-editing-workflow.md)에 이어 같은 전시에서 작품 마우스 편집을 연결했다. 벽면도의 실제 드래그·회전을 다루며 도면 인식이나 문·설비 직접 편집 범위를 확장하지 않는다.

## 수정한 동작

회전 도중 프로젝트·선택·벽을 A→B→A로 왕복하면 React의 최종 화면 값만으로 이전 회전을 지우지 못했다. 같은 전시의 추가 편집이나 도구 변경 뒤에도 회전이 남을 수 있었다. 이제 시작 시점의 전시 객체·벽·선택·뷰·도구와 포인터를 기록하고 store 전환을 즉시 관찰한다. 이전 작업의 늦은 이동/놓기를 무시하며 캡처 해제·pointercancel·Escape·화면 해제도 취소로 처리한다. 취소는 해당 벽면도가 시작한 작업에만 적용해 다른 곳에서 시작한 새 작품 드래그를 지우지 않는다.

회전 중에는 전역 편집 중 상태도 연결한다. 회전 확정은 마지막 pointerup 좌표를 사용하며 15° 단위로 기존 각도 규칙을 유지한다. 다른 포인터의 down/move/up·캡처 해제와 우클릭으로 작업을 덮어쓰거나 확정하지 않는다. 프로젝트나 벽을 왕복하면 이전 Hand viewport를 비운다. A/B면 좌표 변환과 Alt 스냅 해제도 유지한다.

## 같은 전시의 실제 UI 연결

생산용 App을 하나의 전시 ID로 유지했다. PDF→축척→바닥 경계 일괄 지정→끝점 스냅/바닥→Hand→실제 PNG 작품 10점·치수·간격/그룹까지 앞선 흐름을 유지한다. 이어 실제 벽면도 SVG에서 그룹을 드래그해 벽 높이 중심 1750mm로 스냅한다. 가로 좌표는 기존 10mm 그리드 규칙에 맞추고 10점의 동일 이동량을 확인했다. 확정·undo·redo 후 그룹을 풀어 첫 작품을 -90°로 회전하고 다시 10점을 묶는다. 입력한 10개 작품 ID와 이미지, 간격은 유지한다.

이 배치를 같은 전시의 텍스처·내부 Note·조명/야외 시간·Scene A/B·복원·벽면 캡처·독립 저장소 재읽기·12페이지 PDF·ZIP 완전 복원·공개 payload·GLB까지 연결한다. 실제 GLTFLoader로 바닥 치수/16cm 두께, 벽/작품 치수·이미지 픽셀·텍스처 반복과 작품 회전각을 다시 읽었다. 이번 파일의 Blender/SketchUp 수신은 실행하지 않았다.

별도 React/StrictMode 벽면도 테스트 14개는 스냅/Alt·실행 취소·릴리스 좌표, 프로젝트/선택/벽 왕복·같은 전시 편집·도구 변경, 캡처 해제·다른 포인터·우클릭, 벽 전환/B면 이동, Escape/unmount, Hand와 새 외부 드래그 보존을 확인한다. 동일 최종 대상 15개를 이전 ElevationView에 적용하면 14 실패/1 통과, 수정 후 모두 통과다. 전체 1,337 통과/선택 10 제외, 231 파일 통과/10 파일 제외, TypeScript·production build·diff 검사 통과. 기존 큰 청크 안내는 유지한다.

- [단계·해시·검증 기록](../validation/2026-10-11-exhibition-artwork-editing-workflow.json)
- [전시안 PDF](../validation/2026-10-11-exhibition-artwork-editing-output.pdf), [프로젝트 ZIP](../validation/2026-10-11-exhibition-artwork-editing.gonggan.zip), [GLB](../validation/2026-10-11-exhibition-artwork-editing.glb)

jsdom의 수동 pointer 이벤트·숫자 pointerId/identity 화면 좌표, native Canvas와 fake-indexeddb 근거다. 실제 OS 포인터 캡처·브라우저/GPU·3D PNG·계정/기기/디스크 인수를 대체하지 않는다. Native SVG rasterizer의 내장 image href 픽셀 생략 한계도 유지한다. 도면 숫자/벽/문/설비 자동 인식을 더 엄격하게 만들지 않았으며 사진→재질의 유료 후속 범위도 유지한다. 이번에 배포하지 않는다.

다음은 같은 전시의 읽기 전용 공개 URL 발행·Scene 보기·회수 연결이다. 공개 payload 준비와 개별 공유 테스트를 실제 운영 인증·외부 공개 URL 인수로 집계하지 않는다. 원문 24단계·실사용 지표·후속 요구 및 기존 인증/실제 브라우저 유보는 그대로 남긴다.
