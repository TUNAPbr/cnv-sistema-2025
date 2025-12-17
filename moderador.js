// ============================================
// MODERADOR.JS - VERSÃO SIMPLIFICADA
// Sistema CNV 2025
// ============================================

console.log('📋 Carregando moderador.js...');

// ============================================
// FUNÇÃO AUXILIAR: Aguardar Supabase
// ============================================

function getSupabase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.supabaseClient) {
        resolve(window.supabaseClient);
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

// ============================================
// ESTADO GLOBAL
// ============================================

let supabase = null;
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
    if (modoAtivo === 'enquete') {
      if (typeof carregarResultadoEnquete === 'function') {
        carregarResultadoEnquete();
      } else if (typeof atualizarControle === 'function') {
        atualizarControle();
      }
    }
  }, 300);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

async function inicializar() {
  console.log('🚀 Inicializando moderador...');
  
  try {
    // Aguardar Supabase
    supabase = await getSupabase();
    console.log('✅ Supabase conectado');
    
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
    alert('Erro ao inicializar sistema. Verifique as credenciais do Supabase.');
  }
}

// ============================================
// CARREGAR DADOS
// ============================================

async function carregarConfig() {
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
  renderizarListaPalestras();
  atualizarSelectExportPalestras();
}

async function carregarEnquetes() {
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
  renderizarListaEnquetes();
  atualizarSelectExportEnquetes();
}

async function carregarQuizzes() {
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
  renderizarListaQuizzes();
}

// ============================================
// REALTIME
// ============================================

async function conectarRealtime() {
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
      if (!novoVoto) return;

      if (novoVoto.enquete_id !== sessaoAtual.enquete_ativa_id) return;

      console.log('🗳️ Mudança em votos da enquete ativa:', payload);
      
      agendarAtualizarResultadoEnquete();
    })
    .subscribe();

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
// INTERFACE - NAVEGAÇÃO
// ============================================

function abrirAba(aba) {
  document.getElementById('abaCadastros').classList.add('hidden');
  document.getElementById('abaControle').classList.add('hidden');
  document.getElementById('abaExportar').classList.add('hidden');
  
  document.getElementById('tabCadastros').classList.remove('border-blue-500', 'text-blue-600');
  document.getElementById('tabControle').classList.remove('border-blue-500', 'text-blue-600');
  document.getElementById('tabExportar').classList.remove('border-blue-500', 'text-blue-600');
  
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
  document.getElementById('subAbaPalestras').classList.add('hidden');
  document.getElementById('subAbaEnquetes').classList.add('hidden');
  document.getElementById('subAbaQuizzes').classList.add('hidden');
  
  document.getElementById('subPalestras').classList.remove('bg-blue-600', 'text-white');
  document.getElementById('subEnquetes').classList.remove('bg-blue-600', 'text-white');
  document.getElementById('subQuizzes').classList.remove('bg-blue-600', 'text-white');
  
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
// MODO ATIVO
// ============================================

async function mudarModo(novoModo) {
  if (!confirm(`Mudar para modo "${novoModo.toUpperCase()}"? Isso vai limpar o estado atual das telas.`)) {
    return;
  }

  try {
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
    if (modos[index] === modoAtivo) {
      btn.className = 'btn-modo btn-modo-ativo';
    } else {
      btn.className = 'btn-modo btn-modo-inativo';
    }
  });
}

function atualizarStatusModo() {
  const status = document.getElementById('statusModo');
  
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
  document.getElementById('controlePerguntas').classList.add('hidden');
  document.getElementById('controleEnquetes').classList.add('hidden');
  document.getElementById('controleQuiz').classList.add('hidden');
  
  if (modoAtivo === 'perguntas') {
    document.getElementById('controlePerguntas').classList.remove('hidden');
    carregarControlePerguntas();
  } else if (modoAtivo === 'enquetes') {
    document.getElementById('controleEnquetes').classList.remove('hidden');
    carregarControleEnquetes();
  } else if (modoAtivo === 'quiz') {
    document.getElementById('controleQuiz').classList.remove('hidden');
    carregarControleQuiz();
  }
}

async function forcarRefreshParticipantes() {
  try {
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
// CONTROLE DO QR CODE
// ============================================

async function toggleQRCode() {
  try {
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
// INICIALIZAR QUANDO A PÁGINA CARREGAR
// ============================================

document.addEventListener('DOMContentLoaded', inicializar);

console.log('✅ moderador.js carregado');
