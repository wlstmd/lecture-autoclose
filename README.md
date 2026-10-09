# KMU Lecture Auto End

계명대학교 교수학습지원시스템(`ctl.kmu.ac.kr`)에서 온라인 강의 영상이 끝나면 **'학습종료' 버튼을 자동으로 눌러** 학습창을 닫는 Chrome / Firefox 확장 프로그램입니다. 강의를 켜 두고 자리를 비워도 수강 시간이 계속 쌓이지 않습니다.

강의를 여는 것은 직접 하고, 이 확장 프로그램은 지켜보다가 끝났을 때 종료만 합니다. 학습활동 글쓰기 등 다른 동작은 자동화하지 않습니다.

## 파일

```
extension/
├── manifest.json   Chrome용 설정 (Manifest V3)
└── content.js      종료 감지 및 학습종료 로직 (두 브라우저 공용)
firefox/
└── manifest.json   Firefox용 설정 (Gecko ID, 최소 버전, 데이터 수집 선언 추가)
build.ps1           dist/ 에 브라우저별 폴더와 zip 생성
```

`content.js`는 페이지의 `endStudy()`, `apiManager` 같은 함수에 접근해야 해서 `"world": "MAIN"`(페이지와 같은 실행 환경)으로 실행됩니다. Chrome 111 이상, Firefox 140 이상이 필요합니다. 플레이어가 iframe 안에 있으므로 `all_frames: true`로 모든 프레임에 들어갑니다.

두 브라우저는 `content.js`를 그대로 공유하고 `manifest.json`만 다릅니다. 버전을 올릴 때는 두 manifest의 `version`을 같이 바꿉니다(다르면 `build.ps1`이 멈춥니다).

## 빌드

```powershell
./build.ps1
```

`dist/chrome`, `dist/firefox` 폴더와 각각의 zip이 만들어집니다. Firefox 패키지 검사는 `npx web-ext lint --source-dir dist/firefox`로 할 수 있습니다.

## 동작 방식

학습창은 두 부분으로 되어 있고, 확장 프로그램도 양쪽에서 각각 실행됩니다.

| 위치 | 주소 | 역할 |
| --- | --- | --- |
| 학습창 (팝업) | `ctl.kmu.ac.kr/Lesson.do?cmd=viewStudyContentsForm…` | 학습 시간 기록, '학습종료' 버튼 |
| 영상 플레이어 (iframe) | `kcms.kmu.ac.kr/em/…` | UniPlayer 영상 재생 |

1. **플레이어**: 강의 하나가 여러 조각 영상(story)으로 나뉘어 있어서, 일반 `<video>` 종료 이벤트로는 첫 조각에서 잘못 종료됩니다. 그래서 UniPlayer가 **마지막 조각까지 끝났을 때만** 발생시키는 `contentEnd` 이벤트를 가로챕니다. 보조로 `uniPlayer._isRestartReady`(다시보기 버튼 표시 상태)도 2초마다 확인합니다.
2. 종료를 감지하면 `postMessage`로 학습창에 알립니다. 학습창은 `kcms.kmu.ac.kr`에서 온 메시지만 받습니다.
3. **학습창**: 3초 뒤 LMS의 `endStudy()`를 호출합니다. '학습종료' 버튼과 같은 함수로, 학습 기록을 서버에 저장한 뒤 창을 닫습니다.
4. 15초가 지나도 창이 열려 있으면 직접 닫습니다.
5. **안전장치**: 영상 종료를 감지하지 못하더라도 학습창을 연 지 90분이 지나면 학습종료합니다.

학습창을 X로 그냥 닫으면 출석이 인정되지 않을 수 있다고 LMS가 안내하고 있어서, 반드시 `endStudy()`를 거쳐 종료합니다.

학습종료 후 원래 강의 목록 창에 "학습활동 글쓰기" 안내 알림이 뜰 수 있습니다. 이 알림은 LMS가 띄우는 것이며 확장 프로그램은 건드리지 않습니다.

## 설정

`extension/content.js` 상단의 상수를 고친 뒤 확장 프로그램을 새로고침합니다.

| 상수 | 기본값 | 설명 |
| --- | --- | --- |
| `GRACE_MS` | 3000 | 영상 종료 후 학습종료까지 기다리는 시간(ms) |
| `FORCE_CLOSE_MS` | 15000 | 학습종료 후 창이 안 닫히면 직접 닫기까지의 시간(ms) |
| `MAX_MINUTES` | 90 | 학습창을 연 뒤 강제 학습종료까지의 시간(분). `0`이면 사용 안 함 |

`MAX_MINUTES`는 영상을 일시정지해 둔 시간도 포함합니다. 한 차시를 90분 넘게 보는 경우 값을 늘리거나 `0`으로 바꾸세요.

## 확인 방법

F12 → Console에서 `[KMU-AutoEnd]` 로그를 볼 수 있습니다. 플레이어 iframe의 로그는 Console 상단의 컨텍스트 선택에서 `kcms.kmu.ac.kr`를 골라야 보입니다.

- `플레이어 종료 이벤트 연결 완료`: 플레이어 쪽 정상
- `LMS 학습창 감시 시작`: 학습창 쪽 정상
- `강의 전체 종료 감지` → `학습종료 실행`: 종료 동작
