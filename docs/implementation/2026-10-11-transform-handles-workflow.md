# 3D 작품·조명의 공통 이동/회전 핸들

작성일: 2026-10-11. 도면 초안 이후 자유 편집·치수·시점·캡처·잠긴 공유를 우선하며, 문/설비/설치 제외 영역 직접 편집과 유료 생성 범위를 추가하지 않는다.

## 구현한 동작

독립 3D 작품과 조명은 이전에 Drei PivotControls의 마지막 move 값만 저장하고 오브젝트 ID만 확인했다. 새 외부 드래그도 이전 end/unmount가 끝낼 수 있었으며, 다른 포인터·Escape·capture loss와 같은 렌더 사이의 선택/벽 왕복을 충분히 구분하지 않았다. 선택한 조명에는 회전 도구로 조준 방향을 바꾸는 핸들이 없었다.

이 두 핸들을 공통 Three.js 축 화살표/회전 링으로 교체했다. XYZ 축 이동과 회전, 카메라에 따른 화면 크기 유지, 핸들 우선 hit, Shift 10° 회전 및 Alt 스냅 우회를 제공한다. 기존 숫자 크기 입력과 모델 자산/노드 재사용은 유지한다. 마우스를 놓는 유효 ray도 적용하며 한 번의 Undo로 저장한다. 축과 ray가 평행하거나 유효한 회전 교차가 없으면 마지막 유효 미리보기를 유지한다. 확대·시점 변경의 실제 브라우저 인수는 별도다.

프로젝트 객체·뷰·도구·선택·활성 벽·포인터·store gesture identity를 구분한다. 화면 전환·새 편집·Escape·capture loss·unmount는 자신의 preview/capture만 정리하며, 같은 오브젝트의 새 외부 gesture나 한 번도 시작하지 않은 gesture를 끝내지 않는다. 우클릭을 거절하고 그룹 잠금 검사와 전역 Scene/캡처 보호를 사용한다. 조명 시작은 이전 벽/작품/모델 gesture도 정리한다.

조명 이동은 위치와 조준점을 함께 옮긴다. 회전은 원래 조준 거리와 위치를 유지하며 target을 회전시킨다. Kelvin·빔 각도·밝기·프로젝터 설정 등 다른 속성은 유지한다. Spot·Area·프로젝터가 같은 위치/target 모델을 사용하지만 이번 연속 파일 수신은 Spot으로 검증했다. Area/프로젝터의 표면 외관·GLB 지원 범위를 완료했다고 집계하지 않는다.

## 같은 전시에서의 검증

최종 새 35개는 이전 `40ad4ff`의 세 제품 파일을 복원하고 실제 원래 Drei PivotControls를 유지했을 때 27 실패/8 통과다. 제품 behavior shim은 없으며 현재 파일은 finally에서 바이트 그대로 복구했다. 수정 후 새 35개와 관련 6개 파일 95개가 통과했다. Quaternion realm/Spot 부모 node/Scene helper/act 및 ray 삼각형 seam의 검증 어댑터 오류는 제품 실패로 집계하지 않는다.

실제 R3F reconciler·GLTFLoader·Three geometry/light·store를 사용했다. 포인터 ray/capture target과 Line/annotation/WebGL transport만 어댑터다. 각 XYZ 이동·세 축 90° 회전, 실제 축 hit geometry raycast, 그룹, release·단일 Undo, 두 포인터, 잠금 중단, 프로젝트/선택/벽/뷰/도구 왕복, 추가 편집, Escape/capture loss/unmount와 새 외부 gesture 보존을 확인했다.

소유한 원점에서 떨어진 3부품 GLB 아치 두 점으로 다음을 연결했다.

- 실제 핸들로 그룹 최종 400mm 이동 → 첫 Scene. 로더 자산과 실제 모델 node를 유지한다.
- 그룹 90° 회전 → Spot 최종 600mm 이동·조준 90° 회전 → 작품 잠금 → 둘째 Scene.
- 실제 모델 world 외곽과 별도 8모서리 좌표 비교, Scene별 잠금/배치와 원본 불변, ZIP의 정확한 JSON 복원·CRC·자산 해시.
- 실제 공유 준비의 두 Scene/모델 두 점·원본 자산 1개 중복 제거·조명 target 보존. 운영 URL 발행으로 주장하지 않는다.
- 실제 GLTFExporter의 두 GLB를 GLTFLoader로 다시 읽어 모델 node·위치/형상·Spot을 확인.
- 별도 Blender 4.4.1 importer의 Scene당 Mesh 11개/아치 6부품·72삼각형. 모든 부품 정점을 원본 아치 형상·저장 치수/XYZ pose에서 독립 계산한 값과 비교. 최대 오차 약 0.00078mm, Spot 위치 오차 0mm·조준 벡터 오차 약 1.2e-7 이하.
- 독립 수신 기대 위치를 100mm 바꾼 대조는 실제 부품 정점과 약 100mm 어긋나며 Blender 프로세스가 exit 1로 실패한다.

전체 1,494개 통과/선택 10개 제외와 TypeScript·Vite 빌드가 통과했다. 기존 500kB chunk 안내는 유지한다.

[연속 데이터](../validation/transform-handles-2026-10-11/workflow.json), [전시 백업](../validation/transform-handles-2026-10-11/project.gonggan.zip), [Scene A GLB](../validation/transform-handles-2026-10-11/scene-A.glb), [Scene B GLB](../validation/transform-handles-2026-10-11/scene-B.glb), [독립 수신](../validation/transform-handles-2026-10-11/receiver.json), [100mm 실패 대조](../validation/transform-handles-2026-10-11/receiver-negative.json), [명령·소스·자산 해시](../validation/2026-10-11-transform-handles-workflow.json).

## 남은 범위

다음은 문서 2 §60에 남은 영상 작품의 2D 포스터 비율/크롭·벽면 캡처/PDF와 원본/Scene 전달을 연결한다. 실브라우저/GPU·실제 3D 캡처·FPS/전체 VRAM/p95·운영 인증/URL·두 기기·원문 24단계·실사용 지표·SketchUp 수신 및 후속 유료 생성·IES/AI 범위는 남아 있다. 기존 인증/브라우저 연결 대기는 유보하며 이번 변경은 배포하지 않는다.
