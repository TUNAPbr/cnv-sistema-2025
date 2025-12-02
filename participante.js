// ============================================
// PARTICIPANTE.JS
// Interface de Interação (Mobile-Friendly)
// ============================================

// ============================================
// UTILITÁRIO: NORMALIZAR OPÇÕES DE ENQUETE
// ============================================

function normalizarOpcoesEnquete(raw) {
  if (Array.isArray(raw)) return raw;

  if (raw === null || raw === undefined) return [];

  // Se for objeto JSON (caso raro)
  if (typeof raw === 'object') {
    try {
      return Array.isArray(raw) ? raw : Object.values(raw);
    } catch {
      return [];
    }
  }

  // Se for string
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];

    // 1) Tenta interpretar como JSON (ex: '["Top","Muito bom"]')
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignora erro, cai pro split
    }

    // 2) fallback: string simples separada por vírgula
    return s.split(',').map(o => o.trim()).filter(Boolean);
  }

  return [];
}

// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================

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
    // Gerar device ID único
    deviceId = localStorage.getItem('cnv_device_id');
    if (!deviceId) {
      deviceId = gerarDeviceId();
      localStorage.setItem('cnv_device_id', deviceId);
    }
    console.log('📱 Device ID:', deviceId);
    
    await carregarConfig();
    await carregarSessao();
    await conectarRealtime();
    await renderizar();
    
    console.log('✅ Participante inicializado');
    
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
    document.getElementById('nomeEvento').textContent = config.nome_evento;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    console.log('👀 Tela do participante voltou a ficar visível, ressincronizando...');
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
      console.log('🔔 Sessão atualizada:', payload.new);
      const novaSessao = payload.new;
    
      const tokenAntigo = sessao?.metadata?.refresh_token;
      const tokenNovo  = novaSessao?.metadata?.refresh_token;
    
      if (tokenNovo && tokenNovo !== tokenAntigo) {
        console.log('🔁 Comando global de refresh detectado, recarregando página...');
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
      if (perguntaQuizAtual && payload.new.id === perguntaQuizAtual.id && 
          payload.new.revelada && !perguntaQuizAtual.revelada) {
        perguntaQuizAtual.revelada = true;
        await mostrarFeedbackQuiz();
      }
    })
    .subscribe();
}

// ============================================
// RENDERIZAÇÃO PRINCIPAL
// ============================================

async function renderizar() {
  if (!sessao) return;
  
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
  const container = document.getElementById('participanteContainer');

  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">

      <!-- topo -->
      <div></div>

      <!-- conteúdo principal -->
      <div class="flex flex-col items-center gap-6 animate-slideup">

        <div class="w-24 h-24 mx-auto flex items-center justify-center rounded-3xl 
                    bg-white/20 backdrop-blur-md shadow-xl animate-pulse-slow">
          <span class="text-6xl">⏳</span>
        </div>

        <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
          Aguardando<br>Atividade
        </h2>
      </div>

      <!-- rodapé do card -->
      <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
        O moderador vai iniciar em instantes...
      </p>

    </div>
  `;
}

// ============================================
// MODO: PERGUNTAS
// ============================================

async function renderizarPerguntas() {
  const container = document.getElementById('participanteContainer');
  
  // Carregar palestra
  if (sessao.palestra_ativa_id) {
    const { data } = await supabase
      .from('cnv_palestras')
      .select('*')
      .eq('id', sessao.palestra_ativa_id)
      .single();
    
    palestraAtual = data;
  }
  
  if (!palestraAtual) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
  
        <div></div>
  
        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl animate-pulse-slow">
            <span class="text-6xl">🎤</span>
          </div>
  
          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Aguardando<br>Palestra
          </h2>
        </div>
  
        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          A palestra será iniciada em instantes...
        </p>
  
      </div>
    `;
    return;
  }

  if (!sessao.perguntas_abertas) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
  
        <div></div>
  
        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-6xl">🔒</span>
          </div>
  
          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Perguntas Fechadas
          </h2>
  
          <p class="text-lg text-gray-700">
            ${esc(palestraAtual.nome)}
          </p>
          <p class="text-md text-gray-600 -mt-4">
            ${esc(palestraAtual.palestrante)}
          </p>
        </div>
  
        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          O moderador ainda não liberou perguntas
        </p>
  
      </div>
    `;
    return;
  }
  
  // Verificar quantas perguntas já fez
  const validacao = await verificarPodePerguntar();
  
  container.innerHTML = `
    <div>
      <div class="flex flex-col items-center gap-4 text-center animate-fadein">
        <div class="w-20 h-20 flex items-center justify-center rounded-2xl 
                    bg-white/20 backdrop-blur-md shadow-xl animate-pulse-slow">
          <span class="text-5xl">💬</span>
        </div>
      
        <h2 class="text-2xl font-extrabold text-gray-800 drop-shadow-sm">
          Pergunte ao Palestrante
        </h2>
      
        <p class="text-md text-gray-700 -mt-2">
          ${esc(palestraAtual.nome)}
        </p>
        <p class="text-sm text-gray-600">
          ${esc(palestraAtual.palestrante)}
        </p>
      </div>
      
      ${validacao.pode ? `
        <form id="formPergunta" onsubmit="enviarPergunta(event)" class="space-y-4">
          <div>
            <label class="block text-sm font-bold mb-2">Seu nome (opcional)</label>
            <input type="text" id="nomeAutor" class="w-full p-3 border rounded-lg" 
                   placeholder="Digite seu nome aqui">
            <label class="flex items-center mt-2">
              <input type="checkbox" id="checkAnonimo" class="mr-2">
              <span class="text-sm">Enviar como anônimo</span>
            </label>
          </div>
          
          <div>
            <label class="block text-sm font-bold mb-2">Seu email (opcional)</label>
            <input type="email" id="emailAutor" class="w-full p-3 border rounded-lg" 
                   placeholder="seu@email.com">
          </div>
          
          <div>
            <label class="block text-sm font-bold mb-2">Sua pergunta *</label>
            <textarea id="perguntaTexto" rows="4" required maxlength="140"
                      class="w-full p-3 border rounded-lg" 
                      placeholder="Digite sua pergunta aqui..."></textarea>
            <p class="text-xs text-gray-500 mt-1">Máximo 140 caracteres</p>
          </div>
          
          <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
            📤 Enviar Pergunta
          </button>
          
          <p class="text-xs text-center text-gray-500">
            Restam ${validacao.restantes} perguntas
          </p>
        </form>
      ` : `
        <div class="flex flex-col items-center gap-6 text-center px-4 py-10 animate-fadein">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-red-100 backdrop-blur-md shadow-xl">
            <span class="text-6xl">⛔</span>
          </div>=
          <h2 class="text-2xl font-extrabold text-red-700 drop-shadow-sm">
            Limite Atingido
          </h2>
          <p id="mensagemBloqueioPergunta" class="text-red-700 font-semibold text-lg animate-fadein-slow">
            ⚠️ ${validacao.motivo}
          </p>
      </div>
      `}
    </div>
  `;

  // Se está bloqueado para perguntar, inicia contagem regressiva visual (se houver segundos na mensagem)
  if (!validacao.pode) {
    iniciarCountdownBloqueioPergunta(validacao.motivo);
  }
  
  // Listener para checkbox anônimo
  const checkAnonimo = document.getElementById('checkAnonimo');
  if (checkAnonimo) {
    checkAnonimo.addEventListener('change', (e) => {
      document.getElementById('nomeAutor').disabled = e.target.checked;
      document.getElementById('emailAutor').disabled = e.target.checked;
    });
  }
}

let intervaloBloqueioPergunta;

function iniciarCountdownBloqueioPergunta(motivoOriginal) {
  // Limpa contagem anterior, se existir
  if (intervaloBloqueioPergunta) {
    clearInterval(intervaloBloqueioPergunta);
    intervaloBloqueioPergunta = null;
  }

  // Tenta achar um número de segundos na mensagem (ex: "28 segundos")
  const match = motivoOriginal.match(/(\d+)\s*segundo/);
  if (!match) return; // se não tiver número, não faz nada

  let tempo = parseInt(match[1], 10);
  const el = document.getElementById('mensagemBloqueioPergunta');
  if (!el) return;

  const atualizar = () => {
    if (tempo <= 0) {
      clearInterval(intervaloBloqueioPergunta);
      intervaloBloqueioPergunta = null;
      // Quando zerar, re-renderiza a tela pra consultar de novo o backend
      renderizar();
      return;
    }

    const texto = motivoOriginal.replace(
      /(\d+)\s*segundo/,
      `${tempo} segundo${tempo === 1 ? '' : 's'}`
    );

    el.textContent = `⚠️ ${texto}`;
    tempo--;
  };

  // Atualiza imediatamente e depois a cada 1s
  atualizar();
  intervaloBloqueioPergunta = setInterval(atualizar, 1000);
}

async function verificarPodePerguntar() {
  const { data, error } = await supabase.rpc('cnv_pode_perguntar', {
    p_palestra_id: palestraAtual.id,
    p_device_id: deviceId
  });
  
  if (error) {
    console.error('Erro ao verificar:', error);
    return { pode: false, motivo: 'Erro ao verificar' };
  }
  
  return data;
}

async function enviarPergunta(event) {
  event.preventDefault();
  
  const anonimo = document.getElementById('checkAnonimo').checked;
  const nome = anonimo ? null : document.getElementById('nomeAutor').value.trim() || null;
  const email = anonimo ? null : document.getElementById('emailAutor').value.trim() || null;
  const pergunta = document.getElementById('perguntaTexto').value.trim();
  
  if (!pergunta) {
    alert('Digite uma pergunta');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('cnv_perguntas')
      .insert({
        palestra_id: palestraAtual.id,
        device_id: deviceId,
        nome_autor: nome,
        email_autor: email,
        pergunta: pergunta
      });
    
    if (error) throw error;

    await renderizar();
    
  } catch (error) {
    console.error('Erro ao enviar pergunta:', error);
    alert('❌ Erro ao enviar pergunta');
  }
}

// ============================================
// MODO: ENQUETES
// ============================================

async function renderizarEnquetes() {
  const container = document.getElementById('participanteContainer');
  
  // Carregar enquete atual a partir da sessão
  if (sessao.enquete_ativa_id) {
    const { data } = await supabase
      .from('cnv_enquetes')
      .select('*')
      .eq('id', sessao.enquete_ativa_id)
      .single();
    
    enqueteAtual = data;
  }
  
  // 1) Nenhuma enquete ativa
  if (!enqueteAtual) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
        
        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl animate-pulse-slow">
            <span class="text-6xl">📊</span>
          </div>

          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Aguardando<br>Enquete
          </h2>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          Assim que o moderador iniciar uma enquete, ela aparece aqui.
        </p>

      </div>
    `;
    return;
  }
  
  // 2) Enquete carregada mas votação fechada
  if (!sessao.enquete_votacao_aberta) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">

        <div></div>

        <div class="flex flex-col items-center gap-5 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-6xl">🚪</span>
          </div>

          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Enquete Encerrada
          </h2>

          <p class="text-lg text-gray-700">
            ${esc(enqueteAtual.nome)}
          </p>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          A votação foi finalizada pelo moderador.
        </p>

      </div>
    `;
    return;
  }
  
  // 3) Verificar se já votou
  const { data: voto } = await supabase
    .from('cnv_enquete_votos')
    .select('*')
    .eq('enquete_id', enqueteAtual.id)
    .eq('device_id', deviceId)
    .single();
  
  if (voto) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">

        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-6xl">✅</span>
          </div>

          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Voto Registrado
          </h2>

          <p class="text-lg text-gray-700">
            Obrigado por participar!
          </p>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          Aguarde o moderador revelar o resultado.
        </p>

      </div>
    `;
    return;
  }
  
  // 4) Tela de votação (participante ainda não votou)
  const opcoes = normalizarOpcoesEnquete(enqueteAtual.opcoes);
  
  container.innerHTML = `
    <div class="h-full flex flex-col justify-between animate-fadein">
      
      <div></div>

      <div class="space-y-6 animate-slideup">
        <div class="flex flex-col items-center gap-4 text-center">
          <div class="w-20 h-20 flex items-center justify-center rounded-2xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-5xl">🗳️</span>
          </div>

          <h2 class="text-2xl font-extrabold text-gray-800 drop-shadow-sm">
            ${esc(enqueteAtual.nome)}
          </h2>

          <p class="text-md text-gray-700">
            Selecione uma opção abaixo:
          </p>
        </div>
        
        <div class="space-y-3">
          ${opcoes.map((opcao, idx) => `
            <button onclick="votarEnquete(${idx})" 
                    class="w-full p-4 bg-blue-500 text-white rounded-lg font-bold text-lg hover:bg-blue-600 transition btn-opcao">
              ${idx + 1}. ${esc(opcao)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="mt-6 text-center animate-fadein-slow">
        <p class="text-xs text-gray-500">
          Seu voto é único para esta enquete.
        </p>
        <p id="statusVotoMensagem" class="text-xs text-gray-600 mt-2"></p>
      </div>
    </div>
  `;
}

async function votarEnquete(opcao) {
  if (!enqueteAtual || !sessao) return;

  // elemento para mensagens de status no rodapé do card
  const statusEl = document.getElementById('statusVotoMensagem');

  // feedback imediato
  if (statusEl) {
    statusEl.textContent = 'Enviando seu voto...';
  }

  // desabilitar botões enquanto envia
  const botoes = document.querySelectorAll('.btn-opcao');
  botoes.forEach(btn => {
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-not-allowed');
  });

  try {
    const { error } = await supabase
      .from('cnv_enquete_votos')
      .insert({
        enquete_id: enqueteAtual.id,
        device_id: deviceId,
        opcao_escolhida: opcao
      });
    
    if (error) throw error;

    // sucesso: só re-renderiza; a tela de "Voto Registrado" assume o controle
    if (statusEl) {
      statusEl.textContent = '';
    }

    await renderizar();
    
  } catch (error) {
    console.error('Erro ao votar:', error);

    // mensagem de erro elegante, sem alert
    if (statusEl) {
      if (error.code === '23505') {
        statusEl.textContent = 'Você já votou nesta enquete.';
      } else {
        statusEl.textContent = 'Erro ao registrar voto. Tente novamente em instantes.';
      }
    }

    // reabilitar botões em caso de erro
    botoes.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    });
  }
}

// garantir que o onclick no HTML encontre a função
window.votarEnquete = votarEnquete;

// ============================================
// MODO: QUIZ
// ============================================

async function renderizarQuiz() {
  const container = document.getElementById('participanteContainer');
  
  // Carregar quiz
  if (sessao.quiz_ativo_id) {
    const { data } = await supabase
      .from('cnv_quizzes')
      .select('*')
      .eq('id', sessao.quiz_ativo_id)
      .single();
    
    quizAtual = data;
  }
  
  if (!quizAtual) {
    container.innerHTML = `
      <div class="text-center py-12">
        <p class="text-xl text-gray-600">Aguardando quiz...</p>
      </div>
    `;
    return;
  }
  
  const estado = sessao.quiz_estado;

  // Sempre conferir se esse device já está cadastrado no quiz
  await verificarCadastroQuiz();

  // Decisões baseadas no estado + cadastro
  if (estado === 'cadastro_nomes' && !participanteQuiz) {
    // Período de cadastro e ainda não se cadastrou
    renderizarQuizCadastro();
  } else if (estado === 'cadastro_nomes' && participanteQuiz) {
    // Já se cadastrou: mostra tela de aguardando
    renderizarQuizAguardando();
  } else if (!participanteQuiz) {
    // Fora do período de cadastro e não está cadastrado
    renderizarQuizNaoCadastrado();
  } else if (estado === 'aguardando_inicio') {
    renderizarQuizAguardando();
  } else if (estado === 'countdown_3s') {
    renderizarQuizCountdown();
  } else if (estado === 'jogando_pergunta') {
    await renderizarQuizPergunta();
  } else if (estado === 'tempo_esgotado') {
    renderizarQuizTempoEsgotado();
  } else if (estado === 'resposta_revelada') {
    await mostrarFeedbackQuiz();
  } else {
    renderizarQuizAguardando();
  }
}

async function verificarCadastroQuiz() {
  const { data, error } = await supabase
    .from('cnv_quiz_participantes')
    .select('*')
    .eq('quiz_id', quizAtual.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar cadastro no quiz:', error);
  }
  
  participanteQuiz = data;
}

function renderizarQuizCadastro() {
  const container = document.getElementById('participanteContainer');
  
  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">

      <div></div>

      <div class="flex flex-col items-center gap-6 animate-slideup">
        <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                    bg-white/20 backdrop-blur-md shadow-xl animate-pulse-slow">
          <span class="text-6xl">🎮</span>
        </div>

        <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
          Entrar no Quiz
        </h2>

        <p class="text-md text-gray-700 -mt-2">
          ${esc(quizAtual.nome)}
        </p>

        <p class="text-sm text-gray-600">
          Cadastre seu nome para participar da próxima rodada.
        </p>
      </div>
      
      <form id="formCadastroQuiz" onsubmit="cadastrarNoQuiz(event)" class="w-full max-w-md mx-auto space-y-4 animate-fadein-slow">
        <div class="text-left">
          <label class="block text-sm font-bold mb-2">Seu nome *</label>
          <input type="text" id="nomeQuiz" required maxlength="20"
                 class="w-full p-3 border rounded-lg text-lg" 
                 placeholder="Digite seu nome">
          <p class="text-xs text-gray-500 mt-1">Máximo 20 caracteres</p>
        </div>
        
        <button type="submit" 
                class="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition">
          ✅ Entrar no Quiz
        </button>

        <p id="statusCadastroQuiz" class="text-xs text-gray-600 text-center mt-2"></p>
      </form>
    </div>
  `;
}

async function cadastrarNoQuiz(event) {
  event.preventDefault();
  
  const nomeInput = document.getElementById('nomeQuiz');
  const statusEl = document.getElementById('statusCadastroQuiz');
  const nome = nomeInput.value.trim();
  
  if (!nome) {
    if (statusEl) statusEl.textContent = 'Digite seu nome para entrar no quiz.';
    return;
  }

  if (statusEl) {
    statusEl.textContent = 'Enviando seu cadastro...';
  }
  
  // desabilita botão enquanto envia
  const form = document.getElementById('formCadastroQuiz');
  const btn = form?.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-not-allowed');
  }
  
  try {
    const { error } = await supabase
      .from('cnv_quiz_participantes')
      .insert({
        quiz_id: quizAtual.id,
        device_id: deviceId,
        nome: nome
      });
    
    if (error) throw error;
    
    if (statusEl) {
      statusEl.textContent = '';
    }
    
    await renderizar();
    
  } catch (error) {
    console.error('Erro ao cadastrar:', error);
    
    if (statusEl) {
      if (error.code === '23505') {
        statusEl.textContent = 'Você já está cadastrado neste quiz.';
      } else {
        statusEl.textContent = 'Erro ao cadastrar. Tente novamente em instantes.';
      }
    }
    
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }
}

function renderizarQuizNaoCadastrado() {
  const container = document.getElementById('participanteContainer');
  
  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
      
      <div></div>

      <div class="flex flex-col items-center gap-6 animate-slideup">
        <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                    bg-white/20 backdrop-blur-md shadow-xl">
          <span class="text-6xl">🔒</span>
        </div>

        <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
          Cadastro Encerrado
        </h2>

        <p class="text-md text-gray-700 max-w-sm">
          Você não pode participar deste quiz, pois o período de cadastro já foi encerrado.
        </p>
      </div>

      <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
        Acompanhe pelo telão e pelas próximas interações.
      </p>

    </div>
  `;
}

function renderizarQuizAguardando() {
  const container = document.getElementById('participanteContainer');
  
  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
      
      <div></div>

      <div class="flex flex-col items-center gap-6 animate-slideup">
        <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                    bg-white/20 backdrop-blur-md shadow-xl animate-pulse-slow">
          <span class="text-6xl">🎮</span>
        </div>

        <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
          Você está participando!
        </h2>

        <p class="text-md text-gray-700 max-w-sm">
          Aguarde o moderador iniciar a próxima pergunta.
        </p>
      </div>

      <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
        Fique atento ao seu celular, o tempo para responder será limitado. ⏱️
      </p>

    </div>
  `;
}

function renderizarQuizCountdown() {
  const container = document.getElementById('participanteContainer');
  
  let contador = 3;
  
  const atualizar = () => {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
        
        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-32 h-32 flex items-center justify-center rounded-full 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <div class="text-[5rem] font-extrabold leading-none">
              ${contador >= 0 ? contador : 0}
            </div>
          </div>

          <h2 class="text-2xl font-extrabold text-gray-800 drop-shadow-sm">
            Prepare-se para responder!
          </h2>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          A pergunta será exibida em instantes.
        </p>

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
  const container = document.getElementById('participanteContainer');
  
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
  
  // Verificar se já respondeu
  const { data: resposta, error } = await supabase
    .from('cnv_quiz_respostas')
    .select('*')
    .eq('quiz_pergunta_id', perguntaQuizAtual.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar resposta do quiz:', error);
  }
  
  minhaResposta = resposta;

  // Se já respondeu, mostra tela de “Resposta enviada”
  if (resposta) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">

        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-6xl">✅</span>
          </div>

          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Resposta enviada!
          </h2>

          <p class="text-md text-gray-700 max-w-sm">
            Aguarde a revelação da resposta correta.
          </p>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          Sua pontuação será calculada com base no tempo de resposta. ⏱️
        </p>

      </div>
    `;
    return;
  }
  
  // Mostrar opções
  const tempoLimite = perguntaQuizAtual.tempo_limite_seg;

  // Guarda o início da contagem em window para usar no cálculo da pontuação
  window.inicioContagem = Date.now();
  
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
                  class="w-full p-4 bg-blue-500 text-white rounded-lg font-bold text-lg hover:bg-blue-600 transition btn-opcao">
            A) ${esc(perguntaQuizAtual.opcao_a)}
          </button>
          <button onclick="responderQuiz('B')" id="btnB"
                  class="w-full p-4 bg-green-500 text-white rounded-lg font-bold text-lg hover:bg-green-600 transition btn-opcao">
            B) ${esc(perguntaQuizAtual.opcao_b)}
          </button>
          <button onclick="responderQuiz('C')" id="btnC"
                  class="w-full p-4 bg-orange-500 text-white rounded-lg font-bold text-lg hover:bg-orange-600 transition btn-opcao">
            C) ${esc(perguntaQuizAtual.opcao_c)}
          </button>
          <button onclick="responderQuiz('D')" id="btnD"
                  class="w-full p-4 bg-purple-500 text-white rounded-lg font-bold text-lg hover:bg-purple-600 transition btn-opcao">
            D) ${esc(perguntaQuizAtual.opcao_d)}
          </button>
        </div>
      </div>

      <div class="mt-6 text-center animate-fadein-slow">
        <p class="text-xs text-gray-500">
          Toque apenas uma vez. Sua resposta será enviada imediatamente.
        </p>
        <p id="statusQuizMensagem" class="text-xs text-gray-600 mt-2"></p>
      </div>
    </div>
  `;
  
  // Countdown visual
  let tempo = tempoLimite;  
  const intervalo = setInterval(() => {
    tempo--;
    const el = document.getElementById('tempoRestante');
    const barra = document.getElementById('barraProgresso');
    
    if (el) el.textContent = `${tempo}s`;
    if (barra) {
      const percentual = (tempo / tempoLimite) * 100;
      barra.style.width = `${percentual}%`;
    }
    
    if (tempo <= 0) {
      clearInterval(intervalo);
    }
  }, 1000);
}

async function responderQuiz(opcao) {
  const tempoResposta = Math.floor((Date.now() - (window.inicioContagem || Date.now())) / 1000);
  
  const statusEl = document.getElementById('statusQuizMensagem');

  if (statusEl) {
    statusEl.textContent = 'Enviando sua resposta...';
  }

  // Desabilitar botões
  ['A', 'B', 'C', 'D'].forEach(letra => {
    const btn = document.getElementById(`btn${letra}`);
    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-70', 'cursor-not-allowed');
    }
  });
  
  // Destacar escolha
  const btnEscolhido = document.getElementById(`btn${opcao}`);
  if (btnEscolhido) {
    btnEscolhido.classList.add('ring-4', 'ring-yellow-400');
  }
  
  try {
    const correta = opcao === perguntaQuizAtual.resposta_correta;
    const pontos = correta ? Math.max(1000 - (tempoResposta * 10), 100) : 0;
    
    const { error } = await supabase
      .from('cnv_quiz_respostas')
      .insert({
        quiz_pergunta_id: perguntaQuizAtual.id,
        device_id: deviceId,
        resposta_escolhida: opcao,
        tempo_resposta_seg: tempoResposta,
        correta: correta,
        pontos: pontos
      });
    
    if (error) throw error;
    
    minhaResposta = { resposta_escolhida: opcao, correta, pontos };
    
    if (statusEl) {
      statusEl.textContent = '';
    }

    await renderizar();
    
  } catch (error) {
    console.error('Erro ao responder:', error);
    
    if (statusEl) {
      statusEl.textContent = 'Erro ao enviar resposta. Tente novamente na próxima pergunta.';
    }

    // Reabilita botões em caso de erro
    ['A', 'B', 'C', 'D'].forEach(letra => {
      const btn = document.getElementById(`btn${letra}`);
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
      }
    });
  }
}

async function mostrarFeedbackQuiz() {
  const container = document.getElementById('participanteContainer');
  
  if (!minhaResposta) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">

        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="w-24 h-24 flex items-center justify-center rounded-3xl 
                      bg-white/20 backdrop-blur-md shadow-xl">
            <span class="text-6xl">❌</span>
          </div>

          <h2 class="text-3xl font-extrabold text-gray-800 drop-shadow-sm">
            Você não respondeu
          </h2>

          <p class="text-md text-gray-700 max-w-sm">
            A resposta correta era: <strong>${perguntaQuizAtual.resposta_correta}</strong>
          </p>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          Fique atento às próximas perguntas para somar pontos.
        </p>

      </div>
    `;
    return;
  }
  
  if (minhaResposta.correta) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
        
        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="text-[6rem] mb-2">🎉</div>
          <h2 class="text-3xl font-extrabold text-green-600 drop-shadow-sm">
            VOCÊ ACERTOU!
          </h2>
          <div class="text-5xl font-bold text-yellow-500 mb-2">+${minhaResposta.pontos}</div>
          <p class="text-lg text-gray-700">pontos nesta pergunta</p>
          <p class="text-md text-gray-600 mt-2">
            Resposta correta: <strong>${perguntaQuizAtual.resposta_correta}</strong>
          </p>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          Continue assim para subir no ranking! 🏆
        </p>

      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-between text-center px-6 py-10 animate-fadein">
        
        <div></div>

        <div class="flex flex-col items-center gap-6 animate-slideup">
          <div class="text-[5rem] mb-2">😕</div>
          <h2 class="text-3xl font-extrabold text-red-600 drop-shadow-sm">
            Você errou
          </h2>
          <p class="text-lg text-gray-700">
            Você escolheu: <strong>${minhaResposta.resposta_escolhida}</strong>
          </p>
          <p class="text-lg text-green-600">
            Resposta correta: <strong>${perguntaQuizAtual.resposta_correta}</strong>
          </p>
        </div>

        <p class="text-gray-700 text-md opacity-90 animate-fadein-slow">
          Não desanima! A próxima pode te colocar no topo do ranking. 💪
        </p>

      </div>
    `;
  }
}

async function mostrarFeedbackQuiz() {
  const container = document.getElementById('participanteContainer');
  
  if (!minhaResposta) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">❌</div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Você não respondeu</h2>
        <p class="text-gray-600">Resposta correta: ${perguntaQuizAtual.resposta_correta}</p>
      </div>
    `;
    return;
  }
  
  if (minhaResposta.correta) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-[8rem] mb-4">🎉</div>
        <h2 class="text-3xl font-bold text-green-600 mb-4">VOCÊ ACERTOU!</h2>
        <div class="text-5xl font-bold text-yellow-500 mb-2">+${minhaResposta.pontos}</div>
        <p class="text-xl text-gray-600">pontos</p>
        <p class="text-gray-500 mt-4">Resposta: ${perguntaQuizAtual.resposta_correta}</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">😕</div>
        <h2 class="text-2xl font-bold text-red-600 mb-4">Você errou</h2>
        <p class="text-xl text-gray-700 mb-2">Você escolheu: <strong>${minhaResposta.resposta_escolhida}</strong></p>
        <p class="text-xl text-green-600">Resposta correta: <strong>${perguntaQuizAtual.resposta_correta}</strong></p>
      </div>
    `;
  }
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
  const container = document.getElementById('participanteContainer');
  container.innerHTML = `
    <div class="text-center py-12">
      <div class="text-6xl mb-4">❌</div>
      <p class="text-xl text-red-600">${esc(mensagem)}</p>
    </div>
  `;
}

// ============================================
// INICIAR
// ============================================

document.addEventListener('DOMContentLoaded', inicializar);
