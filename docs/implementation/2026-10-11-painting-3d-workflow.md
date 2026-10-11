# 3D 작품의 직접 편집과 Scene·PDF 연결

작성일: 2026-10-11. 가벼운 도면 초안 이후 자유 편집·치수·시점·캡처·잠긴 공유를 우선하는 사용자 결정을 유지한다.

## 수정한 문제

3D 작품의 드래그와 회전은 마지막 `pointermove`의 값만 확정했다. 놓을 때의 좌표가 달라지거나 이동 이벤트 없이 회전 핸들을 놓으면 원하는 마지막 위치/각도가 저장되지 않았다. 회전은 로컬 React 상태에만 남아, 전시·선택·벽·시점·도구가 같은 렌더 사이에 왕복하면 뒤늦은 이벤트가 이전 각도를 확정할 수도 있었다. 다른 포인터의 이벤트와 화면 종료도 충분히 구분하지 않았다.

이제 유효한 release ray를 최종 위치·각도 계산에 반영한다. 시작한 프로젝트 객체·선택·벽·뷰·도구·포인터를 보관하고 store의 모든 전환에서 검사한다. 드래그의 grab 객체도 구분해 같은 작품의 새 외부 드래그를 이전 작업 취소로 지우지 않는다. 새 편집, 캡처 손실, Escape, unmount에서 자신의 미리보기·회전 상태와 capture를 정리하고, 오래된 start callback도 새 전시에서 거절한다. 다른 벽으로 드래그해도 실제 이미지 node를 유지하며 최종 벽과 위치를 단일 Undo로 확정한다. 유효한 벽 교차가 없는 release는 마지막 유효 미리보기를 유지한다.

벽 자체의 평면/3D pointer 경로를 이번 작품 변경과 동일하게 수정했다고 집계하지 않는다. 그 경로에서 최종 release 좌표와 포인터 소유권을 확인할 작업이 다음에 남아 있다.

## 연속 흐름과 독립 좌표 검사

앞 단계에서 실제 모델 변환 후 저장한 소유 전시 백업을 다시 읽고, 실제 R3F reconciler·Three geometry·Painting 이벤트와 store를 실행했다. GPU transport, 이미지 Texture, DOM annotation, capture target과 입력 ray는 검증 어댑터다. 실제 브라우저 포인터 또는 GPU 픽셀로 주장하지 않는다.

새 검사 18개가 A/B면 release, 15° 회전, 다른 벽 전환, Undo/Redo, 잠금, 우클릭, 두 포인터, capture loss, 전시/선택/벽/뷰/도구 왕복, 추가 편집, Escape/unmount, 같은 작품의 새 외부 드래그와 오래된 callback을 다룬다. 이전 `19f859b` 제품 코드에 test access용 `Painting` export만 추가하면 같은 최종 18개 중 17 실패/1 통과다. export는 동작을 바꾸지 않는다. fixture의 원본/파싱 객체 identity·ray가 다른 벽을 먼저 만나는 문제·부동소수점 기대값과 native PDF의 window 어댑터 오류는 제품 오류로 집계하지 않는다.

연속 검사는 다음을 같은 저장 전시에 연결한다.

- A면 드래그 후 −90° 회전 → 버드아이 시점으로 Scene 저장.
- B면으로 5점 전환·드래그 후 −45° 회전 → 정면을 15° 돌린 시점으로 Scene 저장.
- 실제 3D 이미지 Mesh의 네 world 정점을 벽 tangent/normal·설치 높이·깊이·yaw/roll에서 독립 계산한 좌표와 비교. 오차 0.01mm 미만.
- 정면·좌/우 측면·버드아이·버드아이 ±15°의 실제 Three 카메라에 해당 이미지 모서리를 투영해 화면 내부에 있는지 확인. Workspace 버튼 입력이나 GPU 화면 검증은 아니다.
- 실제 PDF exporter·원본 이미지 decoder·한글 글꼴·페이지 구성으로 두 Scene의 평면/벽면/설치 치수 8페이지 생성. 내장 Note는 제외한다.
- 별도 PDF.js native raster로 A/B 벽면의 작품 5점씩 RGB 샘플 검사, 한글/−90°/−45° 문자열 추출, 실제 PDF image operator의 네 모서리를 독립 계산한 배치와 비교.
- 회전 기대값을 15° 바꾸면 실제 PDF 모서리와 약 6.57pt 어긋나고 3D 모서리도 허용 오차를 벗어나는 대조 검사.
- ZIP의 정확한 JSON 복원·CRC와 원본 모델/이미지·Scene 시점 보존.

PDF의 한글·치수·회전·다섯 이미지는 두 native raster를 열어 확인했다. 이는 앞 단계의 native SVG 글자 픽셀 누락 한계를 없애거나 브라우저 캡처를 검증한 결과가 아니다. 각 색상은 샘플 픽셀만 비교하며 전체 색 관리 일치로 확대하지 않는다.

- [생성된 8페이지 PDF](../validation/painting-3d-2026-10-11/exhibition.pdf)
- [A면 PDF raster](../validation/painting-3d-2026-10-11/A-wall.png), [B면 PDF raster](../validation/painting-3d-2026-10-11/B-wall.png)
- [연속 검증](../validation/painting-3d-2026-10-11/workflow.json), [명령·소스·자산 해시](../validation/2026-10-11-painting-3d-workflow.json)

## 남은 범위

다음은 평면/3D의 벽 이동·회전·끝점 편집과 다른 포인터/화면 전환 보호를 같은 전시장/바닥·작품·출력에 연결한다. 운영 인증·브라우저 연결 대기는 기존 결정대로 유보한다. 실제 사용자 전시장·브라우저/GPU·3D 캡처 픽셀·FPS/전체 VRAM/p95·실계정/두 기기/운영 URL·원문 24단계/실사용 지표·SketchUp 수신과 후속 유료 사진→재질·IES/AI 범위는 남아 있다. 이번 변경은 배포하지 않는다.
