// Touch ID / Face ID sign-in for the private /learn pages (Tasks HQ, its tools, Clients HQ). Added 17 Nov 2026.
// Uses passkeys checked by the brand-tasks-api worker (tasks/api/passkeys.js). After the check passes, the
// worker sends back the password and this fills it in and presses Open, so each page signs in as usual.
// The password still works as a backup. Pages just need: <script src="/learn/passkey.js" defer></script>
(function () {
  const API = 'https://brand-tasks-api.danieldelaway.workers.dev';
  const SITE = 'hq', PW_KEY = 'clientsHQ', DONE_KEY = 'pkSetUp';
  if (!window.PublicKeyCredential || !navigator.credentials) return;

  const apple = /iPhone|iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const NAME = apple ? 'Face ID' : /Mac/.test(navigator.platform) ? 'Touch ID' : 'passkey';
  const DEVICE = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) || apple ? 'iPad' : /Mac/.test(navigator.platform) ? 'Mac' : 'This device';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  const b64 = {
    enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0)).buffer,
  };
  async function call(path, body, key) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Key': key } : {}) }, body: JSON.stringify({ site: SITE, ...body }), cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong (' + r.status + ')');
    return d;
  }
  const fingerprint = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 11v3.5c0 2-.6 3.9-1.7 5.5"/><path d="M8.5 9.6A4 4 0 0 1 16 11v1.5c0 2.6-.5 4.6-1.3 6.3"/><path d="M5.3 16.5c.5-1.4.7-3 .7-4.5v-1a6 6 0 0 1 9.4-4.9"/><path d="M19.4 15.5c.4-1.4.6-2.8.6-4.5a8 8 0 0 0-15.4-3"/><path d="M8.6 20.6c.6-1 1-2.1 1.2-3.3"/></svg>';
  const face = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16a3.5 3.5 0 0 0 5 0"/></svg>';
  const ICON = NAME === 'Face ID' ? face : fingerprint;

  const css = document.createElement('style');
  css.textContent = `
    .pkbtn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 10px 18px; border-radius: 999px; border: 1px solid rgba(79,111,224,.25); background: linear-gradient(135deg, #bff3da, #9cc1f7); color: #12141c; font: 600 15px 'Inter', system-ui, sans-serif; cursor: pointer; box-shadow: 0 1px 2px rgba(18,20,28,.06), 0 6px 16px rgba(79,111,224,.18); transition: transform .15s, box-shadow .15s; }
    .pkbtn:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(18,20,28,.06), 0 10px 24px rgba(79,111,224,.25); }
    .pkbtn:disabled { opacity: .6; cursor: default; transform: none; }
    .pkbtn svg { width: 20px; height: 20px; }
    .pkbtn.busy svg { animation: pkpulse 1s ease-in-out infinite; }
    @keyframes pkpulse { 50% { transform: scale(1.18); opacity: .6; } }
    .pkwrap { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 14px; }
    .pkor { font-size: 12px; color: #6b7183; letter-spacing: .08em; text-transform: uppercase; }
    .pkmsg { font-size: 13px; color: #6b7183; min-height: 18px; text-align: center; }
    .pkmsg.bad { color: #c62f2f; }
    .pkmsg.good { color: #0f8f86; }
    .foot .pkset { display: inline-flex; align-items: center; gap: 7px; }
    .foot .pkset svg { width: 16px; height: 16px; }`;
  document.head.appendChild(css);

  // ---- Lock screen: "Sign in with Touch ID" ----
  async function signIn(btn, msg) {
    const form = document.getElementById('unlock'), pw = document.getElementById('pw');
    btn.disabled = true; btn.classList.add('busy'); msg.className = 'pkmsg'; msg.textContent = '';
    try {
      const start = await call('/passkey/login/start', {});
      if (start.none) throw new Error(`${NAME} isn’t set up yet. Sign in with the password once, then tap “Set up ${NAME}” at the bottom of the page.`);
      const o = start.options;
      const cred = await navigator.credentials.get({ publicKey: {
        challenge: b64.dec(o.challenge), rpId: o.rpId, timeout: o.timeout, userVerification: o.userVerification,
        allowCredentials: (o.allowCredentials || []).map(c => ({ type: 'public-key', id: b64.dec(c.id), transports: c.transports })),
      } });
      const r = cred.response;
      const done = await call('/passkey/login/finish', { ticket: start.ticket, response: {
        id: cred.id, rawId: b64.enc(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
        authenticatorAttachment: cred.authenticatorAttachment || undefined,
        response: { clientDataJSON: b64.enc(r.clientDataJSON), authenticatorData: b64.enc(r.authenticatorData), signature: b64.enc(r.signature), userHandle: r.userHandle ? b64.enc(r.userHandle) : undefined },
      } });
      ls.set(DONE_KEY, '1');
      pw.value = done.key;
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    } catch (e) {
      msg.className = 'pkmsg bad';
      msg.textContent = e.name === 'NotAllowedError' ? `${NAME} was cancelled.` : e.message;
    } finally { btn.disabled = false; btn.classList.remove('busy'); }
  }
  function addSignIn() {
    const form = document.getElementById('unlock');
    if (!form || document.querySelector('.pkwrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'pkwrap';
    wrap.innerHTML = `<span class="pkor">or</span><button type="button" class="pkbtn">${ICON}Sign in with ${NAME}</button><div class="pkmsg" role="status"></div>`;
    form.after(wrap);
    const btn = wrap.querySelector('button'), msg = wrap.querySelector('.pkmsg');
    btn.addEventListener('click', () => signIn(btn, msg));
  }

  // ---- Signed in: "Set up Touch ID" next to Sign out ----
  async function setUp(btn) {
    const key = ls.get(PW_KEY);
    const say = t => {
      let toast = document.getElementById('toast');
      if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.setAttribute('role', 'status'); toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#12141c;color:#fff;padding:10px 16px;border-radius:12px;font:14px Inter,system-ui,sans-serif;max-width:calc(100% - 32px);z-index:50'; document.body.appendChild(toast); }
      toast.textContent = t; toast.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => toast.hidden = true, 5000);
    };
    if (!key) return say('Sign in with the password first.');
    btn.disabled = true;
    try {
      const start = await call('/passkey/register/start', { device: DEVICE }, key);
      const o = start.options;
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: b64.dec(o.challenge), rp: o.rp, user: { ...o.user, id: b64.dec(o.user.id) }, pubKeyCredParams: o.pubKeyCredParams,
        timeout: o.timeout, attestation: o.attestation, authenticatorSelection: o.authenticatorSelection,
        excludeCredentials: (o.excludeCredentials || []).map(c => ({ type: 'public-key', id: b64.dec(c.id), transports: c.transports })),
      } });
      const r = cred.response;
      await call('/passkey/register/finish', { ticket: start.ticket, response: {
        id: cred.id, rawId: b64.enc(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
        authenticatorAttachment: cred.authenticatorAttachment || undefined,
        response: { clientDataJSON: b64.enc(r.clientDataJSON), attestationObject: b64.enc(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] },
      } }, key);
      ls.set(DONE_KEY, '1');
      btn.innerHTML = `${ICON}${NAME} is on`;
      say(`${NAME} is set up. Next time, tap “Sign in with ${NAME}” instead of typing the password.`);
    } catch (e) {
      btn.disabled = false;
      say(e.name === 'InvalidStateError' ? `${NAME} is already set up on this device.` : e.name === 'NotAllowedError' ? `${NAME} set-up was cancelled.` : e.message);
      if (e.name === 'InvalidStateError') { ls.set(DONE_KEY, '1'); btn.innerHTML = `${ICON}${NAME} is on`; }
    }
  }
  function addSetUp() {
    const out = document.getElementById('lockBtn');
    if (!out || document.querySelector('.pkset')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pkset';
    btn.innerHTML = ls.get(DONE_KEY) ? `${ICON}${NAME} is on` : `${ICON}Set up ${NAME}`;
    btn.title = ls.get(DONE_KEY) ? `Tap to add ${NAME} again (e.g. after resetting it)` : `Sign in with ${NAME} instead of the password`;
    // Keep it next to Sign out (the footer spreads its items apart).
    const pair = document.createElement('span');
    pair.style.cssText = 'display:inline-flex;flex-wrap:wrap;gap:10px';
    out.replaceWith(pair); pair.append(btn, out);
    btn.addEventListener('click', () => setUp(btn));
  }

  async function init() {
    try { if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) return; } catch {}
    addSignIn(); addSetUp();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
