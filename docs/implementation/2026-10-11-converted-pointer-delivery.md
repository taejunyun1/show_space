# 변환된 전시장의 직접 편집과 Scene·캡처 전달

작성일: 2026-10-11. 사용자 결정인 가벼운 도면 초안, 자유 편집, 치수·시점·캡처, 잠긴 공유를 유지한다. 문·설비·설치 제외 영역의 직접 편집이나 완전 자동 복원을 확대하지 않는다.

## 변경된 동작

작품 회전은 화면의 임시 각도만 바뀌고 `previewProject`가 없을 수 있다. 종전에는 이 상태에서 Scene 저장과 캡처가 가능해 표시된 각도와 저장된 각도가 달라질 수 있었다. 드래그 시작 직후 미리보기가 아직 없는 경우도 같다.

이제 벽·작품·3D 작품·조명·야외 이동, 임시 미리보기, 작품 회전 상태를 함께 검사한다. 편집 중 Scene 저장을 비활성화하고 store의 직접 저장도 거절한다. 캡처를 시도하면 이동·회전을 마친 뒤 다시 실행하도록 안내한다. Scene 썸네일이나 PNG를 준비하는 동안 새 편집이 시작되면 이전 결과를 폐기한다. 한 React 렌더 사이에 회전 시작→종료가 모두 일어나도 감지한다. 진행 중 편집과 Undo/Redo는 보존한다. 이미 시작된 GPU·이미지 계산 전체의 중단을 보장하는 변경은 아니다.

## 같은 공간의 연속 검증

소유한 2,240바이트 GLB를 실제 파일 loader와 벽/바닥 변환으로 읽었다. 위치 [1000, 0, -2000]mm, 공간 회전 30°, 배율 1.25에서 벽 4개·바닥 약 74.9967m²에 기존 작품 5점을 다시 배치했다. 실제 Workspace와 벽면도의 pointer 경로로 다음을 연결했다.

- A면 드래그의 최종 릴리스 좌표, Undo/Redo, −30° 회전, 잠금 후 이동 금지와 해제.
- 1,118.0339887mm 치수 저장, 실제 Scene 썸네일 320×200과 PNG 1920×901 생성.
- B면 전환·드래그·−60° 회전, pointer 취소 후 늦은 릴리스 무시, Hand로 화면만 이동.
- 두 Scene의 실제 GLB 내보내기/재읽기에서 작품 5점의 이미지 네 모서리를 독립 계산한 좌표와 비교.
- 공개 데이터의 Scene 2개·이미지 5장·모델 업로드 0개, 비공개 Note 제외, ZIP의 정확한 JSON 복원과 원본 해시 유지.

픽셀 검사는 각 Scene의 회전된 작품 내부 5곳을 독립 계산해 원본 RGB와 비교했다. 10개 샘플 오차는 모두 0이다. 이미지 전체 픽셀 일치나 색 관리 검증으로 확장하지 않는다. ZIP은 Scene 썸네일 2장을 포함한 자산 8개/전체 항목 11개이며 CRC를 확인했다.

검증용 native Canvas SVG decoder는 내장 이미지를 생략해, SVG 해석에만 `sharp` 0.35.4를 개발 의존성으로 명시했다. 제품의 브라우저 캡처 구현은 바꾸지 않는다. 실제 스타일을 주입했지만 이 환경의 native SVG decoder는 글자 픽셀을 그리지 않았다. 치수 문자열은 실제 SVG에서 확인했고, PNG 근거는 작품·회전·치수선까지다. 폰트 설정을 넣은 별도 작은 SVG도 글자 알파 픽셀 0개였으므로 이 한계를 제품 오류로 집계하지 않는다. 합성 screen CTM과 DOM pointer adapter를 사용하며 실제 브라우저 좌표·GPU 캡처로 부르지 않는다.

## 회귀 검사와 독립 수신

새 검사 12개. 최종 세 workflow 파일 26개를 이전 제품 코드 `d0f79ee`에 적용하면 12 실패/14 통과다. 변경 후 기존 벽면도 검사를 포함한 대상 40개/4파일과 전체 검사를 통과했다. 최종 전체 개수와 명령·소스 해시는 [검증 기록](../validation/2026-10-11-converted-pointer-delivery.json)을 따른다. TypeScript와 production build도 통과했고 큰 청크 안내는 유지한다. 앞선 전체 검사에서 기존 Library 재질 복원 대기 검사 1개가 실패했으나 해당 파일 22개 단독 재검사와 후속 전체 검사는 통과했다. 원인을 단정하거나 Library 제품 코드를 변경하지 않았다.

Blender 4.4.1의 별도 importer가 두 GLB에서 각각 15 Mesh·packed 이미지 5장(32×48)·벽 4개·바닥 면적을 확인했다. 설치 XYZ와 yaw/roll을 독립 계산한 이미지 네 모서리의 최대 오차는 0.0005mm 미만이다. 기대 회전만 15° 바꾼 대조 입력은 `image corner mismatch`로 실제 exit 1을 반환했다. 1000×700/16 samples CPU 미리보기 두 장에서도 다섯 작품과 회전을 확인했다. 자유 편집으로 생긴 겹침은 그대로 유지하며 자동 겹침 회피를 주장하지 않는다. 현재 GLB의 SHA는 workflow와 Blender receiver에 모두 일치한다.

- [연속 흐름](../validation/converted-pointer-2026-10-11/workflow.json), [원본 SVG A면](../validation/converted-pointer-2026-10-11/Scene-A.svg), [PNG A면](../validation/converted-pointer-2026-10-11/Scene-A.png)
- [독립 수신](../validation/converted-pointer-2026-10-11/blender/receiver.json), [실패 대조·ZIP 검사](../validation/converted-pointer-2026-10-11/verifier-checks.json)
- [Blender A면](../validation/converted-pointer-2026-10-11/blender/Scene-A.png), [Blender B면](../validation/converted-pointer-2026-10-11/blender/Scene-B.png)

## 다음 범위

다음은 변환된 공간의 평면/3D 편집을 시점·캡처·PDF 출력까지 연결하는 검증이다. 운영 인증/브라우저 대기는 기존 결정에 따라 유보한다. 실제 사용자 전시장·브라우저/GPU·글자 캡처·FPS/전체 VRAM/p95·운영 URL/계정·두 기기·원문 24단계/실사용 지표·SketchUp 수신은 미완료다. 유료 사진→재질·IES/AI 등 원문 후속 범위도 유지한다. 이번 변경은 배포하지 않는다.
