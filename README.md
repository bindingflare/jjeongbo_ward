# jjeongbo_ward
## 개인정보와드 서비스 리포지토리
- Frontend (this repo): https://github.com/bindingflare/jjeongbo_ward
- 크롬 익스텐션 (Chrome): https://github.com/bindingflare/jjeongbo_ward_chrome_extension
- Backend: https://github.com/bindingflare/swai_backend

## 개요
- 개인정보 동의서 체크, 개인정보 유출 알림 해주는 도우미 서비스 입니다.

## 사이트 맵
- `index.html` — 메인 페이지
- `analysis-result.html` — (익스텐션) 전체 결과보기 페이지
- `news-launch.html` — 서비스 론칭 페이지
- `news-only-full.json`, `news-only.json` — 뉴스 피드 (json)
- `privacy.html`, `ads.txt` — 관리용 (광고, 프라이버시)
- `news/` — 뉴스 페이지들 `news-detail.html`, `news-lottecard.html`, `news-skt.html`.
- `news-premium/` — PRO 버전 최신 뉴스 페이지들 `news-coupang.html`.
- `css/`, `js/`, `images/`, `videos/` — 코드, 이미지, 비디오 관련 파일

## 기술 스택
- JS, HTML+CSS
- Manifest V3 (MV3)
- Render (Backend)
- Netlify (Frontend)

## 실행 (로컬)
```
# from repo root
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

## 배포
- Frontend -> Netflify (리포지토리 연결)
- Backend -> Render (리포지토리 연결)
(크롬 익스텐션은 배포 필요 X)
