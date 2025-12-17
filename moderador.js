// ============================================
// MODERADOR.JS - ARQUIVO PRINCIPAL
// Sistema CNV 2025
// ============================================

// ============================================
// 1. VARIÁVEIS GLOBAIS E FUNÇÕES AUXILIARES
// ============================================

// Função auxiliar para acessar o Supabase
function getSupabase() {
  if (!window.supabaseClient) {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
    }
  }
  return window.supabaseClient;
}

// Função auxiliar para escape HTML
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Função para fechar modal
function fecharModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modalContainer').innerHTML = '';
}

// ============================================
// 2. ESTADO GLOBAL
// ============================================

let sessaoAtual = null;
let config = null;
let modoAtivo = 'aguardando';

// Listas de dados
let palestras = [];
let enquetes = [];
let quizzes = [];
let perguntasRecebidas = [];
let quizAtual = null;
let perguntasQuiz = [];
let rankingQuiz = [];
let participantesQuiz = [];

// Canais realtime
let canalSessao = null;
let canalEnqueteVotos = null;
let canalQuizParticipantes = null;
let canalPerguntas = null;

// Debounce para não spammar o backend
let timeoutAtualizarResultadoEnquete = null;
function agendarAtualizarResultadoEnquete() {
  if (timeoutAtualizarResultadoEnquete) {
    clearTimeout(timeoutAtualizarResultadoEnquete);
  }
  timeoutAtualizarResultadoEnquete = setTimeout(() => {
    if (modoAtivo === 'enquetes') {
      if (typeof carregarResultadoEnquete === 'function') {
        carregarResultadoEnquete();
      } else if (typeof atualizarControle === 'function') {
        atualizarControle();
      }
    }
  }, 300);
}

// ============================================
// 3. INICIALIZAÇÃO
// ============================================

async function inicializar() {
  console.log('🚀 Inicializando moderador...');
  
  // Aguardar um pouco para garantir que o Supabase foi carregado
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // Verificar se o Supabase está disponível
  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Cliente Supabase não disponível');
    alert('Erro: Cliente Supabase não foi carregado. Recarregue a página.');
    return;
  }
  
  try {
    // Carregar configuração
    await carregarConfig();
    
    // Carregar sessão atual
    await carregarSessao();
    
    // Conectar realtime
    await conectarRealtime();
    
    // Carregar dados iniciais
    await carregarPalestras();
    await carregarEnquetes();
    await carregarQuizzes();
    
    // Abrir aba inicial
    abrirAba('controle');
    abrirSubAba('palestras');
    
    // Atualizar UI
    atualizarBotoesModo();
    atualizarStatusModo();
    atualizarBotaoQRCode();
    
    console.log('✅ Moderador inicializado');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    alert('Erro ao inicializar sistema: ' + error.message);
  }
}

// ============================================
// 4. CARREGAR DADOS
// ============================================

async function carregarConfig() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cnv_config')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error) throw error;
  
  config = data;
  document.getElementById('nomeEvento').textContent = config.nome_evento;
  
  // Aplicar cores
  document.documentElement.style.setProperty('--cor-primaria', config.cor_primaria);
  document.documentElement.style.setProperty('--cor-secundaria', config.cor_secundaria);
}

async function carregarSessao() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cnv_sessao')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error) throw error;
  
  sessaoAtual = data;
  modoAtivo = data.modo;
}

async function carregarPalestras() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cnv_palestras')
    .select('*')
    .eq('deletada', false)
    .order('criada_em', { ascending: false });
  
  if (error) {
    console.error('Erro ao carregar palestras:', error);
    return;
  }
  
  palestras = data || [];
  if (typeof renderizarListaPalestras === 'function') renderizarListaPalestras();
  if (typeof atualizarSelectExportPalestras === 'function') atualizarSelectExportPalestras();
}

async function carregarEnquetes() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cnv_enquetes')
    .select('*')
    .eq('deletada', false)
    .order('criada_em', { ascending: false });
  
  if (error) {
    console.error('Erro ao carregar enquetes:', error);
    return;
  }
  
  enquetes = data || [];
  if (typeof renderizarListaEnquetes === 'function') renderizarListaEnquetes();
  if (typeof atualizarSelectExportEnquetes === 'function') atualizarSelectExportEnquetes();
}

async function carregarQuizzes() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cnv_quizzes')
    .select('*')
    .eq('deletado', false)
    .order('criado_em', { ascending: false });
  
  if (error) {
    console.error('Erro ao carregar quizzes:', error);
    return;
  }
  
  quizzes = data || [];
  if (typeof renderizarListaQuizzes === 'function') renderizarListaQuizzes();
}

// ============================================
// 5. REALTIME
// ============================================

async function conectarRealtime() {
  const supabase = getSupabase();
  
  // Canal da sessão
  if (canalSessao) {
    await supabase.removeChannel(canalSessao);
  }
  
  canalSessao = supabase
    .channel('moderador_sessao')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv_sessao',
      filter: 'id=eq.1'
    }, (payload) => {
      console.log('🔔 Sessão atualizada:', payload.new);
      sessaoAtual = payload.new;
      modoAtivo = payload.new.modo;
      atualizarBotoesModo();
      atualizarStatusModo();
      atualizarControle();
    })
    .subscribe();

  // Canal dos votos da enquete
  if (canalEnqueteVotos) {
    await supabase.removeChannel(canalEnqueteVotos);
  }

  canalEnqueteVotos = supabase
    .channel('moderador_enquete_votos')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv_enquete_votos'
    }, (payload) => {
      if (!sessaoAtual?.enquete_ativa_id) return;
      const novoVoto = payload.new || payload.old;
      if (!novoVoto || novoVoto.enquete_id !== sessaoAtual.enquete_ativa_id) return;
      console.log('🗳️ Mudança em votos da enquete ativa:', payload);
      agendarAtualizarResultadoEnquete();
    })
    .subscribe();

  // Canal participantes do quiz
  if (canalQuizParticipantes) {
    await supabase.removeChannel(canalQuizParticipantes);
  }

  canalQuizParticipantes = supabase
    .channel('moderador_quiz_participantes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv_quiz_participantes'
    }, (payload) => {
      const registro = payload.new || payload.old;
      if (!quizAtual || !registro || registro.quiz_id !== quizAtual.id) return;
      console.log('👥 Participantes do quiz mudaram:', payload.eventType);
      if (typeof carregarParticipantesQuiz === 'function') {
        carregarParticipantesQuiz();
      }
    })
    .subscribe();

  // Canal das perguntas
  if (canalPerguntas) {
    await supabase.removeChannel(canalPerguntas);
  }

  canalPerguntas = supabase
    .channel('moderador_perguntas')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv_perguntas'
    }, (payload) => {
      if (modoAtivo !== 'perguntas') return;
      const pergunta = payload.new || payload.old;
      if (sessaoAtual?.palestra_ativa_id && pergunta?.palestra_id !== sessaoAtual.palestra_ativa_id) {
        return;
      }
      console.log('❓ Perguntas atualizadas em tempo real:', payload.eventType);
      if (typeof atualizarControle === 'function') {
        atualizarControle();
      }
    })
    .subscribe();
  
  console.log('✅ Realtime conectado');
}

// ============================================
// 6. INTERFACE - NAVEGAÇÃO
// ============================================

function abrirAba(aba) {
  // Esconder todas
  document.getElementById('abaCadastros').classList.add('hidden');
  document.getElementById('abaControle').classList.add('hidden');
  document.getElementById('abaExportar').classList.add('hidden');
  
  // Remover destaque dos tabs
  document.getElementById('tabCadastros').classList.remove('border-blue-500', 'text-blue-600');
  document.getElementById('tabControle').classList.remove('border-blue-500', 'text-blue-600');
  document.getElementById('tabExportar').classList.remove('border-blue-500', 'text-blue-600');
  
  // Mostrar aba selecionada
  if (aba === 'cadastros') {
    document.getElementById('abaCadastros').classList.remove('hidden');
    document.getElementById('tabCadastros').classList.add('border-blue-500', 'text-blue-600');
  } else if (aba === 'controle') {
    document.getElementById('abaControle').classList.remove('hidden');
    document.getElementById('tabControle').classList.add('border-blue-500', 'text-blue-600');
    atualizarControle();
  } else if (aba === 'exportar') {
    document.getElementById('abaExportar').classList.remove('hidden');
    document.getElementById('tabExportar').classList.add('border-blue-500', 'text-blue-600');
  }
}

function abrirSubAba(subAba) {
  // Esconder todas
  document.getElementById('subAbaPalestras').classList.add('hidden');
  document.getElementById('subAbaEnquetes').classList.add('hidden');
  document.getElementById('subAbaQuizzes').classList.add('hidden');
  
  // Remover destaque
  document.getElementById('subPalestras').classList.remove('bg-blue-600', 'text-white');
  document.getElementById('subEnquetes').classList.remove('bg-blue-600', 'text-white');
  document.getElementById('subQuizzes').classList.remove('bg-blue-600', 'text-white');
  
  // Mostrar sub-aba selecionada
  if (subAba === 'palestras') {
    document.getElementById('subAbaPalestras').classList.remove('hidden');
    document.getElementById('subPalestras').classList.add('bg-blue-600', 'text-white');
  } else if (subAba === 'enquetes') {
    document.getElementById('subAbaEnquetes').classList.remove('hidden');
    document.getElementById('subEnquetes').classList.add('bg-blue-600', 'text-white');
  } else if (subAba === 'quizzes') {
    document.getElementById('subAbaQuizzes').classList.remove('hidden');
    document.getElementById('subQuizzes').classList.add('bg-blue-600', 'text-white');
  }
}

// ============================================
// 7. MODO ATIVO
// ============================================

async function mudarModo(novoModo) {
  if (!confirm(`Mudar para modo "${novoModo.toUpperCase()}"? Isso vai limpar o estado atual das telas.`)) {
    return;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cnv_sessao')
      .update({
        modo: novoModo,
        metadata: { limpar_cache: true, timestamp: new Date().toISOString() }
      })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    sessaoAtual = data || { ...(sessaoAtual || {}), modo: novoModo };
    modoAtivo = sessaoAtual.modo;

    atualizarBotoesModo();
    atualizarStatusModo();
    atualizarControle();

    alert(`✅ Modo alterado para: ${novoModo.toUpperCase()}`);
  } catch (error) {
    console.error('Erro ao mudar modo:', error);
    alert('❌ Erro ao mudar modo');
  }
}

function atualizarBotoesModo() {
  const botoes = ['btnModoAguardando', 'btnModoPerguntas', 'btnModoEnquetes', 'btnModoQuiz'];
  const modos = ['aguardando', 'perguntas', 'enquetes', 'quiz'];
  
  botoes.forEach((btnId, index) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (modos[index] === modoAtivo) {
      btn.className = 'btn-modo btn-modo-ativo';
    } else {
      btn.className = 'btn-modo btn-modo-inativo';
    }
  });
}

function atualizarStatusModo() {
  const status = document.getElementById('statusModo');
  if (!status) return;
  
  let mensagem = '';
  
  if (modoAtivo === 'aguardando') {
    mensagem = '⏸️ Sistema em modo aguardando. Telão e participantes veem tela de espera.';
  } else if (modoAtivo === 'perguntas') {
    mensagem = `📊 Modo PERGUNTAS ativo${sessaoAtual?.perguntas_abertas ? ' - Perguntas ABERTAS' : ' - Perguntas FECHADAS'}`;
  } else if (modoAtivo === 'enquetes') {
    mensagem = `📋 Modo ENQUETES ativo${sessaoAtual?.enquete_votacao_aberta ? ' - Votação ABERTA' : ' - Votação FECHADA'}`;
  } else if (modoAtivo === 'quiz') {
    mensagem = `🎮 Modo QUIZ ativo - Estado: ${sessaoAtual?.quiz_estado || 'aguardando'}`;
  }
  
  status.innerHTML = `<strong>Status:</strong> ${mensagem}`;
}

function atualizarControle() {
  // Esconder todos os controles
  const ctrlPerguntas = document.getElementById('controlePerguntas');
  const ctrlEnquetes = document.getElementById('controleEnquetes');
  const ctrlQuiz = document.getElementById('controleQuiz');
  
  if (ctrlPerguntas) ctrlPerguntas.classList.add('hidden');
  if (ctrlEnquetes) ctrlEnquetes.classList.add('hidden');
  if (ctrlQuiz) ctrlQuiz.classList.add('hidden');
  
  // Mostrar controle do modo ativo
  if (modoAtivo === 'perguntas' && ctrlPerguntas) {
    ctrlPerguntas.classList.remove('hidden');
    if (typeof carregarControlePerguntas === 'function') carregarControlePerguntas();
  } else if (modoAtivo === 'enquetes' && ctrlEnquetes) {
    ctrlEnquetes.classList.remove('hidden');
    if (typeof carregarControleEnquetes === 'function') carregarControleEnquetes();
  } else if (modoAtivo === 'quiz' && ctrlQuiz) {
    ctrlQuiz.classList.remove('hidden');
    if (typeof carregarControleQuiz === 'function') carregarControleQuiz();
  }
}

async function forcarRefreshParticipantes() {
  try {
    const supabase = getSupabase();
    const metaAtual = (sessaoAtual && sessaoAtual.metadata) ? sessaoAtual.metadata : {};
    const novoToken = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

    const novoMetadata = {
      ...metaAtual,
      refresh_token: novoToken
    };

    const { data, error } = await supabase
      .from('cnv_sessao')
      .update({ metadata: novoMetadata })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    sessaoAtual = data;
    alert('✅ Comando de atualização enviado para participantes.');

  } catch (error) {
    console.error('Erro ao forçar refresh dos participantes:', error);
    alert('❌ Erro ao enviar comando de atualização.');
  }
}

// ============================================
// 8. CONTROLE DO QR CODE
// ============================================

async function toggleQRCode() {
  try {
    const supabase = getSupabase();
    const novoEstado = !sessaoAtual?.mostrar_qrcode;
    
    const { data, error } = await supabase
      .from('cnv_sessao')
      .update({ mostrar_qrcode: novoEstado })
      .eq('id', 1)
      .select()
      .single();
    
    if (error) throw error;
    
    sessaoAtual = data;
    atualizarBotaoQRCode();
    
    alert(`✅ QR Code ${novoEstado ? 'visível' : 'oculto'} no telão`);
    
  } catch (error) {
    console.error('Erro ao toggle QR Code:', error);
    alert('❌ Erro ao atualizar QR Code');
  }
}

function atualizarBotaoQRCode() {
  const btn = document.getElementById('btnQRCode');
  if (!btn) return;
  
  if (sessaoAtual?.mostrar_qrcode) {
    btn.innerHTML = '🙈 Ocultar QR';
    btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    btn.classList.add('bg-green-600', 'hover:bg-green-700');
  } else {
    btn.innerHTML = '📱 Mostrar QR';
    btn.classList.remove('bg-green-600', 'hover:bg-green-700');
    btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
  }
}

// ============================================
// 9. INICIALIZAÇÃO AUTOMÁTICA
// ============================================

// Inicializar quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  // DOM já está pronto
  inicializar();
}
