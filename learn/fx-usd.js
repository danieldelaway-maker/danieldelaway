// Adds a US dollar conversion after any foreign-currency amount shown on an HQ page.
// e.g. "¥38 per bottle" -> "¥38 (≈ US$5.35) per bottle". Live rates (open.er-api.com, cached 12h),
// built-in fallback rates if offline. Amounts already followed by a US$/USD figure are left alone.
(function () {
  var FALLBACK = { CNY: 7.1, EUR: 0.92, GBP: 0.79, AUD: 1.53, CAD: 1.39, NZD: 1.68, MXN: 18.5, JPY: 150, HKD: 7.8, SGD: 1.33, INR: 84, KRW: 1380, THB: 34, IDR: 15800, VND: 25000 };
  var rates = FALLBACK;
  try { var c = JSON.parse(localStorage.getItem('fxUsd') || 'null'); if (c && Date.now() - c.at < 432e5) rates = c.r; } catch (e) {}

  // Symbol or code -> currency. ¥ is treated as Chinese yuan (all ¥ prices in HQ come from Chinese suppliers).
  var PRE = { '¥': 'CNY', '￥': 'CNY', 'RMB': 'CNY', 'CNY': 'CNY', '€': 'EUR', 'EUR': 'EUR', '£': 'GBP', 'GBP': 'GBP',
    'A$': 'AUD', 'AU$': 'AUD', 'AUD': 'AUD', 'C$': 'CAD', 'CA$': 'CAD', 'CAD': 'CAD', 'NZ$': 'NZD', 'NZD': 'NZD',
    'MX$': 'MXN', 'MXN': 'MXN', 'HK$': 'HKD', 'HKD': 'HKD', 'S$': 'SGD', 'SGD': 'SGD', '₹': 'INR', 'INR': 'INR',
    '₩': 'KRW', 'KRW': 'KRW', 'JPY': 'JPY', 'THB': 'THB', '฿': 'THB', 'IDR': 'IDR', 'VND': 'VND' };
  var POST = { 'RMB': 'CNY', 'CNY': 'CNY', 'YUAN': 'CNY', 'EUR': 'EUR', 'EUROS': 'EUR', 'GBP': 'GBP', 'AUD': 'AUD', 'CAD': 'CAD',
    'NZD': 'NZD', 'MXN': 'MXN', 'PESOS': 'MXN', 'HKD': 'HKD', 'SGD': 'SGD', 'INR': 'INR', 'JPY': 'JPY', 'YEN': 'JPY', 'THB': 'THB', 'IDR': 'IDR', 'VND': 'VND' };
  var NUM = '(\\d+(?:,\\d{3})*(?:\\.\\d+)?)(\\s?[kKmM](?![a-zA-Z]))?';
  var RE = new RegExp(
    '(?<![A-Za-z])(¥|￥|€|£|₹|₩|฿|AU\\$|A\\$|CA\\$|C\\$|NZ\\$|MX\\$|HK\\$|S\\$|\\b(?:RMB|CNY|EUR|GBP|AUD|CAD|NZD|MXN|HKD|SGD|INR|KRW|JPY|THB|IDR|VND)\\s?\\$?)\\s?' + NUM +
    '|' + NUM.replace('(\\d+', '(?<![\\w$¥€£.,])(\\d+') + '\\s?(RMB|CNY|yuan|EUR|euros|GBP|AUD|CAD|NZD|MXN|pesos|HKD|SGD|INR|JPY|yen|THB|IDR|VND)\\b', 'gi');

  function usd(n) {
    if (n >= 1000) return 'US$' + Math.round(n).toLocaleString('en-US');
    if (n >= 100) return 'US$' + Math.round(n);
    return 'US$' + n.toFixed(2);
  }
  function value(num, suf) {
    var v = parseFloat(num.replace(/,/g, ''));
    if (suf) { suf = suf.trim().toLowerCase(); v *= suf === 'k' ? 1e3 : 1e6; }
    return v;
  }
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|NOSCRIPT)$/;
  function convertText(s, tail) {
    RE.lastIndex = 0;
    var out = [], last = 0, m, hit = false;
    while ((m = RE.exec(s))) {
      var cur, v;
      if (m[1]) { cur = PRE[m[1].replace(/\s|\$$/g, '').toUpperCase()] || PRE[m[1].trim()]; v = value(m[2], m[3]); }
      else { cur = POST[m[6].toUpperCase()]; v = value(m[4], m[5]); }
      var end = m.index + m[0].length, after = (s + (tail || '')).slice(end, end + 24);
      if (!cur || !rates[cur] || !isFinite(v) || /US\$|USD/i.test(after)) continue;
      out.push(s.slice(last, end), { t: ' (≈ ' + usd(v / rates[cur]) + ')' });
      last = end; hit = true;
    }
    if (!hit) return null;
    out.push(s.slice(last));
    return out;
  }
  function walk(root) {
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
          if (p.nodeType === 1 && (SKIP.test(p.nodeName) || p.isContentEditable || p.classList.contains('fxusd'))) return NodeFilter.FILTER_REJECT;
        }
        return /\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var list = [], n;
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(function (node) {
      // If a conversion span already follows this text, count it as "already converted".
      var nx = node.nextSibling, tail = nx && nx.nodeType === 1 && nx.classList.contains('fxusd') ? nx.textContent : '';
      var parts = convertText(node.nodeValue, tail);
      if (!parts) return;
      var f = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (typeof p === 'string') { if (p) f.appendChild(document.createTextNode(p)); }
        else { var sp = document.createElement('span'); sp.className = 'fxusd'; sp.textContent = p.t; sp.title = 'Converted at today\'s rate'; f.appendChild(sp); }
      });
      node.parentNode.replaceChild(f, node);
    });
  }
  function refresh() {
    document.querySelectorAll('.fxusd').forEach(function (sp) { var p = sp.parentNode; p.removeChild(sp); p.normalize(); });
    walk(document.body);
  }
  var queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; obs.disconnect(); walk(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); }); }
  var obs = new MutationObserver(schedule);

  var st = document.createElement('style');
  st.textContent = '.fxusd{opacity:.72;font-weight:inherit;white-space:nowrap}';
  document.head.appendChild(st);

  function start() {
    walk(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (rates === FALLBACK || !rates.CNY) {
      fetch('https://open.er-api.com/v6/latest/USD').then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.rates || !d.rates.CNY) return;
        rates = d.rates;
        try { localStorage.setItem('fxUsd', JSON.stringify({ at: Date.now(), r: d.rates })); } catch (e) {}
        obs.disconnect(); refresh(); obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      }).catch(function () {});
    }
  }
  window.fxUsd = { convertText: convertText };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
