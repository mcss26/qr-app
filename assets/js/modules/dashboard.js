/**
 * Dashboard Module — QR Gate App
 * Live counters + clear database functionality (Cuenta Ganado Mode).
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
  const statScanned = document.getElementById('statScanned');

  // 3. Load Stats from global_counter
  async function loadStats() {
    try {
      const { data, error } = await sb
        .from('global_counter')
        .select('count')
        .eq('id', 1)
        .single();

      if (error) {
        console.error('[Dashboard] Error de Supabase al cargar stats:', error);
      }

      if (data) {
        statScanned.textContent = data.count !== null ? data.count : 0;
      }
    } catch (err) {
      console.error('[Dashboard] Exception al cargar stats:', err);
    }
  }

  // Initial load
  await loadStats();

  // Suscribirse a cambios en tiempo real para el Dashboard
  sb.channel('realtime_dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'global_counter' }, payload => {
      if (payload.new && payload.new.count !== undefined) {
        statScanned.textContent = payload.new.count;
      }
    })
    .subscribe();

  // 4. Clear Database (Reset Counter)
  const btnClear = document.getElementById('btnClear');
  const modal = document.getElementById('confirmModal');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  if(btnClear) {
    btnClear.addEventListener('click', () => {
      modal.classList.add('active');
    });
  }

  if(modalCancel) {
    modalCancel.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if(modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  if(modalConfirm) {
    modalConfirm.addEventListener('click', async () => {
      modalConfirm.disabled = true;
      modalConfirm.textContent = 'Reiniciando...';

      try {
        // Reiniciar contador a 0
        const { error } = await sb.from('global_counter').update({ count: 0 }).eq('id', 1);
        if (error) throw error;

        window.Toast.success('Contador reiniciado a 0.');
        modal.classList.remove('active');
        await loadStats();
      } catch (err) {
        console.error('[Dashboard] Clear error:', err);
        window.Toast.error('Error al reiniciar: ' + err.message);
      } finally {
        modalConfirm.disabled = false;
        modalConfirm.textContent = 'Sí, Limpiar Todo';
      }
    });
  }
})();
