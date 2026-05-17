/**
 * Dashboard Module — QR Gate App
 * Live counters + clear database functionality.
 */
(async function () {
  'use strict';

  // 1. Auth Guard — admin only
  const session = await window.Auth.guardOrRedirect(['admin']);
  if (!session) return;

  const sb = window.sb;

  // Logout
  document.getElementById('btnLogout').addEventListener('click', () => window.Auth.logout());

  // 2. Elements
  const statTotal = document.getElementById('statTotal');
  const statScanned = document.getElementById('statScanned');
  const statPending = document.getElementById('statPending');

  // 3. Load Stats
  async function loadStats() {
    try {
      const { count: total } = await sb
        .from('qr_codes')
        .select('*', { count: 'exact', head: true });

      const { count: scanned } = await sb
        .from('qr_codes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACREDITADO');

      const t = total || 0;
      const s = scanned || 0;
      const p = t - s;

      statTotal.textContent = t;
      statScanned.textContent = s;
      statPending.textContent = p;
    } catch (err) {
      console.error('[Dashboard] Error loading stats:', err);
    }
  }

  // Initial load
  await loadStats();

  // Auto-refresh every 10 seconds
  setInterval(loadStats, 10000);

  // 4. Clear Database
  const btnClear = document.getElementById('btnClear');
  const modal = document.getElementById('confirmModal');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  btnClear.addEventListener('click', () => {
    modal.classList.add('active');
  });

  modalCancel.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  modalConfirm.addEventListener('click', async () => {
    modalConfirm.disabled = true;
    modalConfirm.textContent = 'Limpiando...';

    try {
      // Delete codes first (FK dependency), then batches
      const { error: e1 } = await sb.from('qr_codes').delete().not('id', 'is', null);
      if (e1) throw e1;

      const { error: e2 } = await sb.from('qr_batches').delete().not('id', 'is', null);
      if (e2) throw e2;

      window.Toast.success('Base limpiada. Lista para nueva fecha.');
      modal.classList.remove('active');
      await loadStats();
    } catch (err) {
      console.error('[Dashboard] Clear error:', err);
      window.Toast.error('Error al limpiar: ' + err.message);
    } finally {
      modalConfirm.disabled = false;
      modalConfirm.textContent = 'Sí, Limpiar Todo';
    }
  });
})();
