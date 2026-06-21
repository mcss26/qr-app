/**
 * Manual Counter Module — QR Gate App (Cuenta Ganado Mode)
 * Conteo manual optimizado.
 * Sincronizado en tiempo real mediante Supabase.
 */
(async function () {
  'use strict';

  // 1. Wait for dependencies
  const REQUIRED = ['sb', 'Auth', 'Toast'];
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

  // 3. Elements
  const scanCount = document.getElementById('scanCount');
  const btnManualPlus = document.getElementById('btnManualPlus');
  // 4. State
  let sessionCount = 0;
  
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
      if (window.Toast) window.Toast.error("Error al sincronizar el contador");
    }
  }

  initCounter();


  // 7. Manual Button
  let isThrottled = false;
  
  btnManualPlus.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // Previene 'click' doble y zoom
    if (isThrottled) return;
    
    isThrottled = true;
    incrementCount('Manual');
    
    // Anti-doble tap rápido (debounce)
    setTimeout(() => {
      isThrottled = false;
    }, 150);
  });

  // Prevenir el menú contextual en long-press
  btnManualPlus.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });


  // 9. Increment Action
  async function incrementCount(source) {
    // Optimistic UI: Incrementamos localmente al instante
    sessionCount++;
    scanCount.textContent = sessionCount;
    
    // Feedback Ultra-Rápido
    if ('vibrate' in navigator) navigator.vibrate([50]); 
    scanCount.style.color = 'var(--success-base)';
    
    setTimeout(() => {
      scanCount.style.color = '';
    }, 150);

    // Sincronizar con Supabase (Fire and Forget)
    try {
      const { error } = await sb.rpc('increment_counter');
      if (error) throw error;
    } catch (err) {
      console.warn("Fallo incrementando en servidor", err);
      // Revert optimistic update
      sessionCount--;
      scanCount.textContent = sessionCount;
      if (window.Toast) window.Toast.error("Error de conexión. Intenta de nuevo.");
    }
  }


})();
