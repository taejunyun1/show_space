# 프로젝터 이미지 편집과 Scene·캡처 준비 연결

2026-10-11. 문서 2 §61의 업로드·설정·Scene·읽기 전용 보기·출력 준비 흐름을 연결했다. 기존 GPU 투사 구현을 대체하지 않으며, 실제 GPU 투사/차폐와 최종 PNG/PDF 픽셀 인수는 완료로 판정하지 않는다.

## 수정한 동작

이전에는 투사 이미지 decoder가 끝나기 전에 렌즈·밝기·위치를 바꾸면 전체 프로젝트 참조가 달라졌다는 이유로 이미지를 거절했다. Scene/Undo/Redo로 같은 조명을 복원하면 이전 업로드의 busy와 결과가 남았고, 다른 이미지로 바꾼 뒤 늦게 도착한 실패도 현재 패널에 표시됐다.

- 같은 선택의 이미지 입력은 완료 시 **최신 프로젝터 설정과 위치·조준점을 유지**하고 imageUrl만 바꾼다. 새 프로젝트/선택·잠금·삭제·교체 원본의 결과를 적용하지 않는다. 현재 decoder의 실제 실패는 계속 안내하고 재시도할 수 있다.
- 편집기 메모리에 `projectContextVersion`을 둔다. 문서 로드·초기 draft 복원·Scene 복원·실제로 수행된 Undo/Redo에서 Inspector의 미확정 숫자/미디어 작업을 폐기한다. 일반 속성 편집·Scene 저장·실패/빈 Undo는 이 문맥을 바꾸지 않는다. 프로젝트 JSON/ZIP/클라우드 schema에는 새 필드를 넣지 않았다.
- `useEditorEditScope`를 함께 갱신했다. 같은 ID의 draft 복원 이후 바닥 텍스처가 뒤늦게 새 문서에 붙는 경우도 실제 FloorMaterialDialog에서 재현해 막았다. 이미 시작한 bitmap decode 자체를 강제 종료하는 기능은 아니며, 반환된 bitmap은 기존 reader가 해제한다.

## 같은 전시의 연결 검증

`ProjectorDelivery.workflow.test.tsx`는 실제 React/jsdom Inspector와 store, `readProjectorImage`, 실제 native PNG decode, R3F/Three TextureLoader·조명/섀도 행렬과 Canvas를 사용한다. 파일/DOM 이벤트·native decoder 완료 시점·R3F WebGL context/라벨 portal은 adapter다.

1. 앞선 [소유한 영상 fixture](../validation/video-delivery-2026-10-11/fixtures.json)의 실제 가로 640×360/세로 360×640 PNG를 파일 입력에 넣는다. 첫 decoder를 기다리는 동안 렌즈 2·비율 1·밝기 2,400lm·거리 4,500mm를 실제 숫자 필드로 편집하고, 입력 완료 후 위치·타깃과 원본 바이트가 유지되는지 확인했다.
2. 두 번째 프로젝터의 세로 이미지를 입력하고, 두 프로젝터의 contain 벽 Scene과 cover Scene을 저장했다. 두 번째 Scene의 첫 조준 Y는 실제로 0mm다. 밝기 0이어도 최신 맵 준비와 저장 상태를 유지한다. Scene 복원 뒤 이미지/설정/위치는 저장값과 동일하다.
3. 편집 R3F 두 Scene에서 실제 fitted map을 읽고 `captureAssetsReady`, `waitForCaptureAssets`, `lightingProfileReady`를 확인했다. 이전 Scene의 조명이 새 Scene의 준비 조건을 만족하지 않는 것도 확인했다.
4. 실제 공유 준비로 이미지 2개를 전역 ID로 중복 제거했다. 원본 imageUrl·NOTE·잠금은 공개 데이터에서 제외한다. 그 데이터와 로컬 읽기 전용 자산으로 실제 Lighting3D를 다시 마운트해 두 맵을 확인했다. 운영 HTTP/URL 발행을 수행한 것은 아니다.
5. PDF에서 사용하는 실제 `createSceneLighting`·`prepareProjectorMaps`로 두 Scene의 detached 맵을 준비했다. 이 코드가 소유한 맵 4개는 각각 한 번 해제됐다. GPU renderer나 PDF 3D 페이지를 대신 생성해 완료로 표현하지 않는다.
6. 전체 프로젝트 ZIP을 실제 export/import하고 JSON 전체 및 두 PNG 원본 바이트의 정확한 복원을 확인했다.

편집 4맵·읽기 전용 2맵·detached 4맵, 총 **10맵의 RGB 표본 120개 오차는 0**이다. min/max 원본 배율을 별도 계산해 contain 여백과 cover 중앙 크롭을 비교했다. 원본 위치/타깃에서 거리÷렌즈 비율 및 화면 비율로 물리 크기를 계산하고, 독립 방향 basis의 네 모서리/중심 **50점**을 실제 SpotLight shadow 행렬로 변환했다. UV 최대 오차는 `7.771561172376096e-16`이다. 기대 fit을 바꾸거나 기대 렌즈 비율을 10% 바꾸면 같은 검증이 실패한다. 이 행렬/맵 검증은 GPU의 표면 투사·가려짐·톤매핑을 증명하지 않는다.

자료: [workflow.json](../validation/projector-delivery-2026-10-11/workflow.json), [원본 포함 백업](../validation/projector-delivery-2026-10-11/project.gonggan.zip), [공개 준비 데이터](../validation/projector-delivery-2026-10-11/public.json), Scene/readonly/detached 맵 PNG. 실제로 A면 contain 맵과 B면 세로 cover 맵을 열어 여백·중앙 잘림을 확인했다.

## 수정 전 대조와 최종 확인

소스/동일 테스트를 `/tmp`에 복사하고 제품 3파일만 이전 main `a865a14ac06117954dea1332186185fdd0973088`로 교체했다. node_modules는 공유하고 소유한 PNG 두 개를 복사했다. 실제 작업 폴더의 제품 코드를 일시적으로 되돌리지 않았다. 같은 최종 3파일/26개 대조는 **수정 전 8 실패·18 통과 → 수정 후 전부 통과**다. 새 회귀는 13개(프로젝터 UI 11, 연결 1, 같은 ID의 draft 복원 1)다.

```sh
npm test -- src/components/Inspector.workflow.test.tsx src/components/ProjectorInspector.workflow.test.tsx src/components/ProjectorDelivery.workflow.test.tsx src/components/Lighting3D.lifecycle.test.tsx src/lib/projectorLighting.test.ts src/lib/projectorImageImport.test.ts
GONGGAN_PROJECTOR_DELIVERY_PROOF=1 npm test -- src/components/ProjectorDelivery.workflow.test.tsx
```

대상 6파일/44개 통과. 전체·빌드 및 자산 해시/CRC 결과는 [실행 기록](../validation/2026-10-11-projector-delivery-workflow.json)에 보존한다. native 연결 검증 중 React act가 완료되기 전에 commit을 기다리던 polling을 수정했고, 바닥 조준은 위치 이동 후에 Y=0을 지정하도록 검증 입력 순서를 수정했다. 이들은 제품 오류로 집계하지 않는다.

## 남은 인수와 다음 단계

실제 브라우저 파일 선택·GPU 투사/차폐·불러온 사용자 GLB 표면·최종 3D PNG/PDF·운영 공유 URL·실계정/두 기기·FPS/VRAM/p95와 원문 24단계 전체 인수는 남는다. 표준 GLB/glTF에서 프로젝터를 일반 흰 Spot으로 내보내지 않는 [기존 제외 범위](2026-10-07-projection-export-scope.md)는 유지했다. 새 GPU 픽셀이나 SketchUp 수신을 수행한 것으로 집계하지 않는다.

다음은 같은 전시 프로젝트에서 도면 입력→작품 배치→재질/조명→Scene→캡처/PDF·백업·공유 준비의 연속 흐름을 확인하는 단계다. 인증·브라우저 대기 유보와 사진→재질 유료 후속 범위는 유지하고 이번 변경은 즉시 재배포하지 않는다.
