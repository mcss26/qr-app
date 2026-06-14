/**
 * Scanner Module — QR Gate App (Cuenta Ganado Mode)
 * Ultra-fast scanning, zero cooldown, universal payload.
 * Sincronizado en tiempo real mediante Supabase.
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
  const session = await window.Auth.guardOrRedirect(['admin', 'operativo']);
  if (!session) return;

  if (session.role === 'operativo') {
    const btnBack = document.getElementById('btnBackToDashboard');
    if (btnBack) btnBack.style.display = 'none';
  }

  const sb = window.sb;
  const user = session.user;

  // 3. Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const scanCount = document.getElementById('scanCount');
  const btnManualPlus = document.getElementById('btnManualPlus');
  const reticle = document.getElementById('reticle');
  const btnFlash = document.getElementById('btnFlash');
  let flashEnabled = false;

  // 4. State
  let sessionCount = 0;
  const QR_UNIVERSAL_PAYLOAD = 'QR-GATE-UNIVERSAL-PASS';
  let lastScanTime = 0;
  
  // 5. Inicializar el Contador desde Supabase
  async function initCounter() {
    try {
      const { data, error } = await sb
        .from('global_counter')
        .select('count')
        .eq('id', 1)
        .single();
        
      if (!error && data) {
        sessionCount = data.count;
        scanCount.textContent = sessionCount;
      }
      
      // Suscribirse a cambios en tiempo real
      sb.channel('realtime_counter')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'global_counter' }, payload => {
          if (payload.new && payload.new.count !== undefined) {
            sessionCount = payload.new.count;
            scanCount.textContent = sessionCount;
          }
        })
        .subscribe();
        
    } catch (err) {
      console.warn("No se pudo iniciar el contador global", err);
    }
  }

  initCounter();

  // 6. Start Scanner
  const html5QrCode = new Html5Qrcode("reader");

  function startScanner() {
    const config = { 
      fps: 15,
      formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        validateCode(decodedText);
      },
      () => { } // Ignorar errores de lectura
    ).then(() => {
      setStatus('idle', 'RDY', 'Escaneando al máximo');
      
      btnFlash.addEventListener('click', () => {
        flashEnabled = !flashEnabled;
        html5QrCode.applyVideoConstraints({
          advanced: [{ torch: flashEnabled }]
        }).then(() => {
          btnFlash.style.color = flashEnabled ? 'var(--warning)' : '';
        }).catch(err => {
          window.Toast.error('Linterna no soportada');
          flashEnabled = false;
          btnFlash.style.color = '';
        });
      });
    }).catch(err => {
      console.error("Scanner failed:", err);
      setStatus('error', '', 'Cámara no disponible');
    });
  }

  startScanner();

  // 7. Manual Button
  btnManualPlus.addEventListener('click', () => {
    incrementCount('Manual');
  });

  // 8. Validate Code
  function validateCode(code) {
    const now = Date.now();
    // Cooldown de 5 segundos para evitar lecturas repetidas muy rápido
    if (now - lastScanTime < 5000) return; 

    const cleanCode = (code || '').trim();
    console.log('[DEBUG] Escaneado:', cleanCode);

    if (cleanCode === QR_UNIVERSAL_PAYLOAD) {
      lastScanTime = now;
      incrementCount('QR');
    } else {
      lastScanTime = now;
      handleError(cleanCode);
    }
  }

  // 9. Increment Action
  async function incrementCount(source) {
    // Optimistic UI: Incrementamos localmente al instante
    sessionCount++;
    scanCount.textContent = sessionCount;
    
    // Feedback Ultra-Rápido
    if ('vibrate' in navigator) navigator.vibrate([50]); 
    
    reticle.style.borderColor = 'var(--success-base)';
    reticle.style.boxShadow = '0 0 20px var(--success-base)';
    scanCount.style.color = 'var(--success-base)';
    
    setTimeout(() => {
      reticle.style.borderColor = '';
      reticle.style.boxShadow = '';
      scanCount.style.color = '';
    }, 150);

    // Sincronizar con Supabase (Fire and Forget)
    try {
      await sb.rpc('increment_counter');
    } catch (err) {
      console.warn("Fallo incrementando en servidor", err);
    }
  }

  function handleError(scannedCode) {
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    reticle.style.borderColor = 'var(--error-base)';
    
    // Mostramos qué escaneó en realidad para debug rápido si es erróneo
    if (window.Toast && scannedCode) {
      window.Toast.error(`Lectura rechazada: "${scannedCode}"`);
    }

    setTimeout(() => reticle.style.borderColor = '', 200);
  }

  function setStatus(type, icon, text) {
    statusBadge.className = `status-badge ${type}`;
    statusIcon.textContent = icon;
    statusText.textContent = text;
  }

})();
