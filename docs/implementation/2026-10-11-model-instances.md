# 3D 모델 편집·공유에서 객체 구조 재사용

2026-10-11. [같은 전시의 잠긴 공유](2026-10-11-exhibition-sharing-workflow.md)에 이어 모델을 이동·회전·크기 변경할 때의 불필요한 객체 재생성을 줄였다. 원문 1 §8/31–37 및 원문 2 §18/54/63–65의 형상 보존·경량화에 해당한다.

## 변경

기존 캐시는 모델 파일의 형상·재질·텍스처를 공유했지만, 편집 중 작품 객체가 바뀔 때 `placeModelArtwork`가 모든 자식 노드를 다시 복제했다. 공개 작품/전시장에서도 배치 속성이나 발표 자산 컨테이너가 바뀌면 원본 크기 검사와 객체 복제가 반복됐다.

이제 원본이 바뀔 때만 화면용 노드를 복제하고, 같은 객체 구조의 상위 group에 위치·XYZ 회전·실제 크기·기준점을 갱신한다. 편집기와 공개 작품/전시장에 적용한다. 화면과 GLB 출력의 작품 배치 수식·공개 metadata를 같은 함수로 유지한다. 전시장 원점 보정도 별도 group으로 옮겨 로드된 원본 scene의 좌표를 유지한다.

공개 모델의 로딩/오류는 공유 ID·자산 ID·로컬/공개 경로·원본 크기/기준점에 묶는다. 배치 정보만 달라졌을 때는 같은 로드를 유지하고, 다른 원본이나 불일치하는 저장 크기는 이전 형상으로 표시하지 않는다. 기존 마지막 사용자 해제 후 geometry/material/texture 정리 소유권은 유지한다.

설계 참고: [Three.js Object3D clone](https://threejs.org/docs/pages/Object3D.html#clone), [React Three Fiber 객체/자원 소유권](https://r3f.docs.pmnd.rs/api/objects). 실제 구현은 설치된 Three.js 0.180.0과 Fiber 9.3.0으로 확인했다.

## 검증

실제 React/R3F reconciler·GLTFLoader·Three 객체와 editor 명령으로 새 8개 검사를 실행했다. 이동/치수/정보 수정/undo의 동일 노드 유지, 반복 미리보기/취소, StrictMode 복제 자원 수명, 공개 작품/전시장 배치 변경, 원본 좌표 보존, 크기 불일치/복구, 발표 자산 컨테이너 변경을 검사한다. 같은 최종 8개를 이전 제품 코드에 적용하면 6 실패/2 통과, 수정 후 8 통과다.

100개 부품 모델을 실제 입력 파서로 읽어 50점 배치했다. 5000 Mesh가 geometry 1개를 공유하고 모델 decode는 1회다. 12번 이동/회전 미리보기 동안 추가 source clone은 0회, 모든 작품의 노드와 geometry/material은 유지되며 취소 뒤 위치가 복원된다. 이는 객체 생성량 근거이며 FPS나 draw-call 감소를 뜻하지 않는다.

기존 실제 가져오기·손상 텍스처/실패 정리·ZIP·GLB/glTF 수신 검사와 합쳐 대상 28개 통과. 전체 1,354 통과/선택 10 제외, 233 파일 통과/10 파일 제외, TypeScript·production build·diff 검사 통과. 큰 청크 안내는 유지한다.

공통 출력 배치 변경에 따라 합성 전체 형상 fixture를 생산용 GLB 출력 경로로 다시 만들고 Blender 4.4.1 독립 importer에 전달했다. 벽 5개, 28㎡ 중정 바닥/160mm 두께·빈 중정 Ray, 1m 출입구 간격, 전시장 기준점/2배/-30°, 1800×1400×600mm 작품의 X17/Y37/Z-13 회전과 숨김 제외/metadata, Spot 방향이 통과했다. 이번에는 렌더를 요청하지 않았다. 이전 동일 fixture의 형상 BIN은 유지됐고 전체 GLB는 scene metadata가 달라 파일 해시는 다르다.

- [검증·명령·해시 기록](../validation/2026-10-11-model-instances.json)
- [50점 객체 재사용 기록](../validation/model-instances-2026-10-11/instance-checks.json)
- [Blender 수신 결과](../validation/model-instances-2026-10-11/receiver.json), [GLB](../validation/model-instances-2026-10-11/receiver.glb)

## 남은 범위

합성 모델/CPU 객체 검증이며 대표 사용자 전시장, 실제 브라우저/GPU·FPS·전체 VRAM·입력 지연 p95·OS 포인터·실기기 인수는 남아 있다. 5000 Mesh의 draw call을 합치거나 원본 geometry를 단순화한 구현은 아니다. Annotation/line/gizmo portal과 test renderer WebGL transport는 어댑터다. 운영 계정·외부 공유 URL·전체 24단계·사용자 지표·SketchUp도 완료로 바꾸지 않으며 이번 변경은 배포하지 않는다.

다음은 라이선스와 원본을 확인할 수 있는 외부 정적 PBR 모델의 실제 입력·자산 보존·GLB 수신을 추가하고, 복잡한 모델의 허용/오류 안내를 확인한다. 실제 사용자 전시장/기기 인수와 사진→재질 유료 생성·IES/조도 분석·AI 배치 등 후속 요구는 별도로 유지한다.
