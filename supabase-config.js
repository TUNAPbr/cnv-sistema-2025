// ========================================================
// SUPABASE CONFIG GLOBAL
// Arquivo único que centraliza URL, KEY e o client
// Acessível globalmente via window.supabaseClient
// ========================================================

(function() {
  'use strict';
  
  // Configurações
  window.SUPABASE_URL = 'https://qsztainariaiznbblrap.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenRhaW5hcmlhaXpuYmJscmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDQ1MDUsImV4cCI6MjA3OTQ4MDUwNX0.y9RYzXjnPaNo6Mbi_76W_MFBXHjpXmj-rvkvLYkIP4k';

  // Função para inicializar o cliente
  function initSupabaseClient() {
    if (window.supabaseClient) {
      console.log('✅ Supabase client já existe');
      return;
    }
    
    if (!window.supabase) {
      console.warn('⚠️ Aguardando biblioteca Supabase...');
      return;
    }
    
    try {
      window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
      console.log('✅ Supabase client inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Supabase:', error);
    }
  }

  // Tentar inicializar imediatamente
  initSupabaseClient();

  // Fallback: tentar novamente quando DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseClient);
  }
  
  // Fallback: tentar novamente após pequeno delay
  if (!window.supabaseClient) {
    setTimeout(initSupabaseClient, 100);
  }
})();
