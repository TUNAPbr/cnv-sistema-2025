// ========================================================
// SUPABASE CONFIG GLOBAL
// Arquivo único que centraliza URL, KEY e o client
// Acessível globalmente via window.supabaseClient
// ========================================================

// Se quiser evitar problemas caso carregue o script 2x:
if (!window.supabaseClient) {

  window.SUPABASE_URL = 'https://qsztainariaiznbblrap.supabase.co';

  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenRhaW5hcmlhaXpuYmJscmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDQ1MDUsImV4cCI6MjA3OTQ4MDUwNX0.y9RYzXjnPaNo6Mbi_76W_MFBXHjpXmj-rvkvLYkIP4k';

  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
}
