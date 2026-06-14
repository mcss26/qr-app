(async function () {
  'use strict';

  const ui = {
    form: document.getElementById('login-form'),
    error: document.getElementById('login-error'),
    pinCode: document.getElementById('pinCode'),
  };

  const PIN_ADMIN = '0000';
  const PIN_OPERATIVO = '1234';

  function showError(msg) {
    if (ui.error) ui.error.textContent = msg;
  }

  // Auto-redirect if already logged in (Persistencia)
  try {
    const session = window.Auth.getSession();
    if (session && session.role) {
      window.location.href = window.Auth.roleLanding(session.role);
      return;
    }
  } catch (err) {
    console.error('[login] Error checking session:', err);
  }

  // Form submit
  if (ui.form && ui.pinCode) {
    ui.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ui.error) ui.error.textContent = '';

      const pin = ui.pinCode.value.trim();

      if (!pin) {
        showError('Por favor, ingresa un PIN.');
        return;
      }

      const submitBtn = ui.form.querySelector('button[type="submit"]');
      let originalText = 'Ingresar';
      if (submitBtn) {
        originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validando...';
      }

      try {
        if (pin === PIN_ADMIN) {
          window.Auth.setSession('admin');
          window.location.href = window.Auth.roleLanding('admin');
        } else if (pin === PIN_OPERATIVO) {
          window.Auth.setSession('operativo');
          window.location.href = window.Auth.roleLanding('operativo');
        } else {
          throw new Error('PIN incorrecto. Acceso denegado.');
        }
      } catch (err) {
        showError(err.message || 'Error desconocido.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        ui.pinCode.value = ''; // limpiar pin en error
        ui.pinCode.focus();
      }
    });
  }
})();
