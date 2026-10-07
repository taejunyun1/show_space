# 프로젝터 이미지 실패 격리와 캡처 준비

2026-10-08 완료 기록 (10-07 착수). 인증 설정과 브라우저 연결 대기를 보류한 상태에서 원문 2 §61의 프로젝터 및 §48의 캡처 연결을 보완했다.

기존 `LoadedProjector`는 이미지 프레임을 render의 useMemo에서 만들었다. Canvas 준비/그리기 실패가 throw되면 해당 프로젝터를 넘어 3D 화면 오류로 전달됐다. 이미지 디코딩 실패는 화면 라벨만 있었고 캡처의 조명 준비 검사에는 알려지지 않아 일반적인 3초 시간 초과로 바뀌었다. 로컬 발표에서 이미지가 누락된 경우 조명 객체 자체가 없어 실패와 대기를 구별하기 어려웠다.

현재 프로젝터별 rig는 이미지가 없는 경우에도 남는다. 현재 위치·타깃·투사 설정·소스와 함께 준비/오류 상태를 기록하며, 실패 또는 대기 중에는 map을 제거하고 밝기를 0으로 유지한다. decoder와 fitted Canvas 실패는 프로젝터 라벨로 표시하고 나머지 조명/3D 장면은 유지한다. 프레임 맵 생성은 effect가 소유하고 교체/unmount/StrictMode cleanup 때 해제한다. 이전 소스/비율/fit의 map과 오류를 새 입력의 상태로 사용하지 않는다.

`projectorMapReady`는 실제 SpotLight.map 및 현재 입력을 확인한다. 자산 대기와 조명 profile 검사 모두 이 함수를 사용하며, 다른 프로젝터가 아직 대기 중이어도 현재 소스의 확정된 실패는 즉시 전달한다. 숨긴 프로젝터는 제외한다. 이미지 주소는 값으로 비교하고 작은 위치/투사 설정만 JSON화해 캡처 polling마다 수 MiB의 base64를 다시 직렬화하지 않는다. 로컬 발표의 누락 자산은 공개 API로 우회하지 않는다. PDF의 기존 detached 디코딩/준비 및 GLB/glTF의 투사 제외 범위는 유지한다.

새 `Lighting3D.lifecycle.test.tsx`는 실제 React Three Fiber reconciler, `Lighting3D`, `useArtworkTexture`, texture pool, Three TextureLoader/SpotLight, native PNG decoder와 Canvas 픽셀을 연결한다. 최초 네 사례는 수정 전 실제 실패를 재현했고 수정 뒤 다음 일곱 사례가 통과했다.

- 실제 이미지가 decode되어 조명에 붙기 전까지 캡처 대기, 반영 후 성공.
- fit 교체 시 이전 설정 제외와 새 owned map 반영/해제, 조명 제거 시 자원 해제.
- 손상 PNG 실패 즉시 전달, 실패 소스를 정상 이미지로 교체 시 이전 오류 제외.
- 이미 decode된 이미지의 다음 framing Canvas 실패가 전체 3D 화면에 전파되지 않음.
- 로컬 발표 자산 누락 시 실패 rig 유지, 공개 이미지 fallback 요청 없음.
- 첫 프로젝터 대기/두 번째 실패 동시 상황의 오류 전달, 숨김 이후 실패 제외.
- 소스 변경 후 이전 PNG가 늦게 decode되어도 붙지 않음. 새 빨간 PNG의 실제 fitted map 픽셀 `[255,0,0,255]` 확인.
- StrictMode cleanup/restart 이후 현재 맵 사용, unmount 시 현재 owned map 한 번 해제.

위 목록의 대기/fit/제거 동작은 하나의 회귀에서 연속 검증한다. 전체 테스트 1,148 통과 / 선택 10 제외, 관련 31회귀 통과, TypeScript/Vite production build 및 diff 검사 통과. `@react-three/test-renderer@9.1.1`은 React 19/Fiber 9에 호환되는 개발 의존성이다.

테스트 렌더러의 WebGL context는 mock이고 DOM 라벨 portal과 Image 이벤트 전송은 adapter다. 실제 R3F scene commit과 native raster 근거가 추가된 것이며, GPU 투사/차폐/톤매핑 또는 최종 PNG/PDF 픽셀·실제 브라우저 입력까지 증명하지 않는다. 운영 인증/두 기기/대표 사용자 모델/원문 24단계 인수는 계속 남긴다. 이 변경은 Git에 기록하며 즉시 재배포하지 않는다. 공개 웹의 직전 배포 소스는 `8fb69dc`다.
