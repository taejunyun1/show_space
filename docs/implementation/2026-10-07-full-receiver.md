# 바닥·개구부 간격·참고 모델·독립 3D 작품의 외부 수신 검증

기존 Blender 검증의 미확인 범위 중 바닥과 중정, 출입구 간격, 참고 모델, 독립 3D 작품의 실제 GLB 교환을 대조했다. 브라우저 도구의 `failed to write kernel assets: No such file or directory` 오류는 계속된다. 이 독립 수신 검증은 앱의 실제 업로드·공유 3D·프로젝터 캡처 검증을 대신하지 않는다.

## 입력과 실행

`scripts/receiver-fixture.test.ts`는 다른 사용자 파일이나 브라우저 저장소를 읽지 않고 자체 합성 프로젝트를 만든다. 실제 `parseProject`와 `exportProjectGlb` 경로를 호출한다. 6×5m 공간의 벽 5개, 1m 출입구 간격, 1×2m 중정, 원점에서 멀리 저장된 3부품 GLB를 사용했다. 같은 원본을 2배/-30° 참고 모델과 1,800×1,400×600mm 독립 작품으로 각각 배치했다. 작품은 X17°/Y37°/Z-13°로 회전하고 숨긴 복제본도 포함했다.

설치된 Blender 4.4.1의 독립 importer로 출력 GLB를 받아, 앱의 Three.js 행렬을 재사용하지 않는 수식으로 세계 좌표 경계와 단위를 비교했다. 검증기는 합성 fixture 전용이며 임의 사용자 모델 전체의 호환성 검사로 표현하지 않는다.

```sh
GONGGAN_RECEIVER_FIXTURE=1 npx vitest run scripts/receiver-fixture.test.ts
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python-exit-code 1 \
  --python scripts/verify-blender-full-fixture.py -- \
  --glb /tmp/gonggan-full-receiver-20261007/scene.glb \
  --project /tmp/gonggan-full-receiver-20261007/project.json \
  --output-dir /tmp/gonggan-full-receiver-20261007/proof --render
```

샌드박스 Blender는 초기 Metal 탐색에서 exit 139로 종료됐다. 허용된 백그라운드 실행에서는 수신·검증·CPU 렌더가 exit 0으로 완료됐다. 실제 앱 UI를 다른 자동화 도구로 조작하지 않았다.

## 결과

- 벽 5개 세계 좌표 경계의 최대 차이 0.000000477m.
- 바닥 상면 28.000003㎡, 체적 4.480001㎥, 두께 0.16m. 중정 위로 내린 Ray는 바닥을 만나지 않고, 정상 바닥 위치에서는 만났다.
- 1m 출입구 중심 Ray는 벽을 만나지 않고, 이웃 벽 위치에서는 만났다. 출입구는 이미 모델에 있는 벽 사이 간격이며 문/설비 직접 편집 확장을 추가하지 않았다.
- 참고 모델 3부품, 원점 보정과 위치·2배 Scale·-30° 회전 대조의 최대 차이 0.000001907m.
- 독립 작품 3부품의 크기·위치·XYZ 회전 대조 최대 차이 0.000001669m. 숨김 작품은 출력되지 않았다. 작가와 치수 metadata는 유지되고 내부 앱 메모는 제외됐다.
- 실제 Spot 방향과 조사각이 일치했다. 프로젝터를 일반 흰 Spot으로 잘못 출력하지 않았다. 밝기/Lux와 이미지 투사의 수신 동등성은 검증하지 않았다.
- 같은 GLB에 작품 폭 +100mm 또는 중정 형태가 다른 JSON을 주면 각각 exit 1·passed false로 실패했다. 이전 성공 보고서가 남지 않도록 실행 시작부터 passed false를 저장한다.
- CPU 렌더에서는 검증용 카메라·배경만 추가했다. 가져온 형상과 작품 위치를 바꾸지 않았다. 독립 작품 일부는 실제 앞 벽에 가려지고, 벽 모서리의 접합 흔적도 그대로 보인다.

[Blender 수치 보고서](../validation/blender-full-2026-10-07/receiver.json), [성공·실패 및 파일 해시](../validation/blender-full-2026-10-07/verifier-checks.json), [실제 출력 GLB](../validation/blender-full-2026-10-07/scene.glb), [원본 합성 프로젝트](../validation/blender-full-2026-10-07/project.json), [수신 렌더](../validation/blender-full-2026-10-07/overview.png)를 저장했다.

앱 실행 코드는 변경하지 않았다. 실제 SketchUp 재수입·임의 사용자 모델·재질/조명 외관·프로젝터 출력·운영 인증·실기기 및 원문 전체 인수는 여전히 미완료다. 이 결과로 전체 제품 완료를 선언하거나 추가 배포하지 않는다.

후속 상태 확인: 전체 테스트 1,001 통과 / 선택 실행 5 제외, 명시적으로 실행한 수신 fixture 1 통과, TypeScript 검사와 diff 검사 통과. 운영 `/api/auth/config`는 HTTP 200·`enabled:false`였다. Cloudflare의 secret 이름 조회에는 Supabase 설정이 없었다. 실제 로그인 인수에 필요한 프로젝트 URL·공개 publishable key를 사용자에게 요청했으며, 설정이 오기 전 임의 인증 우회나 운영 테스트 계정을 만들지 않는다.
