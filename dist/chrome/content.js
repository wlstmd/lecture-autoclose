(function () {
  "use strict";

  const MSG_TYPE = "kmu-lecture-auto-end:content-end";
  const LMS_ORIGIN = "https://ctl.kmu.ac.kr";
  const PLAYER_ORIGIN = "https://kcms.kmu.ac.kr";
  const GRACE_MS = 3000;
  const FORCE_CLOSE_MS = 15000;
  const MAX_MINUTES = 90;

  const w = window;

  function log(...args) {
    console.log("[KMU-AutoEnd]", ...args);
  }

  function runPlayerSide() {
    let notified = false;

    function notify(reason) {
      if (notified) return;
      notified = true;
      log("강의 전체 종료 감지:", reason);
      window.top.postMessage({ type: MSG_TYPE }, LMS_ORIGIN);
    }

    function hook() {
      const pe = w.apiManager && w.apiManager.getPlayerEvent && w.apiManager.getPlayerEvent();
      if (!pe || typeof pe.contentEnd !== "function") return false;
      if (!pe.__kmuAutoEndHooked) {
        const original = pe.contentEnd;
        pe.contentEnd = function () {
          const result = original.apply(this, arguments);
          notify("contentEnd");
          return result;
        };
        pe.__kmuAutoEndHooked = true;
        log("플레이어 종료 이벤트 연결 완료");
      }
      return true;
    }

    const hookTimer = setInterval(() => {
      if (hook()) clearInterval(hookTimer);
    }, 1000);

    setInterval(() => {
      if (w.uniPlayer && w.uniPlayer._isRestartReady === true) notify("restart ready");
    }, 2000);
  }

  function runLmsSide() {
    if (!/cmd=viewStudyContentsForm/.test(location.search)) return;

    let ending = false;
    const openedAt = Date.now();

    const badge = document.createElement("span");
    badge.style.cssText = "margin-right:8px;font-size:12px;color:#2a7;font-weight:bold;";
    const endBtn = document.querySelector("a[href*='endStudy']");
    if (endBtn && endBtn.parentNode) endBtn.parentNode.insertBefore(badge, endBtn);

    function setBadge(text) {
      badge.textContent = text;
    }

    function endNow(reason) {
      if (ending) return;
      ending = true;
      log("학습종료 실행:", reason);
      setBadge(`자동 종료 중 (${reason})`);
      w.alert = (msg) => log("alert 무시:", msg);
      w.confirm = () => true;
      if (typeof w.endStudy === "function") w.endStudy();
      setTimeout(() => {
        log("창이 아직 열려 있어 직접 닫습니다");
        w.top.close();
      }, FORCE_CLOSE_MS);
    }

    window.addEventListener("message", (e) => {
      if (e.origin !== PLAYER_ORIGIN || !e.data || e.data.type !== MSG_TYPE) return;
      setBadge(`영상 종료 감지 · ${GRACE_MS / 1000}초 후 학습종료`);
      setTimeout(() => endNow("영상 종료"), GRACE_MS);
    });

    setInterval(() => {
      if (ending) return;
      const elapsedMin = (Date.now() - openedAt) / 60000;
      if (MAX_MINUTES > 0 && elapsedMin >= MAX_MINUTES) {
        endNow(`${MAX_MINUTES}분 초과`);
        return;
      }
      const left = MAX_MINUTES > 0 ? ` · 최대 ${Math.ceil(MAX_MINUTES - elapsedMin)}분 남음` : "";
      setBadge(`⏻ 자동 종료 대기 중${left}`);
    }, 5000);

    setBadge("⏻ 자동 종료 대기 중");
    log("LMS 학습창 감시 시작");
  }

  if (location.origin === PLAYER_ORIGIN) runPlayerSide();
  else if (location.origin === LMS_ORIGIN && window.top === window.self) runLmsSide();
})();
