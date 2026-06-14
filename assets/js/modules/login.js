(async function () {
  'use strict';

  const ui = {
    form: document.getElementById('login-form'),
    error: document.getElementById('login-error'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
  };

  function translateError(msg) {
    if (!msg) return 'Error al iniciar sesión.';
    const text = msg.toString().toLowerCase();
    if (text.includes('invalid login credentials')) return 'Credenciales incorrectas.';
    if (text.includes('email not confirmed')) return 'Email no confirmado.';
    return msg;
  }

  function showError(msg) {
    if (ui.error) ui.error.textContent = translateError(msg);
  }

  // Auto-redirect if already logged in
  try {
    const session = await window.Auth.getSession();
    if (session) {
      const profile = await window.Auth.getMyProfile();
      if (profile && profile.role === 'admin') {
        window.location.href = window.Auth.roleLanding(profile.role);
        return;
      }
      if (!profile || profile.role !== 'admin') {
        await window.Auth.signOutAndGoLogin();
      }
    }
  } catch (err) {
    console.error('[login] Error checking session:', err);
  }

  // Form submit
  if (ui.form && ui.email && ui.password) {
    ui.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ui.error) ui.error.textContent = '';

      const email = ui.email.value.trim();
      const password = ui.password.value;

      if (!email || !password) {
        showError('Por favor, completa todos los campos.');
        return;
      }

      const submitBtn = ui.form.querySelector('button[type="submit"]');
      let originalText = 'Ingresar';
      if (submitBtn) {
        originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ingresando...';
      }

      try {
        const { error } = await window.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const profile = await window.Auth.getMyProfile();
        if (!profile || profile.role !== 'admin') {
          await window.sb.auth.signOut();
          throw new Error('Acceso denegado. Solo administradores.');
        }

        window.location.href = window.Auth.roleLanding(profile.role);
      } catch (err) {
        console.error('[login] Sign in error:', err);
        showError(err.message || 'Error desconocido.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }
})();
