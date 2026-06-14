/**
 * @fileoverview Auth Module — QR Gate App
 * Simplified: PIN based authentication (localStorage).
 */
window.Auth = {
  appBasePath() {
    const p = window.location.pathname || "/";
    const i = p.indexOf("/pages/");
    if (i !== -1) return p.slice(0, i + 1);
    return p.replace(/\/[^\/]*$/, "/");
  },

  toAppPath(relPath) {
    let clean = String(relPath || "").replace(/^\/+/, "");
    const isLocal =
      ["localhost", "127.0.0.1", "", "0.0.0.0"].includes(window.location.hostname) ||
      window.location.protocol === "file:";

    if (isLocal) {
      if (!clean.match(/\.[a-z0-9]+$/i) && !clean.includes("?") && !clean.includes("#")) {
        clean += ".html";
      }
    }
    return this.appBasePath() + clean;
  },

  roleLanding(role) {
    const r = String(role || "").toLowerCase().trim();
    if (r === "admin") return this.toAppPath("pages/dashboard");
    if (r === "operativo") return this.toAppPath("pages/scanner");
    return this.toAppPath("index");
  },

  // Obtiene la sesión actual desde localStorage
  getSession() {
    const sessionStr = localStorage.getItem('qr_gate_session');
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      return session;
    } catch(e) {
      return null;
    }
  },

  // Guarda la sesión
  setSession(role) {
    localStorage.setItem('qr_gate_session', JSON.stringify({
      role: role,
      user: { id: 'local-' + role } // Objeto mockeado por si algún script anterior espera user.id
    }));
  },

  async guardOrRedirect(allowedRoles = []) {
    document.body.style.visibility = 'hidden';
    const safetyTimer = setTimeout(() => {
      document.body.style.visibility = 'visible';
    }, 1000);

    try {
      const allowed = (allowedRoles || []).map(r => String(r).toLowerCase().trim()).filter(Boolean);
      const session = this.getSession();

      if (!session || !session.role) {
        clearTimeout(safetyTimer);
        window.location.href = this.toAppPath("index");
        return null;
      }

      const role = session.role.toLowerCase();
      if (allowed.length > 0 && !allowed.includes(role)) {
        clearTimeout(safetyTimer);
        window.location.href = this.toAppPath("index");
        return null;
      }

      clearTimeout(safetyTimer);
      document.body.style.visibility = 'visible';
      return session;
    } catch (err) {
      clearTimeout(safetyTimer);
      document.body.style.visibility = 'visible';
      console.error('[Auth] guardOrRedirect failed:', err);
      window.location.href = this.toAppPath("index");
      return null;
    }
  },

  logout() {
    localStorage.removeItem('qr_gate_session');
    window.location.href = this.toAppPath("index");
  }
};
