# 직접 텍스처와 외부 GLB 수신 검증

같은 ANCA 연속 인수 프로젝트에 실제 이미지 `public/artworks/artwork-1.png`를 올려 자동 벽 1에 반복 텍스처로 적용했다. 이미지 한 장의 실제 범위는 2×1m다. 저장 완료 후 재접속에서 유지됐고, Scene D에 저장한 뒤 폭을 2.5m로 변경하고 D를 복원하면 다시 2m였다. 기존 설치 단계도 유지됐다. 사진에서 재질이나 PBR 맵을 생성하는 기능은 아니다.

브라우저 버튼으로 현재 JSON, GLB, PNG를 저장했다. PNG는 1920×1519px이며 텍스처와 작품 이미지를 눈으로 확인했다. 로컬 Worker·로컬 R2에 현재 배치와 Scene D의 읽기 전용 공유를 만들고, 수신 화면의 Scene 전환·벽 선택·치수 표시와 텍스처 렌더링을 확인했다. 실제 스냅샷의 두 배치 모두 반복 크기 2000×1000mm를 유지하며 내부 메모/설치 단계/원본 도면은 없다. 운영 공유 생성이나 실제 계정 인수로 집계하지 않는다.

설치된 Blender 4.4.1의 독립 GLB importer로 새 문서에 출력 파일을 열었다. 벽 17개의 세계 좌표 경계와 높이·두께, 작품 10개의 이미지 평면 400×1200mm를 원본 프로젝트 JSON과 대조했다. 벽 좌표 최대 오차는 0.000001194m다. 이는 앱 데이터와 수신 데이터의 차이이며 원래 도면의 실제 치수 정확도를 증명하지 않는다. 두 이미지가 1024×409px로 GLB에 내장되고 Blender에도 packed 상태로 전달됐다. 벽 UV의 단위와 반복 Scale [0.5, 1, 1]이 일치했다. SPOT·SUN 조명 객체도 전달됐으나 조명 외관의 동등성은 검증하지 않았다.

`scripts/verify-blender-export.py`를 추가해 재현할 수 있게 했다. 실패 시 과거 성공 보고서를 덮어쓰며, 렌더 완료 전에는 성공으로 표시하지 않는다. 텍스처 없는 이전 GLB의 렌더도 성공했고, 높이가 100mm 다른 JSON을 주면 exit 1·passed false로 실패했다. Blender 실행 시 `--python-exit-code 1`을 사용한다.

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python-exit-code 1 \
  --python scripts/verify-blender-export.py -- \
  --glb 'exported.glb' --project 'project.json' \
  --output-dir /tmp/exhibition-blender-proof --render
```

검증 범위는 직선 솔리드 벽·벽에 설치된 이미지 작품의 크기·내장 이미지·벽 텍스처 반복이다. 바닥/개구부/참고 모델/독립 3D 작품/작품 설치 위치/SketchUp 재수입까지 증명하지 않는다. 렌더에는 확인용 카메라와 배경만 추가했다. 전체 렌더는 대비가 낮으며 텍스처 근접 렌더의 오른쪽 작품 일부는 실제 이웃 벽에 가려져 있다. 가져온 형상을 고쳐서 만든 증거가 아니다.

파일 해시와 수치: [연속 인수 기록](../validation/2026-10-07-texture-receiver.json), [Blender 대조](../validation/blender-2026-10-07/receiver.json), [검증기 성공·실패 사례](../validation/blender-2026-10-07/verifier-checks.json). native/share/capture PNG와 Blender 렌더를 같은 validation 폴더에 보존했다.

앱 실행 코드는 변경하지 않아 재배포하지 않았다. 실제 인증/두 기기, 실제 SketchUp 수신, 대표 실기기 성능, 사용자 성공 지표와 문서 2 확장은 여전히 남아 있다. 이번 Scene D를 넣은 PDF 출력은 별도로 확인해야 한다. 원문 1 §40 전체 완료로 판정하지 않는다.
