/* Front-end logic: visit tracking, signup, analyzer */
(function () {
  // Apps Script endpoint URL
  const ADDR_SCRIPT = 'https://script.google.com/macros/s/AKfycbxknEwAXqcw6kr-EgsGmui7ngK_RreZy495wUFHVqXw7CYuTAomQt_NrAhkbF367I6Z/exec';
  const ANALYZE_ENDPOINT = 'https://swai-backend.onrender.com/api/check';

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

  // JSONP IP
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

  // Cookie helpers
  function getCookieValue(name) {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

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
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    const existing = getCookieValue('user');
    if (!existing) {
      setCookieValue('user', hash, 180); // ~6 months
      return hash;
    }
    return existing;
  }

  function getMobileFlag() {
    var mobile = 'desktop';
				if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
					// true for mobile device
					mobile = 'mobile';
				}
  }

  function getUTMSimple() {
    try {
      var queryString = location.search;
      const urlParams = new URLSearchParams(queryString);
      return urlParams.get("utm")
    } catch (e) { return ""; }
  }
  
  async function callRemoteAnalyzer(text) {
    if (!ANALYZE_ENDPOINT) throw new Error('Analyzer endpoint missing');
    const res = await fetch(ANALYZE_ENDPOINT, {
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
    let label = l;
    if (!label) {
      if (score < 30) label = '낮음';
      else if (score < 60) label = '보통';
      else if (score < 80) label = '높음';
      else label = '매우 높음';
    }
    const bullets = Array.isArray(b) ? b : [];
    return { score, label, bullets };
  }

  function assignmentSendVisitor() {
    if (!ADDR_SCRIPT || !window.axios) return;
    const payload = JSON.stringify({
      id: getUVfromCookie(),
      landingUrl: window.location.href,
      ip: jsonpIP,
      referer: document.referrer || '',
      time_stamp: getTimeStamp(),
      utm: getUTMSimple(),
      device: getMobileFlag()
    });
    window.axios.get(ADDR_SCRIPT + '?action=insert&table=visitors&data=' + encodeURIComponent(payload))
      .catch(() => {});
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
    if (!ADDR_SCRIPT || !window.axios || !window.jQuery) return;
    ensurePopupContainer();
    const $ = window.jQuery;
    // Map to existing form/inputs in this template
    const $form = $('form.contact-form');
    if ($form.length === 0) return;
    $form.on('submit', function (e) {
      e.preventDefault();
      const email = $('#email').val() || '';
      const advice = $('#message').val() || '';
      const re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
      if (!email || !re.test(email)) {
        alert('이메일이 유효하지 않아 알림을 드릴 수가 없습니다. ');
        return false;
      }
      const payload = JSON.stringify({ id: getUVfromCookie(), email: email, advice: advice });
      if ($.busyLoadFull) $.busyLoadFull('show');
      window.axios.get(ADDR_SCRIPT + '?action=insert&table=tab_master&data=' + encodeURIComponent(payload))
        .then(() => {
          $('#email').val('');
          $('#message').val('');
          if ($.busyLoadFull) $.busyLoadFull('hide');
          if ($.fn && $.fn.simplePopup) $.fn.simplePopup({ type: 'html', htmlSelector: '#popup' });
        })
        .catch(() => {
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
    if (!resultCard || !scoreEl || !labelEl || !ul) return;

    resultCard.classList.remove('d-none');
    scoreEl.textContent = `${result.score}`;
    labelEl.textContent = `위험도: ${result.label}`;
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
    ensureAssignmentDeps()
      .then(() => loadJsonpIP())
      .then(() => {
        assignmentSendVisitor();
        assignmentBindSignup();
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
        const top = res.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
})();
