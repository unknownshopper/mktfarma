// Initialize charts, tooltips, print, auto scenario, and toggle-all on pages
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function initBars() {
    const bars = $$('.bar[data-width]');
    if (!bars.length) return;
    requestAnimationFrame(() => {
      bars.forEach((bar) => {
        const target = parseFloat(bar.getAttribute('data-width')) || 0;
        const fill = bar.querySelector('.fill');
        if (fill) fill.style.width = Math.max(0, Math.min(100, target)) + '%';
      });
    });
  }

  function initTooltips() {
    const items = $$('.has-tip');
    if (!items.length) return;
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    document.body.appendChild(tip);

    function show(e, text) {
      tip.textContent = text;
      tip.classList.add('show');
      position(e);
    }
    function hide() { tip.classList.remove('show'); }
    function position(e) {
      const pad = 8;
      const x = e.clientX + pad;
      const y = e.clientY + pad;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }

    items.forEach((el) => {
      const text = el.getAttribute('data-tip') || '';
      el.addEventListener('mouseenter', (e) => show(e, text));
      el.addEventListener('mousemove', position);
      el.addEventListener('mouseleave', hide);
      el.addEventListener('touchstart', (e) => show(e.touches[0], text), { passive: true });
      el.addEventListener('touchmove', (e) => position(e.touches[0]), { passive: true });
      el.addEventListener('touchend', hide);
    });
  }

  function initPrint() {
    const btn = $('#printBtn');
    if (!btn) return;
    btn.addEventListener('click', () => window.print());
  }

  function calcTicket(price) {
    const low = Math.round(price + 35);
    const high = Math.round(price + 55);
    return { low, high };
  }

  function updateKPIs(price, attachPct) {
    const metricPSMValue = $('#metricPSMValue');
    const metricAttach = $('#metricAttach');
    const metricTicket = $('#metricTicket');
    if (metricPSMValue) metricPSMValue.textContent = `$${price} MXN`;
    if (metricAttach) metricAttach.textContent = `${attachPct}%`;
    const t = calcTicket(price);
    if (metricTicket) metricTicket.textContent = `$${t.low}–$${t.high}`;
  }

  function updateStacked(price, attachPct) {
    const avgOTC = 45;
    const attach = Math.max(0, Math.min(100, attachPct)) / 100;
    const consult = price;
    const otc = attach * avgOTC;
    const total = consult + otc;
    let consultShare = total > 0 ? (consult / total) * 100 : 100;
    consultShare = Math.max(0, Math.min(100, consultShare));
    const otcShare = 100 - consultShare;

    const stacked = $('#stackedMix');
    const legendC = $('#legendConsult');
    const legendO = $('#legendOTC');
    if (stacked) stacked.style.gridTemplateColumns = `${consultShare.toFixed(0)}% ${otcShare.toFixed(0)}%`;
    if (legendC) legendC.innerHTML = `<i class="legend-dot" style="background: rgba(99,102,241,0.65)"></i>Consulta ~${consultShare.toFixed(0)}%`;
    if (legendO) legendO.innerHTML = `<i class="legend-dot" style="background: rgba(20,184,166,0.55)"></i>OTC ~${otcShare.toFixed(0)}%`;
  }

  function initAutoScenario() {
    const root = document.getElementById('reportRoot');
    if (!root) return;
    const price = Math.max(50, Math.min(120, Number(root.dataset.price) || 78));
    const attach = Math.max(0, Math.min(100, Number(root.dataset.attach) || 57));
    updateKPIs(price, attach);
    updateStacked(price, attach);
  }

  // --- Surveys: storage, aggregation, rendering ---
  const SURVEY_KEY = 'mktfarma_surveys_v1';

  function loadSurveys() {
    try { return JSON.parse(localStorage.getItem(SURVEY_KEY) || '[]'); }
    catch { return []; }
  }
  function saveSurvey(resp) {
    const list = loadSurveys();
    list.push({ ...resp, ts: Date.now() });
    localStorage.setItem(SURVEY_KEY, JSON.stringify(list));
  }
  function mapAttach(freq) {
    switch ((freq || '').toLowerCase()) {
      case 'sí, casi siempre': return 80;
      case 'si, casi siempre': return 80;
      case 'a veces': return 50;
      case 'rara vez': return 20;
      case 'nunca': return 0;
      default: return null;
    }
  }
  function aggregateSurveys() {
    const data = loadSurveys();
    const n = data.length;
    if (!n) return { n: 0 };
    let psmSum = 0, psmCnt = 0;
    let attachSum = 0, attachCnt = 0;
    let otcSum = 0, otcCnt = 0;

    data.forEach(r => {
      const barato = Number(r.psm_barato);
      const caro = Number(r.psm_caro);
      if (isFinite(barato) && isFinite(caro) && barato > 0 && caro > 0) {
        psmSum += (barato + caro) / 2;
        psmCnt++;
      }
      const a = mapAttach(r.otc_frecuencia);
      if (a !== null) { attachSum += a; attachCnt++; }
      const g = Number(r.otc_gasto);
      if (isFinite(g) && g >= 0) { otcSum += g; otcCnt++; }
    });

    const psmAvg = psmCnt ? (psmSum / psmCnt) : null;
    const attachAvg = attachCnt ? (attachSum / attachCnt) : null;
    const otcAvg = otcCnt ? (otcSum / otcCnt) : null;
    return { n, psmAvg, attachAvg, otcAvg };
  }

  function renderProposalSummary() {
    const box = document.getElementById('proposalSurveySummary');
    if (!box) return;
    const ag = aggregateSurveys();
    document.getElementById('sumN').textContent = ag.n || 0;
    document.getElementById('sumPSM').textContent = ag.psmAvg ? `$${Math.round(ag.psmAvg)} MXN` : '—';
    document.getElementById('sumAttach').textContent = ag.attachAvg != null ? `${Math.round(ag.attachAvg)}%` : '—';
    document.getElementById('sumOTC').textContent = ag.otcAvg != null ? `$${Math.round(ag.otcAvg)} MXN` : '—';
  }

  function renderReportSummaryAndApply() {
    const box = document.getElementById('reportSurveySummary');
    const root = document.getElementById('reportRoot');
    const ag = aggregateSurveys();
    if (box) {
      const nEl = document.getElementById('rSumN');
      const psmEl = document.getElementById('rSumPSM');
      const attEl = document.getElementById('rSumAttach');
      const otcEl = document.getElementById('rSumOTC');
      nEl.textContent = ag.n || 0;
      psmEl.textContent = ag.psmAvg ? `$${Math.round(ag.psmAvg)} MXN` : '—';
      attEl.textContent = ag.attachAvg != null ? `${Math.round(ag.attachAvg)}%` : '—';
      otcEl.textContent = ag.otcAvg != null ? `$${Math.round(ag.otcAvg)} MXN` : '—';
    }
    // If we have aggregates, override KPIs on report
    if (root && ag && (ag.psmAvg != null || ag.attachAvg != null)) {
      const price = Math.max(50, Math.min(120, Math.round(ag.psmAvg || Number(root.dataset.price) || 78)));
      const attach = Math.max(0, Math.min(100, Math.round(ag.attachAvg || Number(root.dataset.attach) || 57)));
      updateKPIs(price, attach);
      updateStacked(price, attach);
    }
  }

  function attachSurveySave() {
    const btn = document.getElementById('saveSurveyBtn');
    const form = document.getElementById('surveyForm');
    if (!btn || !form) return;
    btn.addEventListener('click', () => {
      // Basic validity check
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const obj = {};
      fd.forEach((v, k) => { obj[k] = v; });
      saveSurvey(obj);
      // feedback
      btn.textContent = 'Guardado ✓';
      setTimeout(() => { btn.textContent = 'Guardar respuesta'; }, 1500);
      // refresh summaries if present
      renderProposalSummary();
      renderReportSummaryAndApply();
    });
  }

  // Live badges for driver sliders (section 4)
  function initDriverBadges() {
    const form = document.getElementById('surveyForm');
    if (!form) return;
    const ranges = Array.from(form.querySelectorAll('input[type="range"][name^="drv_"]'));
    ranges.forEach(rg => {
      const name = rg.getAttribute('name');
      // Prefer the badge within the same container (e.g., <li>) to avoid mismatches
      const container = rg.closest('li') || rg.parentElement || form;
      const badge = container.querySelector(`.range-badge[data-for="${name}"]`) || container.querySelector('.range-badge');
      if (!badge) return;
      const set = () => { badge.textContent = rg.value; };
      set();
      rg.addEventListener('input', set);
      rg.addEventListener('change', set);
    });
  }

  function initToggleAll(btnId, containerSel) {
    const btn = document.getElementById(btnId);
    const container = document.querySelector(containerSel);
    if (!btn || !container) return;
    const details = Array.from(container.querySelectorAll('details'));

    function setAll(open) {
      details.forEach((d) => d.open = open);
      btn.textContent = open ? 'Colapsar todo' : 'Expandir todo';
    }

    // Initialize label depending on first item state
    const anyClosed = details.some(d => !d.open);
    btn.textContent = anyClosed ? 'Expandir todo' : 'Colapsar todo';

    btn.addEventListener('click', () => {
      const shouldOpen = details.some(d => !d.open);
      setAll(shouldOpen);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initBars();
    initTooltips();
    initAutoScenario();
    initPrint();
    // Surveys
    attachSurveySave();
    renderProposalSummary();
    renderReportSummaryAndApply();
    initDriverBadges();
    // Toggle-all bindings per page
    initToggleAll('reportToggleAll', '.accordion');
    initToggleAll('questionToggleAll', '.accordion');
    initToggleAll('indexToggleAll', '#propuesta .accordion');
  });
})();