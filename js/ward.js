/* Front-end logic: visit tracking, signup, analyzer */
(function () {
  // Apps Script endpoint URL
  const ADDR_SCRIPT = 'https://script.google.com/macros/s/AKfycbxknEwAXqcw6kr-EgsGmui7ngK_RreZy495wUFHVqXw7CYuTAomQt_NrAhkbF367I6Z/exec';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function nowTimestamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
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
    return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ? 'mobile' : 'desktop';
  }

  function getUTMSimple() {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('utm');
    } catch (e) { return null; }
  }

  function assignmentSendVisitor() {
    if (!ADDR_SCRIPT || !window.axios) return;
    const payload = JSON.stringify({
      id: getUVfromCookie(),
      landingUrl: window.location.href,
      ip: jsonpIP,
      referer: document.referrer || '',
      time_stamp: nowTimestamp(),
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
      window.axios.get(ADDR_SCRIPT + '?action=insert&table=tab_final&data=' + encodeURIComponent(payload))
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

  function analyzeConsent(text) {
    if (!text || !text.trim()) return { score: 0, label: '분석할 내용이 없습니다', bullets: [] };
    const t = text; // Korean content; case-folding not necessary

    function count(keyword) {
      const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const m = t.match(re);
      return m ? m.length : 0;
    }

    function anyOf(arr) { return arr.some(k => t.indexOf(k) !== -1); }

    let score = 0;

    // Third-party sharing / outsourcing
    const thirdKW = ['제3자', '제3 자', '제3', '수탁자', '위탁', '제공', '제공받는자', '제공받는 자'];
    let thirdHits = 0; thirdKW.forEach(k => thirdHits += count(k));
    const corpHits = count('주식회사') + count('㈜') + count('유한회사');
    const approxThird = Math.max(0, corpHits);
    const thirdScore = Math.min(30, thirdHits * 5);
    score += thirdScore;

    // Sensitive data
    const sensitiveKW = ['민감정보', '고유식별정보', '주민등록번호', '여권번호', '운전면허번호', '건강정보', '바이오정보', '지문', '얼굴인식'];
    const hasSensitive = anyOf(sensitiveKW);
    if (hasSensitive) score += 25;

    // Marketing / advertising
    const mktKW = ['마케팅', '광고', '홍보', '프로모션', '광고성 정보', '맞춤형', '광고성'];
    const hasMarketing = anyOf(mktKW);
    if (hasMarketing) score += 15;

    // Data categories breadth
    const cats = ['이름','성명','생년월일','주소','전화','휴대전화','이메일','계좌','카드','위치','쿠키','결제','기기','IP','식별자','로그'];
    let uniqueCats = 0; cats.forEach(c => { if (t.indexOf(c) !== -1) uniqueCats += 1; });
    const catScore = Math.min(20, uniqueCats * 2);
    score += catScore;

    // Retention period
    let retentionNote = '명시되지 않음/일반';
    const indefiniteKW = ['영구', '무기한', '별도 보유기간', '탈퇴 후에도'];
    const hasPurposeDone = (t.indexOf('목적 달성 시') !== -1) || (t.indexOf('목적달성 시') !== -1);
    if (indefiniteKW.some(k => t.indexOf(k) !== -1)) {
      score += 20; retentionNote = '무기한/불명확';
    } else {
      const m = t.match(/([0-9]{1,2})\s*년/g);
      if (m && m.length) {
        const years = m.map(s => parseInt(s.replace(/[^0-9]/g,''),10)).filter(Boolean);
        const maxY = years.length ? Math.max.apply(null, years) : 0;
        if (maxY >= 3) { score += 10; retentionNote = `${maxY}년 이상`; }
        else if (maxY >= 1) { score += 5; retentionNote = `${maxY}년 내`; }
      }
      if (hasPurposeDone) { retentionNote = '목적 달성 시'; }
    }

    // Mitigations
    const hasOptOut = anyOf(['동의 거부', '철회', '옵트아웃', '수신 거부']);
    const hasAnon = anyOf(['익명', '가명처리', '가명화']);
    if (hasOptOut) score -= 10;
    if (hasAnon) score -= 5;

    score = Math.max(0, Math.min(100, score));

    let label = '보통';
    if (score < 30) label = '낮음';
    else if (score < 60) label = '보통';
    else if (score < 80) label = '높음';
    else label = '매우 높음';

    const bullets = [];
    bullets.push(`제3자 제공/위탁 징후: ${thirdHits > 0 ? '있음' : '없음'}${approxThird ? ` (사업자 언급 ~${approxThird}회)` : ''}`);
    bullets.push(`민감정보 포함: ${hasSensitive ? '예' : '아니오'}`);
    bullets.push(`마케팅/광고 활용: ${hasMarketing ? '예' : '아니오'}`);
    bullets.push(`수집 항목 다양성: ${uniqueCats}개 항목 감지`);
    bullets.push(`보유기간: ${retentionNote}`);
    if (hasOptOut || hasAnon) bullets.push(`감경 요인: ${[hasOptOut ? '동의 거부/철회 안내' : null, hasAnon ? '익명/가명 처리' : null].filter(Boolean).join(', ')}`);

    return { score, label, bullets };
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
    if (btn) btn.addEventListener('click', function () {
      const ta = document.getElementById('consentText');
      const text = ta ? ta.value : '';
      const result = analyzeConsent(text);
      updateAnalysisUI(result);
      const res = document.getElementById('analysisResult');
      if (res) {
        const top = res.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
})();
