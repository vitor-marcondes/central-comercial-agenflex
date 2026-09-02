// FUTURO — serviço de autenticação da Central.
// Será ligado à tela quando começarmos o login VENDEDOR / ADM.

async function loginComEmail(email, senha) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

async function logoutCentral() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

async function usuarioAtual() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

async function perfilAtual() {
  const client = getSupabaseClient();
  const user = await usuarioAtual();
  if (!user) return null;

  const { data, error } = await client
    .from('perfis')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) throw error;
  return data;
}
