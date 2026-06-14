/**
 * @fileoverview Auth Module — QR Gate App
 * Simplified: only 'admin' role has access.
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
    return this.toAppPath("index");
  },

  checkSb() {
    if (!window.sb) {
      console.warn("[Auth] window.sb not initialized yet.");
      return false;
    }
    return true;
  },

  async getSession() {
    if (!this.checkSb()) return null;
    const { data, error } = await window.sb.auth.getSession();
    if (error) { console.error("Error getting session:", error); return null; }
    return data.session;
  },

  async getUser() {
    if (!this.checkSb()) return null;
    const { data, error } = await window.sb.auth.getUser();
    if (error) { console.error("Error getting user:", error); return null; }
    return data.user;
  },

  async getMyProfile() {
    const user = await this.getUser();
    if (!user) return null;
    const { data, error } = await window.sb
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();
    if (error) { console.error("Error fetching profile:", error); return null; }
    return data;
  },

  async guardOrRedirect(allowedRoles = []) {
    document.body.style.visibility = 'hidden';
    const safetyTimer = setTimeout(() => {
      document.body.style.visibility = 'visible';
    }, 5000);

    try {
      const allowed = (allowedRoles || []).map(r => String(r).toLowerCase().trim()).filter(Boolean);
      const session = await this.getSession();

      if (!session) {
        clearTimeout(safetyTimer);
        window.location.href = this.toAppPath("index");
        return null;
      }

      const profile = await this.getMyProfile();
      if (!profile) {
        clearTimeout(safetyTimer);
        window.location.href = this.toAppPath("index");
        return null;
      }

      const role = String(profile.role || "").toLowerCase().trim();
      if (allowed.length > 0 && !allowed.includes(role)) {
        clearTimeout(safetyTimer);
        window.location.href = this.toAppPath("index");
        return null;
      }

      clearTimeout(safetyTimer);
      document.body.style.visibility = 'visible';
      return { user: session.user, profile: { ...profile, role } };
    } catch (err) {
      clearTimeout(safetyTimer);
      document.body.style.visibility = 'visible';
      console.error('[Auth] guardOrRedirect failed:', err);
      return null;
    }
  },

  async signOutAndGoLogin() {
    await window.sb.auth.signOut();
    window.location.href = this.toAppPath("index");
  },

  logout() { return this.signOutAndGoLogin(); }
};
