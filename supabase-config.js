// ========================================================
// SUPABASE CONFIG GLOBAL
// Arquivo único que centraliza URL, KEY e o client
// Acessível globalmente via window.supabaseClient
// ========================================================

(function() {
  // Se já foi inicializado, não faz nada
  if (window.supabaseClient) {
    console.log('✅ Supabase já inicializado');
    return;
  }

  // Credenciais
  window.SUPABASE_URL = 'https://qsztainariaiznbblrap.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenRhaW5hcmlhaXpuYmJscmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDQ1MDUsImV4cCI6MjA3OTQ4MDUwNX0.y9RYzXjnPaNo6Mbi_76W_MFBXHjpXmj-rvkvLYkIP4k';

  // Função para inicializar o cliente
  function inicializarSupabase() {
    try {
      if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.warn('⏳ Aguardando biblioteca Supabase carregar...');
        setTimeout(inicializarSupabase, 100);
        return;
      }

      window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
      
      console.log('✅ Supabase client inicializado com sucesso');
      
      // Disparar evento customizado para avisar que está pronto
      window.dispatchEvent(new Event('supabaseReady'));
      
    } catch (error) {
      console.error('❌ Erro ao inicializar Supabase:', error);
    }
  }

  // Tentar inicializar imediatamente
  inicializarSupabase();
})();
