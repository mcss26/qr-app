/**
 * @fileoverview Supabase Client Initialization.
 * Identical pattern to CMS Members App.
 */
(function () {
  if (window.sb) return;

  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error("[supabase-client] Falta APP_CONFIG (SUPABASE_URL / SUPABASE_ANON_KEY).");
    return;
  }

  const lib = window.supabase;
  if (!lib || typeof lib.createClient !== "function") {
    console.error("[supabase-client] CRITICAL: window.supabase not found.");
    return;
  }

  window.sb = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
