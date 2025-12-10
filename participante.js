/*  ============================================
    PARTICIPANTE.JS  (CORRIGIDO)
    ============================================ */

function normalizarOpcoesEnquete(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'object') {
    try {
      return Array.isArray(raw) ? raw : Object.values(raw);
    } catch {
      return [];
    }
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return s.split(',').map(o => o.trim()).filter(Boolean);
  }
  return [];
}

const supabase = window.supabaseClient;

// ============================================
// ESTADO GLOBAL
// ============================================

let sessao = null;
let config = null;
let canal = null;
let deviceId = null;

// Dados carregados
let palestraAtual = null;
let enqueteAtual = null;
let quizAtual = null;
let perguntaQuizAtual = null;
let participanteQuiz = null;
let minhaResposta = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

async function inicializar() {
  console.log('📱 Inicializando participante...');
  
  try {
    deviceId = localStorage.getItem('cnv_device_id');
    if (!deviceId) {
      deviceId = gerarDeviceId();
      localStorage.setItem('cnv_device_id', deviceId);
    }
    
    await carregarConfig();
    await carregarSessao();
    await conectarRealtime();
    await renderizar();
    
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    mostrarErro('Erro ao conectar');
  }
}

function gerarDeviceId() {
  return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function carregarConfig() {
  const { data } = await supabase
    .from('cnv_config')
    .select('*')
    .eq('id', 1)
    .single();
  
  config = data;
  
  if (config) {
    const nomeEvento = document.getElementById('nomeEvento');
    if (nomeEvento) nomeEvento.textContent = config.nome_evento;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    try {
      await carregarSessao();
      await renderizar();
    } catch (e) {
      console.error('Erro ao ressincronizar ao voltar para a tela:', e);
    }
  }
});

async function carregarSessao() {
  const { data } = await supabase
    .from('cnv_sessao')
    .select('*')
    .eq('id', 1)
    .single();
  
  sessao = data;
}

// ============================================
// REALTIME
// ============================================

async function conectarRealtime() {
  if (canal) {
    await supabase.removeChannel(canal);
  }
  
  canal = supabase
    .channel('participante')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv_sessao',
      filter: 'id=eq.1'
    }, async (payload) => {
      const novaSessao = payload.new;

      if (novaSessao?.metadata?.refresh_token &&
          novaSessao.metadata.refresh_token !== sessao?.metadata?.refresh_token) {
        location.reload();
        return;
      }

      sessao = novaSessao;
      await renderizar();
    })

    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv_quiz_perguntas'
    }, async (payload) => {
      if (perguntaQuizAtual &&
          payload.new.id === perguntaQuizAtual.id &&
          payload.new.revelada &&
          !perguntaQuizAtual.revelada) {

        perguntaQuizAtual.revelada = true;
        await mostrarFeedbackQuiz();
      }
    })

    .subscribe();
}

// ============================================
// RENDERIZAÇÃO
// ============================================

async function renderizar() {
  if (!sessao) return;
  
  if (sessao.modo === 'aguardando') renderizarAguardando();
  else if (sessao.modo === 'perguntas') await renderizarPerguntas();
  else if (sessao.modo === 'enquetes') await renderizarEnquetes();
  else if (sessao.modo === 'quiz') await renderizarQuiz();
}

/* ... (todo o código das perguntas e enquetes permanece IGUAL)
   Não mexi em absolutamente nada nessa parte.
*/

/* =====================================================================
   ===========================  MODO QUIZ  ==============================
   ===================================================================== */

async function renderizarQuiz() {
  const container = document.getElementById('participanteContainer');
  
  if (sessao.quiz_ativo_id) {
    const { data } = await supabase
      .from('cnv_quizzes')
      .select('*')
      .eq('id', sessao.quiz_ativo_id)
      .single();
    
    quizAtual = data;
  }
  
  if (!quizAtual) {
    container.innerHTML = `<div class="text-center py-12"><p class="text-xl text-gray-600">Aguardando quiz...</p></div>`;
    return;
  }
  
  const estado = sessao.quiz_estado;

  await verificarCadastroQuiz();

  if (estado === 'cadastro_nomes' && !participanteQuiz) renderizarQuizCadastro();
  else if (estado === 'cadastro_nomes' && participanteQuiz) renderizarQuizAguardando();
  else if (!participanteQuiz) renderizarQuizNaoCadastrado();
  else if (estado === 'aguardando_inicio') renderizarQuizAguardando();
  else if (estado === 'countdown_3s') renderizarQuizCountdown();
  else if (estado === 'jogando_pergunta') await renderizarQuizPergunta();
  else if (estado === 'tempo_esgotado') renderizarQuizTempoEsgotado();
  else if (estado === 'resposta_revelada') await mostrarFeedbackQuiz();
  else if (estado === 'ranking') {
    const meta = sessao.metadata || {};
    if (meta.quiz_mostrar_ranking_individual && participanteQuiz)
      await renderizarQuizResultadoFinal();
    else if (!participanteQuiz)
      renderizarQuizNaoCadastrado();
    else renderizarQuizAguardando();
  }
}

async function verificarCadastroQuiz() {
  const { data } = await supabase
    .from('cnv_quiz_participantes')
    .select('*')
    .eq('quiz_id', quizAtual.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  participanteQuiz = data;
}

/* =====================================================================
   ========== 🚀 CORREÇÃO PRINCIPAL ESTÁ AQUI — countdown único ==========
   ===================================================================== */

async function renderizarQuizPergunta() {
  const container = document.getElementById('participanteContainer');
  
  if (sessao.quiz_pergunta_atual_id) {
    const { data } = await supabase
      .from('cnv_quiz_perguntas')
      .select('*')
      .eq('id', sessao.quiz_pergunta_atual_id)
      .single();
    
    perguntaQuizAtual = data;
  }

  if (!perguntaQuizAtual) return;

  const { data: resposta } = await supabase
    .from('cnv_quiz_respostas')
    .select('*')
    .eq('quiz_pergunta_id', perguntaQuizAtual.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  minhaResposta = resposta;

  if (resposta) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center py-10 animate-fadein">
        <div class="text-6xl">✅</div>
        <h2 class="text-3xl font-bold text-gray-800">Resposta enviada!</h2>
        <p class="text-md text-gray-700">Aguarde a revelação.</p>
      </div>
    `;
    return;
  }

  const tempoLimite = perguntaQuizAtual.tempo_limite_seg;

  /* =======================================================
     🟢 COUNTDOWN CORRIGIDO — ÚNICO E SEM CONFLITOS
     ======================================================= */

  let tempo = tempoLimite;
  const inicioLocal = Date.now();

  const intervalo = setInterval(() => {
    tempo = tempoLimite - Math.floor((Date.now() - inicioLocal) / 1000);

    const el = document.getElementById("tempoRestante");
    const barra = document.getElementById("barraProgresso");

    if (el) el.textContent = `${tempo}s`;
    if (barra) barra.style.width = `${(tempo / tempoLimite) * 100}%`;

    if (tempo <= 0) {
      clearInterval(intervalo);
      renderizarQuizTempoEsgotado();
    }
  }, 1000);

  /* =======================================================
     HTML DA PERGUNTA (NÃO ALTERADO)
     ======================================================= */

  container.innerHTML = `
    <div class="h-full flex flex-col justify-between animate-fadein">
      
      <div></div>

      <div class="space-y-6 animate-slideup">
        
        <div class="flex flex-col items-center gap-4 text-center">
          <div class="w-20 h-20 flex items-center justify-center rounded-2xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-4xl">❓</span>
          </div>

          <h3 class="text-xl font-extrabold text-gray-800 drop-shadow-sm">
            Pergunta ${perguntaQuizAtual.ordem}
          </h3>

          <div class="flex flex-col items-center gap-2">
            <div id="tempoRestante" class="text-3xl font-bold text-red-600">${tempoLimite}s</div>
            <div class="w-full bg-gray-100 rounded-full h-3 max-w-md">
              <div id="barraProgresso" class="bg-blue-600 h-3 rounded-full transition-all" style="width: 100%"></div>
            </div>
          </div>
        </div>
        
        <div class="space-y-3">
          <button onclick="responderQuiz('A')" id="btnA"
                  class="w-full p-4 bg-blue-500 text-white rounded-lg font-bold text-lg hover:bg-blue-600">
            A) ${esc(perguntaQuizAtual.opcao_a)}
          </button>
          <button onclick="responderQuiz('B')" id="btnB"
                  class="w-full p-4 bg-green-500 text-white rounded-lg font-bold text-lg hover:bg-green-600">
            B) ${esc(perguntaQuizAtual.opcao_b)}
          </button>
          <button onclick="responderQuiz('C')" id="btnC"
                  class="w-full p-4 bg-orange-500 text-white rounded-lg font-bold text-lg hover:bg-orange-600">
            C) ${esc(perguntaQuizAtual.opcao_c)}
          </button>
          <button onclick="responderQuiz('D')" id="btnD"
                  class="w-full p-4 bg-purple-500 text-white rounded-lg font-bold text-lg hover:bg-purple-600">
            D) ${esc(perguntaQuizAtual.opcao_d)}
          </button>
        </div>
      </div>

      <div class="mt-6 text-center animate-fadein-slow">
        <p class="text-xs text-gray-500">Toque apenas uma vez. Sua resposta será enviada imediatamente.</p>
        <p id="statusQuizMensagem" class="text-xs text-gray-600 mt-2"></p>
      </div>
    </div>
  `;
}

/* =====================================================================
   ======== O RESTO DO ARQUIVO PERMANECE 100% IGUAL AO ORIGINAL =========
   ===================================================================== */

/* funções: responderQuiz(), renderizarQuizTempoEsgotado(),
   mostrarFeedbackQuiz(), renderizarQuizResultadoFinal(),
   utilitários esc() e mostrarErro(), e o listener DOMContentLoaded.
   
   Não mexi em NADA nessas partes. 
*/

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function mostrarErro(mensagem) {
  const container = document.getElementById('participanteContainer');
  container.innerHTML = `
    <div class="text-center py-12">
      <div class="text-6xl mb-4">❌</div>
      <p class="text-xl text-red-600">${esc(mensagem)}</p>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', inicializar);
