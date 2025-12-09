/* Front-end logic: visit tracking, signup, analyzer */
(function () {
  // 본인의 app script 주소를 넣을 것 (Apps Script Web App URL)
  const ADDR_SCRIPT = 'https://script.google.com/macros/s/AKfycbxknEwAXqcw6kr-EgsGmui7ngK_RreZy495wUFHVqXw7CYuTAomQt_NrAhkbF367I6Z/exec';
  const ANALYZE_ENDPOINT = 'https://swai-backend.onrender.com/api/check';

  // Sam pading value to start with 0. eg: 01, 02, .. 09, 10, ..
  function padValue(value) {
    return (value < 10) ? "0" + value : value;
  }

  function getTimeStamp() {
    const date = new Date();

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const formattedDate = `${padValue(year)}-${padValue(month)}-${padValue(day)} ${padValue(hours)}:${padValue(minutes)}:${padValue(seconds)}`;

    return formattedDate;
  }

  

  // Dependencies are loaded dynamically to avoid editing HTML
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function loadCssOnce(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function ensureAssignmentDeps() {
    loadCssOnce('https://cdn.jsdelivr.net/npm/busy-load/dist/app.min.css');
    loadCssOnce('https://cdn.jsdelivr.net/gh/dinoqqq/simple-popup@master/dist/jquery.simple-popup.min.css');
    return Promise.resolve()
      .then(() => loadScriptOnce('https://unpkg.com/axios/dist/axios.min.js'))
      .then(() => loadScriptOnce('https://cdn.jsdelivr.net/npm/busy-load/dist/app.min.js'))
      .then(() => loadScriptOnce('https://cdn.jsdelivr.net/gh/dinoqqq/simple-popup@master/dist/jquery.simple-popup.min.js'));
  }

  // JSONP IP — getIP(json)와 동일한 역할 (ip 값을 채움)
  let jsonpIP = 'unknown';
  function loadJsonpIP() {
    return new Promise((resolve) => {
      const cb = '__wardGetIP';
      if (!window[cb]) {
        window[cb] = function (json) {
          try { jsonpIP = (json && json.ip) ? json.ip : 'unknown'; } catch (e) { jsonpIP = 'unknown'; }
          resolve(jsonpIP);
        };
      }
      const src = 'https://jsonip.com?format=jsonp&callback=' + cb;
      if (document.querySelector(`script[src^="https://jsonip.com"]`)) return resolve(jsonpIP);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onerror = () => resolve(jsonpIP);
      document.head.appendChild(s);
      // resolve anyway after timeout to avoid blocking
      setTimeout(() => resolve(jsonpIP), 1500);
    });
  }

  // 쿠키에서 값을 가져오는 함수
  function getCookieValue(name) {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  // 쿠키에 값을 저장하는 함수
  function setCookieValue(name, value, days) {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/';
  }

  function getUVfromCookie() {
    // 6자리 임의의 문자열 생성
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    // 쿠키에서 기존 해시 값을 가져옴
    const existingHash = getCookieValue('user');
    // 기존 해시 값이 없으면, 새로운 해시 값을 쿠키에 저장
    if (!existingHash) {
      setCookieValue('user', hash, 180); // 쿠키 만료일은 6개월 
      return hash;
    }
    // 기존 해시 값이 있으면 기존 값 반환
    return existingHash;
  }

  function getMobileFlag() {
    var mobile = 'desktop';
				if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          // true for mobile device
					mobile = 'mobile';
				}
    return mobile;
  }

  /* UTM은 Landing URL 의 끝에 ?utm=yonsei 형식으로 지정할 수 있음 */
  function getUTMSimple() {
    try {
      var queryString = location.search;
      const urlParams = new URLSearchParams(queryString);
      return urlParams.get("utm")
    } catch (e) { return ""; }
  }
  
  function resolveAnalyzerEndpoint(override) {
    return override
      || (typeof window !== 'undefined' ? window.__wardAnalysisEndpointOverride : undefined)
      || ANALYZE_ENDPOINT;
  }
  
  async function callRemoteAnalyzer(text, endpointOverride) {
    const endpoint = resolveAnalyzerEndpoint(endpointOverride);
    if (!endpoint) throw new Error('Analyzer endpoint missing');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Analyzer HTTP ' + res.status);
    const data = await res.json().catch(() => ({}));
    const s = (data && (data.score ?? data.riskScore ?? (data.result ? data.result.score : undefined)));
    const l = (data && (data.label ?? (data.result ? data.result.label : undefined)));
    const b = (data && (data.bullets ?? data.issues ?? (data.result ? data.result.bullets : undefined))) || [];
    let score = typeof s === 'number' ? s : 0;
    score = Math.max(0, Math.min(100, score));
    let label = l || '(레이블 정보 없음)';
    const bullets = Array.isArray(b) ? b : [];
    return { score, label, bullets };
  }

  function assignmentSendVisitor() {
    if (!ADDR_SCRIPT) return;
    /* data를 만들 땐 모든 field가 들어 있어야 함 */
    const payload = JSON.stringify({
      id: getUVfromCookie(),
      landingUrl: window.location.href,
      ip: jsonpIP,
      referer: document.referrer || '',
      time_stamp: getTimeStamp(),
      utm: getUTMSimple(),
      device: getMobileFlag()
    });
    /* axios request (fallback to fetch if axios not available) */
    const url = ADDR_SCRIPT + '?action=insert&table=visitors&data=' + encodeURIComponent(payload);
    const req = (window.axios && window.axios.get) ? window.axios.get(url)
               : fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true });
    Promise.resolve(req).catch(error => {
      try {
        if (error && error.response) {
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error && error.request) {
          // 요청이 전송되었지만 응답을 받지 못한 경우
          console.log(error.request);
        } else {
            // 요청 설정 중에 오류가 발생한 경우
            console.log('Error', error.message);
        }
      } catch (_) {}
    });
  }

  function ensurePopupContainer() {
    if (!document.getElementById('popup')) {
      const div = document.createElement('div');
      div.id = 'popup';
      div.style.display = 'none';
      div.innerHTML = '<h1>감사합니다. </h1><p>이제는 우리는 같은 배를 탔습니다. </p>';
      document.body.appendChild(div);
    }
  }

  function assignmentBindSignup() {
    if (!ADDR_SCRIPT || !window.jQuery) return;
    ensurePopupContainer();
    const $ = window.jQuery;
    // Map to existing form/inputs in this template
    const $form = $('form.contact-form');
    if ($form.length === 0) return;
    $form.on('submit', function (e) {
      e.preventDefault();
      // 입력값 읽기
      const email = $('#email').val() || '';
      const advice = $('#message').val() || '';
      const re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
      // 이메일 유효성 체크
      if (!email || !re.test(email)) {
        alert('이메일이 유효하지 않아 알림을 드릴 수가 없습니다. ');
        return false;
      }
      const payload = JSON.stringify({ id: getUVfromCookie(), email: email, advice: advice });
      if ($.busyLoadFull) $.busyLoadFull('show');
      const url = ADDR_SCRIPT + '?action=insert&table=tab_master&data=' + encodeURIComponent(payload);
      const req = (window.axios && window.axios.get) ? window.axios.get(url)
                 : fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true });
      Promise.resolve(req)
        .then(() => {
          $('#email').val('');
          $('#message').val('');
          if ($.busyLoadFull) $.busyLoadFull('hide');
          if ($.fn && $.fn.simplePopup) $.fn.simplePopup({ type: 'html', htmlSelector: '#popup' });
        })
        .catch(() => {
          // 에러 시 로딩 해제 (필요 시 상세 처리 가능)
          if ($.busyLoadFull) $.busyLoadFull('hide');
        });
      return false;
    });
  }

  

  function updateAnalysisUI(result) {
    const resultCard = document.getElementById('analysisResult');
    const scoreEl = document.getElementById('riskScore');
    const labelEl = document.getElementById('riskLabel');
    const ul = document.getElementById('riskBullets');
    const meterEl = document.getElementById('riskMeter');
    if (!resultCard || !scoreEl || !labelEl || !ul) return;

    resultCard.classList.remove('d-none');
    scoreEl.textContent = `${result.score}`;
    labelEl.textContent = `위험도: ${result.label}`;
    // Animate water meter fill + color (blue→green→yellow→red)
    if (meterEl) {
      var target = Math.max(0, Math.min(100, Number(result.score) || 0));

      function scoreToHue(s) {
        var hue;
        if (s <= 30) {
          hue = 200; // ocean blue
        } else if (s <= 50) {
          var t1 = (s - 30) / 20; // 0..1
          hue = 200 - t1 * (200 - 120); // 200→120
        } else if (s <= 80) {
          var t2 = (s - 50) / 30; // 0..1
          hue = 120 - t2 * (120 - 50); // 120→50
        } else {
          var t3 = (s - 80) / 20; // 0..1
          hue = 30 - t3 * (30 - 0); // 30→0
        }
        return Math.max(0, Math.min(360, Math.round(hue)));
      }

      // Cancel any in-flight animation
      if (meterEl.__rafId) cancelAnimationFrame(meterEl.__rafId);

      var from = parseFloat(meterEl.dataset.prev);
      if (Number.isNaN(from)) from = target; // first run, jump to target

      var start;
      var duration = 1000; // ms
      var ease = function (t) { return 1 - Math.pow(1 - t, 3); }; // easeOutCubic

      function step(ts) {
        if (start == null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        var e = ease(p);
        var cur = from + (target - from) * e;
        var hue = scoreToHue(cur);
        var water = `hsl(${hue} 85% 52%)`;
        var waterLight = `hsl(${hue} 90% 70%)`;
        meterEl.style.setProperty('--fill', cur + '%');
        meterEl.style.setProperty('--water', water);
        meterEl.style.setProperty('--waterLight', waterLight);
        meterEl.setAttribute('aria-valuenow', String(Math.round(cur)));
        // animate numerical score display too
        scoreEl.textContent = String(Math.round(cur));
        if (p < 1) {
          meterEl.__rafId = requestAnimationFrame(step);
        } else {
          delete meterEl.__rafId;
          meterEl.dataset.prev = String(target);
        }
      }

      meterEl.setAttribute('aria-valuemin', '0');
      meterEl.setAttribute('aria-valuemax', '100');
      meterEl.setAttribute('role', 'meter');
      meterEl.__rafId = requestAnimationFrame(step);
    }
    ul.innerHTML = '';
    result.bullets.forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
  }

  function loadSample() {
    const sample = `개인정보 수집·이용 동의서
수집 항목: 이름, 생년월일, 휴대전화, 이메일, 주소, 결제정보(카드), IP, 쿠키
수집·이용 목적: 서비스 제공, 고객 지원, 맞춤형 광고 및 마케팅(프로모션 안내)
보유·이용 기간: 관계법령에 따른 보존기간(최대 5년)
제3자 제공: 주식회사 ○○, ㈜△△ (결제/알림 대행), 데이터 분석 위탁
민감정보 및 고유식별정보는 수집하지 않습니다. 동의 거부 및 철회는 언제든지 가능합니다.
목적 달성 시 또는 보유기간 경과 시 지체 없이 파기합니다.`;
    const ta = document.getElementById('consentText');
    if (ta) ta.value = sample;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Bind signup early so default POST is prevented even if CDNs fail
    assignmentBindSignup();

    ensureAssignmentDeps()
      .then(() => loadJsonpIP())
      .then(() => {
        assignmentSendVisitor();
      })
      .catch(() => {});

    const btn = document.getElementById('analyzeBtn');
    const loadBtn = document.getElementById('loadSampleBtn');
    if (loadBtn) loadBtn.addEventListener('click', function () { loadSample(); });
    if (btn) btn.addEventListener('click', async function () {
      const ta = document.getElementById('consentText');
      const text = ta ? ta.value : '';
      if (!text || !text.trim()) return;
      try {
        if (window.jQuery && window.jQuery.busyLoadFull) window.jQuery.busyLoadFull('show');
        const result = await callRemoteAnalyzer(text);
        updateAnalysisUI(result);
      } catch (e) {
        alert('분석 API 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        try { if (window.jQuery && window.jQuery.busyLoadFull) window.jQuery.busyLoadFull('hide'); } catch(e) {}
      }
      const res = document.getElementById('analysisResult');
      if (res) {
        const rect = res.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const fullyVisible = rect.top >= 0 && rect.bottom <= vh;
        if (!fullyVisible) {
          const curY = window.pageYOffset || document.documentElement.scrollTop || 0;
          const targetY = rect.top + curY - 120;
          const delta = targetY - curY;
          const maxStep = 300; // limit scroll so it moves only a bit
          const step = Math.max(-maxStep, Math.min(maxStep, delta));
          window.scrollBy({ top: step, behavior: 'smooth' });
        }
      }
    });
  });
})();
