# 도면 Scene의 PDF·GLB·읽기 전용 전달

2026-10-11. 직전 두 JPEG 도면 입력 작업의 백업을 이어 받아 각 Scene의 공간·치수가 출력과 공유 보기에도 유지되는지 확인했다. 도면 인식 범위는 기존 초안·문/설비 후보 수준을 유지한다.

## 수정한 동작

PDF가 선택한 Scene 대신 현재 편집기의 도면 축척만 검사했다. 현재 도면 B가 미보정이면 보정된 Scene A만 선택해도 저장하지 못했고, 현재 도면이 보정됐으면 미보정 Scene도 내보낼 수 있었다.

`pdfSections`는 실제 출력할 배치마다 축척을 검사한다. 기본 배치 출력과 명시적인 페이지 순서 모두 같은 검사 함수를 거친다. 오류에는 해당 배치 이름이 표시된다. 선택하지 않은 현재 도면은 출력 조건에 영향을 주지 않고, 현재 배치를 실제로 포함하면 종전 축척 제한을 지킨다. 페이지 편집기가 미리 읽는 `pdfBatch`에는 검사를 넣지 않아 선택하기 전부터 화면이 실패하지 않게 했다. GLB·공개 초안의 기존 제한은 유지한다.

## 같은 도면 작업에서 확인한 전달

입력은 [직전 native JPEG 작업의 ZIP](../validation/scene-plan-2026-10-11/project.gonggan.zip)이다. SHA-256은 `960603a394cc03cf4f2c5351c6dbcd0932d26fd994b80e96824b159ecb0fb26f`다. Scene A는 10mm/px와 7,960/5,960mm 벽을 저장했다. B는 참고 도면과 기존 실제 단위 벽을 유지하며 첫 벽 끝점이 8,360mm, 두 번째 벽이 비스듬한 상태다.

1. 실제 React/jsdom `PdfDialog`에서 현재 배치·3D·벽면도를 제외하고 Scene A만 선택해 **2페이지 PDF**를 저장했다. 미보정 현재 도면 B와 편집 상태는 바꾸지 않았다.
2. 실제 `PlanView` 두 점 보정에서 B의 100px를 100cm로 입력했다. 참고 이미지의 축척만 10mm/px로 바뀌고 기존 벽 좌표는 유지됐다. 보정된 B를 새 Scene으로 저장하고 원래 미보정 B를 남겨 음성 대조에 사용했다.
3. A/보정 B의 평면·벽면 2개·목록을 차례로 출력해 **한글 PDF 8페이지**를 생성했다. PDF.js가 실제 파일을 파싱·래스터화했다. 각 페이지의 Scene 이름과 목록의 벽 길이를 확인했고, 각 평면의 보이는 회색 벽 중심선 **RGB 표본 12개 최대 오차 0**을 확인했다. 흰 벽 채움이 흰 종이와 우연히 일치하는 검사 대신, 별도로 계산한 위치의 중심선을 검사했다. 다른 Scene의 좌표로 검사하면 오차 50 초과로 실패한다. 전체 픽셀 비교나 3D 페이지는 이 근거에 포함하지 않는다.
4. 두 Scene의 실제 GLB를 Three loader로 다시 읽어 벽의 정점과 별도로 계산한 8개 모서리를 비교했다. 최대 오차는 **0.000172mm 미만**이다. 기대 벽을 X축으로 100mm 이동한 대조는 실패한다. Blender 4.4.1도 같은 SHA의 두 파일을 독립적으로 읽어 각 2 Mesh, 총 4벽의 길이·높이·두께·월드 경계를 확인했다. 최대 경계 오차는 **0.001183mm 미만**이며, 같은 A GLB에 100mm 틀린 기대 좌표를 주면 exit 1이다. Blender 수신은 CPU 경계 검사이며 GPU 렌더 근거가 아니다.
5. 실제 공유 준비와 로컬 SQLite/R2/auth fixture의 Worker API로 발행했다. 실제 `SharedViewer` 평면에서 두 Scene을 전환하고 벽 SVG 끝점·796/836cm 길이를 확인했다. 숫자 편집/드래그 입력은 없고 Delete로 편집기나 공개 데이터가 바뀌지 않는다. 도면 이미지·축척·초안과 비공개 메모는 공개 데이터에서 제외된다. 다른 소유자 회수 404, 소유자 회수 204, 공개 조회 410 및 뷰 제거를 확인했다. 이 사례에는 작품 이미지 업로드가 없으며 운영 공유 URL·실제 계정 인증 검증이 아니다.
6. 새 Scene까지 포함한 전체 프로젝트 ZIP을 실제 export/import해 JSON을 정확히 복원했다.

자료: [8페이지 PDF](../validation/scene-plan-delivery-2026-10-11/project.pdf), [A 단독 PDF](../validation/scene-plan-delivery-2026-10-11/selected-A.pdf), [A GLB](../validation/scene-plan-delivery-2026-10-11/Scene-A.glb), [B GLB](../validation/scene-plan-delivery-2026-10-11/Scene-B.glb), [프로젝트 ZIP](../validation/scene-plan-delivery-2026-10-11/project.gonggan.zip), [작업 기록](../validation/scene-plan-delivery-2026-10-11/workflow.json), [검증·해시 기록](../validation/2026-10-11-scene-plan-delivery.json).

## 대조와 남은 인수

임시 최종 소스 복사본에서 제품 `pdfLayout.ts`만 이전 main `ce0c79fbdfa8f6a512bd8ba7227a2e17c93ae59f`로 교체했다. 같은 최종 두 파일/12개는 **6 실패·6 통과**, 수정 후 전부 통과다. 작업 폴더는 되돌리지 않았다. 새 회귀는 축척 선택 5개와 연속 전달 1개다. 대상 4파일/43개, 전체 **1,546개 통과·선택 10 제외**, TypeScript·production build가 통과했다. 기존 큰 청크 안내는 남는다.

소유한 합성 도면, native Canvas/PDF.js, React/jsdom·로컬 Worker 및 Blender CPU 근거다. 미사용 초기 공유 3D 뷰와 브라우저 다운로드/파일·Canvas transport에는 adapter를 썼다. 실제 브라우저/GPU·3D 캡처, 운영 인증/공유 URL·두 기기, 임의 사용자 도면/모델·SketchUp 수신, 성능/성공 지표 및 원문 24단계 전체 인수는 완료로 바꾸지 않는다. 이번 변경은 즉시 재배포하지 않는다. 다음 작업에서는 남은 저장·재열기와 작업 전환 흐름을 점검하고, 실제 브라우저 인수는 별도 근거가 생길 때 연결한다. 유보·유료 후속 범위는 유지한다.
