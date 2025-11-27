// ============================================
// TELAO.JS
// Tela de Projeção (Read-Only)
// ============================================

// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================

const SUPABASE_URL = 'SUA_URL_AQUI';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_AQUI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// ESTADO GLOBAL
// ============================================

let sessao = null;
let config = null;
let canal = null;

// Dados carregados
let palestraAtual = null;
let perguntaExibida = null;
let enqueteAtual = null;
let quizAtual = null;
let perguntaQuizAtual = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

async function inicializar() {
  console.log('🖥️ Inicializando telão...');
  
  try {
    await carregarConfig();
    await carregarSessao();
    await conectarRealtime();
    await renderizar();
    
    console.log('✅ Telão inicializado');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar telão:', error);
    mostrarErro('Erro ao conectar. Verifique as credenciais do Supabase.');
  }
}

async function carregarConfig() {
  const { data } = await supabase
    .from('cnv_config')
    .select('*')
    .eq('id', 1)
    .single();
  
  config = data;
  
  if (config) {
    document.documentElement.style.setProperty('--cor-primaria', config.cor_primaria);
    document.documentElement.style.setProperty('--cor-secundaria', config.cor_secundaria);
  }
}

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
    .channel('telao')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv_sessao',
      filter: 'id=eq.1'
    }, async (payload) => {
      console.log('🔔 Sessão atualizada:', payload.new);
      sessao = payload.new;
      await renderizar();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv_perguntas'
    }, async () => {
      if (sessao?.modo === 'perguntas') {
        await renderizar();
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv_quiz_perguntas'
    }, async () => {
      if (sessao?.modo === 'quiz') {
        await renderizar();
      }
    })
    .subscribe();
}

// ============================================
// RENDERIZAÇÃO PRINCIPAL
// ============================================

async function renderizar() {
  if (!sessao) return;
  
  const container = document.getElementById('telaoContainer');
  container.className = 'w-full h-screen p-8 fade-in';
  
  // Decisão de renderização baseada no modo
  if (sessao.modo === 'aguardando') {
    renderizarAguardando();
  } else if (sessao.modo === 'perguntas') {
    await renderizarPerguntas();
  } else if (sessao.modo === 'enquetes') {
    await renderizarEnquetes();
  } else if (sessao.modo === 'quiz') {
    await renderizarQuiz();
  }
}

// ============================================
// MODO: AGUARDANDO
// ============================================

function renderizarAguardando() {
  const container = document.getElementById('telaoContainer');
  
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full">
      <h1 class="text-8xl font-bold mb-8">${esc(config?.nome_evento || 'CNV 2025')}</h1>
      <p class="text-4xl text-gray-200">Aguardando próxima atividade...</p>
    </div>
  `;
}

// ============================================
// MODO: PERGUNTAS
// ============================================

async function renderizarPerguntas() {
  const container = document.getElementById('telaoContainer');
  
  // Carregar palestra
  if (sessao.palestra_ativa_id && (!palestraAtual || palestraAtual.id !== sessao.palestra_ativa_id)) {
    const { data } = await supabase
      .from('cnv_palestras')
      .select('*')
      .eq('id', sessao.palestra_ativa_id)
      .single();
    
    palestraAtual = data;
  }
  
  if (!palestraAtual) {
    container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-4xl">Aguardando palestra...</p></div>';
    return;
  }
  
  // Verificar se tem pergunta para exibir
  const { data: pergunta } = await supabase
    .from('cnv_perguntas')
    .select('*')
    .eq('palestra_id', palestraAtual.id)
    .eq('exibida_no_telao', true)
    .eq('deletada', false)
    .single();
  
  if (pergunta) {
    // Mostrar pergunta específica
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="bg-white bg-opacity-20 backdrop-blur-lg rounded-3xl p-12 max-w-4xl w-full">
          <div class="mb-6">
            <h2 class="text-3xl font-bold text-yellow-300">${esc(palestraAtual.nome)}</h2>
            <p class="text-xl text-gray-200">${esc(palestraAtual.palestrante)}</p>
          </div>
          <div class="mb-4">
            <p class="text-2xl text-gray-300 mb-2">${pergunta.nome_autor || 'Participante'} pergunta:</p>
          </div>
          <p class="text-5xl font-bold leading-relaxed">${esc(pergunta.pergunta)}</p>
        </div>
      </div>
    `;
  } else {
    // Status geral
    const statusTexto = sessao.perguntas_abertas ? 
      '🟢 Perguntas ABERTAS' : 
      '🔴 Perguntas FECHADAS';
    
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-center">
          <h1 class="text-6xl font-bold mb-4">${esc(palestraAtual.nome)}</h1>
          <p class="text-4xl text-gray-200 mb-8">Palestrante: ${esc(palestraAtual.palestrante)}</p>
          <div class="text-5xl font-bold mb-8">${statusTexto}</div>
          ${sessao.perguntas_abertas ? 
            '<p class="text-3xl text-yellow-300">📱 Envie sua pergunta pelo celular!</p>' : 
            '<p class="text-3xl text-gray-300">Perguntas encerradas</p>'
          }
        </div>
      </div>
    `;
  }
}

// ============================================
// MODO: ENQUETES
// ============================================

async function renderizarEnquetes() {
  const container = document.getElementById('telaoContainer');
  
  // Carregar enquete
  if (sessao.enquete_ativa_id && (!enqueteAtual || enqueteAtual.id !== sessao.enquete_ativa_id)) {
    const { data } = await supabase
      .from('cnv_enquetes')
      .select('*')
      .eq('id', sessao.enquete_ativa_id)
      .single();
    
    enqueteAtual = data;
  }
  
  if (!enqueteAtual) {
    container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-4xl">Aguardando enquete...</p></div>';
    return;
  }
  
  const opcoes = JSON.parse(enqueteAtual.opcoes);
  
  // Se deve mostrar resultado
  if (sessao.enquete_mostrar_resultado) {
    const { data: resultado } = await supabase.rpc('cnv_resultado_enquete', {
      p_enquete_id: enqueteAtual.id
    });
    
    const totalVotos = (resultado || []).reduce((sum, r) => sum + parseInt(r.total_votos), 0);
    
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="w-full max-w-5xl">
          <h1 class="text-6xl font-bold mb-8 text-center">${esc(enqueteAtual.nome)}</h1>
          <p class="text-3xl text-center mb-12 text-gray-200">📊 Resultado (${totalVotos} votos)</p>
          <div class="space-y-4">
            ${opcoes.map((opcao, idx) => {
              const res = (resultado || []).find(r => r.opcao_index === idx);
              const votos = res ? parseInt(res.total_votos) : 0;
              const percentual = res ? parseFloat(res.percentual) : 0;
              
              return `
                <div class="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl p-6">
                  <div class="flex justify-between items-center mb-3">
                    <span class="text-3xl font-bold">${idx + 1}. ${esc(opcao)}</span>
                    <span class="text-3xl font-bold text-yellow-300">${percentual}%</span>
                  </div>
                  <div class="w-full bg-white bg-opacity-30 rounded-full h-8">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-8 rounded-full flex items-center justify-end pr-4" 
                         style="width: ${percentual}%">
                      <span class="text-white font-bold">${votos} votos</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  } else {
    // Status geral
    const statusTexto = sessao.enquete_votacao_aberta ? 
      '🟢 Votação ABERTA' : 
      '🔴 Votação FECHADA';
    
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-center">
          <h1 class="text-6xl font-bold mb-12">${esc(enqueteAtual.nome)}</h1>
          <div class="text-5xl font-bold mb-8">${statusTexto}</div>
          ${sessao.enquete_votacao_aberta ? 
            '<p class="text-3xl text-yellow-300">📱 Vote pelo seu celular!</p>' : 
            '<p class="text-3xl text-gray-300">Votação encerrada. Aguardando resultado...</p>'
          }
        </div>
      </div>
    `;
  }
}

// ============================================
// MODO: QUIZ
// ============================================

async function renderizarQuiz() {
  const container = document.getElementById('telaoContainer');
  
  // Carregar quiz
  if (sessao.quiz_ativo_id && (!quizAtual || quizAtual.id !== sessao.quiz_ativo_id)) {
    const { data } = await supabase
      .from('cnv_quizzes')
      .select('*')
      .eq('id', sessao.quiz_ativo_id)
      .single();
    
    quizAtual = data;
  }
  
  if (!quizAtual) {
    container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-4xl">Aguardando quiz...</p></div>';
    return;
  }
  
  const estado = sessao.quiz_estado;
  
  // Decisão baseada no estado do quiz
  if (estado === 'cadastro_nomes') {
    await renderizarQuizCadastroNomes();
  } else if (estado === 'aguardando_inicio') {
    renderizarQuizAguardando();
  } else if (estado === 'countdown_3s') {
    renderizarQuizCountdown3s();
  } else if (estado === 'jogando_pergunta') {
    await renderizarQuizPergunta();
  } else if (estado === 'tempo_esgotado') {
    renderizarQuizTempoEsgotado();
  } else if (estado === 'resposta_revelada') {
    await renderizarQuizResultado();
  } else if (estado === 'ranking') {
    await renderizarQuizRanking();
  } else {
    renderizarQuizAguardando();
  }
}

async function renderizarQuizCadastroNomes() {
  const container = document.getElementById('telaoContainer');
  
  // Carregar participantes
  const { data: participantes } = await supabase
    .from('cnv_quiz_participantes')
    .select('nome, cadastrado_em')
    .eq('quiz_id', quizAtual.id)
    .order('cadastrado_em', { ascending: false })
    .limit(20);
  
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full">
      <h1 class="text-7xl font-bold mb-8">🎮 ${esc(quizAtual.nome)}</h1>
      <p class="text-4xl mb-8 text-yellow-300">📝 Cadastro de Participantes Aberto!</p>
      <p class="text-3xl mb-12 text-gray-200">${(participantes || []).length} participantes cadastrados</p>
      
      ${(participantes || []).length > 0 ? `
        <div class="grid grid-cols-4 gap-4 max-w-6xl">
          ${participantes.slice(0, 16).map(p => `
            <div class="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-4 text-center">
              <p class="text-2xl font-bold">👤 ${esc(p.nome)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <p class="text-3xl mt-12 text-yellow-300">📱 Cadastre-se pelo seu celular!</p>
    </div>
  `;
}

function renderizarQuizAguardando() {
  const container = document.getElementById('telaoContainer');
  
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full">
      <h1 class="text-7xl font-bold mb-8">🎮 ${esc(quizAtual.nome)}</h1>
      <p class="text-5xl text-yellow-300">O quiz vai começar!</p>
      <p class="text-3xl mt-8 text-gray-200">⏳ Aguardando primeira pergunta...</p>
    </div>
  `;
}

function renderizarQuizCountdown3s() {
  const container = document.getElementById('telaoContainer');
  
  let contador = 3;
  
  const atualizar = () => {
    container.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="countdown-display text-center">
          <div class="text-[20rem] font-bold leading-none">${contador}</div>
          <p class="text-6xl mt-8">segundos</p>
        </div>
      </div>
    `;
    
    contador--;
    
    if (contador < 0) {
      clearInterval(intervalo);
    }
  };
  
  atualizar();
  const intervalo = setInterval(atualizar, 1000);
}

async function renderizarQuizPergunta() {
  const container = document.getElementById('telaoContainer');
  
  // Carregar pergunta atual
  if (sessao.quiz_pergunta_atual_id) {
    const { data } = await supabase
      .from('cnv_quiz_perguntas')
      .select('*')
      .eq('id', sessao.quiz_pergunta_atual_id)
      .single();
    
    perguntaQuizAtual = data;
  }
  
  if (!perguntaQuizAtual) return;
  
  const tempoLimite = perguntaQuizAtual.tempo_limite_seg;
  
  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="text-center mb-8">
        <h2 class="text-4xl font-bold text-yellow-300">Pergunta ${perguntaQuizAtual.ordem}</h2>
        <div id="tempoRestante" class="text-6xl font-bold mt-4">${tempoLimite}s</div>
      </div>
      
      <div class="flex-1 flex flex-col items-center justify-center">
        <div class="bg-white bg-opacity-20 backdrop-blur-lg rounded-3xl p-12 max-w-5xl w-full mb-8">
          <p class="text-5xl font-bold text-center leading-relaxed">${esc(perguntaQuizAtual.pergunta)}</p>
        </div>
        
        <div class="grid grid-cols-2 gap-6 max-w-5xl w-full">
          <div class="bg-blue-500 bg-opacity-30 rounded-2xl p-6">
            <p class="text-4xl font-bold">A) ${esc(perguntaQuizAtual.opcao_a)}</p>
          </div>
          <div class="bg-green-500 bg-opacity-30 rounded-2xl p-6">
            <p class="text-4xl font-bold">B) ${esc(perguntaQuizAtual.opcao_b)}</p>
          </div>
          <div class="bg-orange-500 bg-opacity-30 rounded-2xl p-6">
            <p class="text-4xl font-bold">C) ${esc(perguntaQuizAtual.opcao_c)}</p>
          </div>
          <div class="bg-purple-500 bg-opacity-30 rounded-2xl p-6">
            <p class="text-4xl font-bold">D) ${esc(perguntaQuizAtual.opcao_d)}</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Countdown visual
  let tempo = tempoLimite;
  const intervalo = setInterval(() => {
    tempo--;
    const el = document.getElementById('tempoRestante');
    if (el) {
      el.textContent = `${tempo}s`;
      if (tempo <= 5) {
        el.classList.add('text-red-500', 'countdown-display');
      }
    }
    if (tempo <= 0) {
      clearInterval(intervalo);
    }
  }, 1000);
}

function renderizarQuizTempoEsgotado() {
  const container = document.getElementById('telaoContainer');
  
  container.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="text-center countdown-display">
        <div class="text-[15rem] leading-none mb-8">⏰</div>
        <p class="text-8xl font-bold text-red-500">TEMPO</p>
        <p class="text-8xl font-bold text-red-500">ESGOTADO!</p>
      </div>
    </div>
  `;
}

async function renderizarQuizResultado() {
  const container = document.getElementById('telaoContainer');
  
  if (!perguntaQuizAtual) return;
  
  // Buscar estatísticas
  const { data: stats } = await supabase.rpc('cnv_stats_pergunta_quiz', {
    p_pergunta_id: perguntaQuizAtual.id
  });
  
  const distribuicao = stats?.distribuicao || {};
  const totalRespostas = stats?.total_respostas || 0;
  const percentualAcerto = stats?.percentual_acerto || 0;
  
  const opcoes = {
    'A': perguntaQuizAtual.opcao_a,
    'B': perguntaQuizAtual.opcao_b,
    'C': perguntaQuizAtual.opcao_c,
    'D': perguntaQuizAtual.opcao_d
  };
  
  const correta = perguntaQuizAtual.resposta_correta;
  
  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="text-center mb-8">
        <div class="bg-green-500 bg-opacity-30 rounded-3xl p-6 inline-block mb-4">
          <p class="text-5xl font-bold">✓ RESPOSTA CORRETA: ${correta}</p>
        </div>
        <p class="text-4xl">${percentualAcerto}% acertaram</p>
        <p class="text-2xl text-gray-300">${totalRespostas} respostas</p>
      </div>
      
      <div class="grid grid-cols-4 gap-4 px-8">
        ${['A', 'B', 'C', 'D'].map(letra => {
          const isCorreta = letra === correta;
          const dados = distribuicao[letra] || { votos: 0, percentual: 0 };
          
          return `
            <div class="rounded-2xl p-6 ${isCorreta ? 'bg-green-500 bg-opacity-50 ring-4 ring-yellow-400' : 'bg-white bg-opacity-20'}">
              <div class="text-center mb-4">
                <p class="text-4xl font-bold">${letra}</p>
                ${isCorreta ? '<p class="text-4xl">✓</p>' : ''}
              </div>
              <p class="text-2xl font-bold text-center">${dados.votos} votos</p>
              <div class="w-full bg-white bg-opacity-30 rounded-full h-4 mt-3">
                <div class="bg-white h-4 rounded-full" style="width: ${dados.percentual || 0}%"></div>
              </div>
              <p class="text-xl text-center mt-2">${dados.percentual || 0}%</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function renderizarQuizRanking() {
  const container = document.getElementById('telaoContainer');
  
  const { data: ranking } = await supabase.rpc('cnv_ranking_quiz', {
    p_quiz_id: quizAtual.id
  });
  
  const top10 = (ranking || []).slice(0, 10);
  
  container.innerHTML = `
    <div class="flex flex-col h-full">
      <h1 class="text-8xl font-bold text-center mb-12">🏆 RANKING</h1>
      
      <div class="space-y-4 px-12">
        ${top10.map(r => {
          const medal = r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : `${r.posicao}º`;
          const bgColor = r.posicao === 1 ? 'bg-yellow-500' : 
                          r.posicao === 2 ? 'bg-gray-400' : 
                          r.posicao === 3 ? 'bg-orange-600' : 'bg-white';
          
          return `
            <div class="${bgColor} bg-opacity-30 backdrop-blur-lg rounded-2xl p-6 flex items-center justify-between">
              <div class="flex items-center gap-6">
                <span class="text-6xl font-bold">${medal}</span>
                <span class="text-5xl font-bold">${esc(r.nome)}</span>
              </div>
              <div class="text-right">
                <p class="text-5xl font-bold text-yellow-300">${r.pontos_totais} pts</p>
                <p class="text-2xl text-gray-200">${r.total_acertos} acertos</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================
// UTILITÁRIOS
// ============================================

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function mostrarErro(mensagem) {
  const container = document.getElementById('telaoContainer');
  container.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="text-center">
        <p class="text-6xl mb-4">❌</p>
        <p class="text-4xl">${esc(mensagem)}</p>
      </div>
    </div>
  `;
}

// ============================================
// INICIAR
// ============================================

document.addEventListener('DOMContentLoaded', inicializar);
