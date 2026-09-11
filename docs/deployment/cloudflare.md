# Cloudflare 검증용 배포

- 계정: taejun.foto@gmail.com (Wrangler whoami로 확인)
- URL: https://gonggan-exhibition-preview.taejunyun.workers.dev
- Worker: gonggan-exhibition-preview
- 배포일: 2026-09-11
- 버전: 53e761c6-1158-4040-84b4-913af4f824ae
- 방식: Cloudflare Workers Static Assets, dist만 배포, SPA fallback
- 설정: wrangler.jsonc. 계정 ID를 고정하여 다른 계정으로 잘못 배포하지 않도록 설정함. 인증 정보는 프로젝트에 저장하지 않음.

재배포: `npm run deploy` (빌드 후 Wrangler 배포). 해당 계정 로그인이 필요하다.

배포 전 빌드 및 테스트 129개 통과. 공개 HTTPS에서 3D 렌더링과 숫자 테스트 이미지 업로드의 자동 OCR/선 분석 확인(숫자 표기 5개). 브라우저 오류 로그 없음. 테스트 이미지는 채택하지 않고 취소했다.

현재 프로젝트는 브라우저 IndexedDB에 저장한다. 로컬 주소에서 작업한 데이터는 공개 주소로 자동 이전되지 않으므로 JSON 내보내기/불러오기로 옮긴다. 계정 로그인·서버 저장·동기화는 아직 없으며 전체 전시장 자동 생성 마일스톤도 미완료다. 사용자 도면을 Cloudflare 저장소로 전송하는 업로드 서버는 추가하지 않았다.

## 소스 관리

GitHub: https://github.com/taejunyun1/show_space · 기본 브랜치 main. Cloudflare 배포는 현재 로컬 `npm run deploy`로 실행한다. GitHub push만으로 자동 배포되도록 연결한 상태는 아니다.
