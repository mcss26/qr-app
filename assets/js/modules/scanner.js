/**
 * Scanner Module — QR Gate App
 * Camera-based QR scanning with Supabase validation.
 * No dependency on work_days. Haptic feedback only (no sound).
 */
(async function () {
  'use strict';

  // 1. Wait for dependencies
  const REQUIRED = ['sb', 'Auth', 'Toast', 'Html5Qrcode'];
  const MAX_WAIT = 10000;

  await new Promise((resolve, reject) => {
    if (REQUIRED.every(k => window[k])) return resolve();
    const start = Date.now();
    const iv = setInterval(() => {
      if (REQUIRED.every(k => window[k])) { clearInterval(iv); resolve(); }
      else if (Date.now() - start > MAX_WAIT) {
        clearInterval(iv);
        reject(new Error('Dependencias no cargaron: ' + REQUIRED.filter(k => !window[k]).join(', ')));
      }
    }, 80);
  });

  // 2. Auth Guard
  const session = await window.Auth.guardOrRedirect(['admin']);
  if (!session) return;

  const sb = window.sb;
  const user = session.user;

  // 3. Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const scanCount = document.getElementById('scanCount');
  const historyList = document.getElementById('historyList');
  const scanOverlay = document.getElementById('scanOverlay');
  const overlayIcon = document.getElementById('overlayIcon');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');

  // Manual input
  const manualCode = document.getElementById('manualCode');
  const manualForm = document.getElementById('manualForm');
  
  manualForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = manualCode.value.trim();
    if (val && !isProcessing) {
      validateCode(val);
      manualCode.value = '';
      manualCode.blur();
    }
  });

  // 4. State
  let isProcessing = false;
  let sessionCount = 0;

  // 5. Start Scanner
  const html5QrCode = new Html5Qrcode("reader");

  function startScanner() {
    // Config sin qrbox para que escanee todo el cuadro del video
    const config = { fps: 10 };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        if (!isProcessing) validateCode(decodedText);
      },
      () => { } // Ignore read errors (spammy)
    ).catch(err => {
      console.error("Scanner failed:", err);
      setStatus('error', '⛔', 'Cámara no disponible');
    });
  }

  startScanner();

  // 6. Validate Code
  async function validateCode(code) {
    if (!code || isProcessing) return;
    isProcessing = true;
    
    // UI Feedback immediate
    setStatus('idle', '⏳', 'Validando...');
    document.getElementById('reticle').style.borderColor = 'var(--warning)';

    try {
      // Query Supabase
      const { data: qrcode, error } = await sb
        .from('qr_codes')
        .select('id, code, status, accredited_at')
        .eq('code', code)
        .single();

      if (error || !qrcode) {
        handleResult(false, 'INVÁLIDO', 'No existe en el sistema', code);
        return;
      }

      if (qrcode.status === 'ANULADO') {
        handleResult(false, 'ANULADO', 'Código dado de baja', code);
        return;
      }

      if (qrcode.status === 'ACREDITADO') {
        const time = qrcode.accredited_at
          ? new Date(qrcode.accredited_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          : '??';
        handleResult(false, 'YA USADO', `Ingresó a las ${time}`, code);
        return;
      }

      // Status is PENDIENTE → Acreditar
      const { error: updateErr } = await sb
        .from('qr_codes')
        .update({
          status: 'ACREDITADO',
          accredited_at: new Date().toISOString(),
          accredited_by: user.id
        })
        .eq('id', qrcode.id);

      if (updateErr) throw updateErr;

      sessionCount++;
      scanCount.textContent = sessionCount;
      handleResult(true, 'ACCESO OK', '¡Código válido!', code);

    } catch (err) {
      console.error('[Scanner] Error:', err);
      handleResult(false, 'ERROR', 'Error de red. Reintenta.', code);
    } finally {
      // Cinematic timeout before allowing next scan
      setTimeout(() => { 
        isProcessing = false; 
        document.getElementById('reticle').className = 'scanner-reticle';
        document.getElementById('reticle').style.borderColor = '';
      }, 2500);
    }
  }

  // 7. Handle Result
  function handleResult(success, title, msg, code) {
    // Haptic feedback (vibration only, no sound)
    if ('vibrate' in navigator) {
      navigator.vibrate(success ? [100, 50, 100] : [200, 100, 200, 100, 200]);
    }

    // Reticle color flash
    const reticle = document.getElementById('reticle');
    reticle.className = `scanner-reticle ${success ? 'success' : 'error'}`;

    // Overlay
    showOverlay(success, title, msg);

    // Status badge
    setStatus(success ? 'success' : 'error',
      success ? '✓' : '✗',
      `${title}`);

    // History
    addHistoryItem(success, title, code);

    // Reset status badge after delay
    setTimeout(() => {
      if (!isProcessing) {
        setStatus('idle', '📷', 'Listo para escanear');
      }
    }, 2500);
  }

  // 8. Overlay
  function showOverlay(success, title, msg) {
    scanOverlay.className = `scan-overlay active ${success ? 'success' : 'error'}`;

    overlayIcon.innerHTML = success 
      ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;

    // Shake on error
    if (!success) {
      scanOverlay.classList.add('shake');
      setTimeout(() => scanOverlay.classList.remove('shake'), 500);
    }

    // Cinematic fade out
    setTimeout(() => scanOverlay.classList.remove('active'), 2000);
  }

  // 9. Status Badge
  function setStatus(type, icon, text) {
    statusBadge.className = `status-badge ${type}`;
    statusIcon.textContent = icon;
    statusText.textContent = text;
  }

  // 10. History UI
  function addHistoryItem(success, title, code) {
    const empty = document.getElementById('emptyHistory');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'history-item';
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Safely extract short code
    const shortCode = code.length > 12 ? `${code.slice(0, 8)}...${code.slice(-4)}` : code;

    item.innerHTML = `
      <div>
        <div class="history-code">${shortCode}</div>
        <div class="history-time" style="margin-top:2px;">${time}</div>
      </div>
      <span class="history-status ${success ? 'ok' : 'no'}">${title}</span>
    `;
    historyList.prepend(item);

    // Keep max 30 items in DOM
    while (historyList.children.length > 30) {
      historyList.removeChild(historyList.lastChild);
    }
  }

})();
