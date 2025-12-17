// ========================================================
// SUPABASE CONFIG GLOBAL - VERSÃO SIMPLIFICADA
// Garante que o cliente seja criado apenas uma vez
// ========================================================

console.log('🔧 Carregando supabase-config.js...');

// Prevenir execução múltipla
if (window.supabaseConfigLoaded) {
  console.log('⚠️ supabase-config.js já foi carregado, pulando...');
} else {
  window.supabaseConfigLoaded = true;
  
  // Credenciais
  const SUPABASE_URL = 'https://qsztainariaiznbblrap.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenRhaW5hcmlhaXpuYmJscmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDQ1MDUsImV4cCI6MjA3OTQ4MDUwNX0.y9RYzXjnPaNo6Mbi_76W_MFBXHjpXmj-rvkvLYkIP4k';
  
  // Função para inicializar
  function initSupabase() {
    // Se já existe, não cria de novo
    if (window.supabaseClient) {
      console.log('✅ supabaseClient já existe');
      return;
    }
    
    // Verificar se a biblioteca do CDN carregou
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.log('⏳ Aguardando Supabase CDN...');
      setTimeout(initSupabase, 50);
      return;
    }
    
    try {
      // Criar o cliente
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ supabaseClient criado com sucesso!');
      
      // Disparar evento
      if (typeof Event !== 'undefined') {
        window.dispatchEvent(new Event('supabaseReady'));
      }
    } catch (error) {
      console.error('❌ Erro ao criar supabaseClient:', error);
    }
  }
  
  // Iniciar
  initSupabase();
}
