// FUTURO — não está carregado pelo index.html ainda.
// Responsabilidade: criar e devolver UMA instância do cliente Supabase.

let agenflexSupabaseClient = null;

function getSupabaseClient() {
  if (agenflexSupabaseClient) return agenflexSupabaseClient;

  if (!window.supabase) {
    throw new Error('Biblioteca supabase-js não carregada.');
  }

  const cfg = window.AGENFLEX_SUPABASE_CONFIG;
  if (!cfg?.url || !cfg?.publishableKey || cfg.url.includes('SEU-PROJETO')) {
    throw new Error('Supabase ainda não configurado.');
  }

  agenflexSupabaseClient = window.supabase.createClient(cfg.url, cfg.publishableKey);
  return agenflexSupabaseClient;
}
