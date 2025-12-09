// Lightweight analyzer logic for analysis-result page (kept separate from ward.js)
(function () {
  const ANALYZE_ENDPOINT = 'https://swai-backend.onrender.com/api/check';

  function sanitizeEndpoint(ep) {
    if (!ep) return null;
    var low = String(ep).toLowerCase();
    if (low.indexOf('analysis-result') !== -1 || low.indexOf('.html') !== -1 || low.indexOf('?text=') !== -1) {
      console.warn('[analysis-result] ignoring invalid endpoint override', ep);
      return null;
    }
    return ep;
  }

  function resolveAnalyzerEndpoint(override) {
    const fromOverride = sanitizeEndpoint(override);
    const fromWindow = sanitizeEndpoint(typeof window !== 'undefined' ? window.__wardAnalysisEndpointOverride : undefined);
    return fromOverride || fromWindow || ANALYZE_ENDPOINT;
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

    if (meterEl) {
      var target = Math.max(0, Math.min(100, Number(result.score) || 0));

      function scoreToHue(s) {
        var hue;
        if (s <= 30) {
          hue = 200;
        } else if (s <= 50) {
          var t1 = (s - 30) / 20;
          hue = 200 - t1 * (200 - 120);
        } else if (s <= 80) {
          var t2 = (s - 50) / 30;
          hue = 120 - t2 * (120 - 50);
        } else {
          var t3 = (s - 80) / 20;
          hue = 30 - t3 * (30 - 0);
        }
        return Math.max(0, Math.min(360, Math.round(hue)));
      }

      if (meterEl.__rafId) cancelAnimationFrame(meterEl.__rafId);

      var from = parseFloat(meterEl.dataset.prev);
      if (Number.isNaN(from)) from = target;

      var start;
      var duration = 1000;
      var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

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

  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('analyzeBtn');
    if (btn) {
      btn.addEventListener('click', async function () {
        const ta = document.getElementById('consentText');
        const text = ta ? ta.value : '';
        if (!text || !text.trim()) return;
        try {
          const result = await callRemoteAnalyzer(text);
          updateAnalysisUI(result);
        } catch (e) {
          alert('분석 API 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
      });
    }
  });
})();
