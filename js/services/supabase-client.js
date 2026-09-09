// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: supabase-client.js
//
// Responsabilidade:
// - Criar e reutilizar uma única instância do cliente Supabase
// - Validar se a biblioteca e a configuração foram carregadas
// - Disponibilizar getSupabaseClient() para os outros services
//
// Dependências:
// - Biblioteca @supabase/supabase-js
// - js/config/supabase-config.js
//
// Utilizado por:
// - auth.service.js
// - propostas.service.js
//
// IMPORTANTE:
// A publishable key pode ser usada no frontend.
// Chaves secretas, service_role e senhas nunca devem
// ser colocadas neste arquivo.
// =========================================================


// =========================================================
// ## 1. ESTADO DO CLIENTE
// =========================================================

// Guarda a instância criada do Supabase.
// Começa como null porque o cliente ainda não foi criado.

let agenflexSupabaseClient = null;


// =========================================================
// ## 2. OBTENÇÃO DO CLIENTE SUPABASE
// =========================================================

function getSupabaseClient() {

  // Se o cliente já foi criado anteriormente,
  // reutiliza a mesma instância.
  if (agenflexSupabaseClient) {

    return agenflexSupabaseClient;

  }


  // Verifica se a biblioteca supabase-js
  // foi carregada pelo index.html.
  if (!window.supabase) {

    throw new Error(
      'Biblioteca supabase-js não carregada.'
    );

  }


  // Recupera a configuração definida
  // no arquivo supabase-config.js.
  const cfg =
    window.AGENFLEX_SUPABASE_CONFIG;


  // Valida se a configuração mínima existe.
  if (
    !cfg?.url ||
    !cfg?.publishableKey ||
    cfg.url.includes('SEU-PROJETO')
  ) {

    throw new Error(
      'Supabase ainda não configurado.'
    );

  }


  // Cria uma única instância do cliente Supabase.
  agenflexSupabaseClient =
    window.supabase.createClient(
      cfg.url,
      cfg.publishableKey
    );


  return agenflexSupabaseClient;
}