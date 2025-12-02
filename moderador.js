// ============================================
// MODERADOR.JS - ARQUIVO PRINCIPAL
// Sistema CNV 2025
// ============================================

// ============================================
// 1. CONFIGURAÇÃO SUPABASE
// ============================================

const supabase = window.supabaseClient;

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

// Debounce para não spammar o backend
let timeoutAtualizarResultadoEnquete = null;
function agendarAtualizarResultadoEnquete() {
  if (timeoutAtualizarResultadoEnquete) {
    clearTimeout(timeoutAtualizarResultadoEnquete);
  }
  timeoutAtualizarResultadoEnquete = setTimeout(() => {
    // Só atualiza se estivermos no modo ENQUETE
    if (modoAtivo === 'enquete') {
      if (typeof carregarResultadoEnquete === 'function') {
        carregarResultadoEnquete();
      } else if (typeof atualizarControle === 'function') {
        // fallback, caso precise
        atualizarControle();
      }
    }
  }, 300); // 300ms: dá uma suavizada se chover voto
}

// ============================================
// 3. INICIALIZAÇÃO
// ============================================

async function inicializar() {
  console.log('🚀 Inicializando moderador...');
  
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
    
    console.log('✅ Moderador inicializado');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    alert('Erro ao inicializar sistema. Verifique as credenciais do Supabase.');
  }
}

// ============================================
// 4. CARREGAR DADOS
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
// 5. REALTIME
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
      event: '*',             // INSERT / DELETE / UPDATE (zera enquete também dispara)
      schema: 'public',
      table: 'cnv_enquete_votos'
    }, (payload) => {
      // Segurança básica
      if (!sessaoAtual?.enquete_ativa_id) return;

      const novoVoto = payload.new || payload.old;
      if (!novoVoto) return;

      // Só reagir à enquete que está ativa na sessão
      if (novoVoto.enquete_id !== sessaoAtual.enquete_ativa_id) return;

      console.log('🗳️ Mudança em votos da enquete ativa:', payload);
      
      // Atualiza painel de resultado com debounce
      agendarAtualizarResultadoEnquete();
    })
    .subscribe();
  
  console.log('✅ Realtime conectado (sessão + enquete)');
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

    // 🔹 Atualiza estado local imediatamente
    sessaoAtual = data || { ...(sessaoAtual || {}), modo: novoModo };
    modoAtivo = sessaoAtual.modo;

    // 🔹 Atualiza a UI na hora
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
  // Esconder todos os controles
  document.getElementById('controlePerguntas').classList.add('hidden');
  document.getElementById('controleEnquetes').classList.add('hidden');
  document.getElementById('controleQuiz').classList.add('hidden');
  
  // Mostrar controle do modo ativo
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
    // Garante que temos o metadata atual
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
// CONTINUA NOS PRÓXIMOS ARQUIVOS...
// ============================================

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', inicializar);
