// ============================================
// TELAO.JS - TEMA MAR DE OPORTUNIDADES
// Tela de Projeção (Read-Only)
// ============================================
let ultimoModoTelao = null;

async function renderizarModo() {
  if (sessao.modo === 'aguardando') return renderizarAguardando();
  if (sessao.modo === 'perguntas') return renderizarPerguntas();
  if (sessao.modo === 'enquetes') return renderizarEnquetes();
  if (sessao.modo === 'quiz') return renderizarQuiz();
}


const frasesMotivacionais = [
  "No mar de oportunidades, quem navega com foco fecha mais negócios.",
  "Venda é como maré: quando sobe, só surfa quem estava pronto.",
  "Quem não lança a rede, perde o peixe — e o cliente.",
  "Reme forte: a meta não se alcança ancorado.",
  "O mar está cheio de oportunidades… falta só você mergulhar.",
  "Vendedor que navega com estratégia transforma onda em faturamento.",
  "Em águas turbulentas, os melhores vendedores mostram o leme firme.",
  "Pare de esperar vento a favor. Seja o vento e acelere suas vendas.",
  "Cliente é como farol: ilumina o caminho de quem sabe ouvir.",
  "Onde muitos veem tempestade, o vendedor preparado vê terreno fértil para navegar.",
  "Meta não é miragem: é porto seguro para quem rema todos os dias.",
  "Bússola do sucesso? Persistência, técnica e follow-up.",
  "No mar das objeções, quem domina as ondas fecha com confiança.",
  "Vendedor que navega com propósito nunca fica à deriva.",
  "Oportunidade boa é como boa onda: passa… ou você surfa.",
  "Cada ligação é um mergulho; cada fechamento, uma nova costa conquistada.",
  "Seja capitão da sua performance: conduza, não deixe a maré conduzir você.",
  "Quem domina o mapa das necessidades do cliente sempre chega primeiro ao porto.",
  "Onde outros veem ressaca, o vendedor visionário vê chance de pescar grande.",
  "A maré da meta virou: hora de navegar forte e buscar o seu melhor trimestre."
];



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
    document.documentElement.style.setProperty('--cnv-primary', config.cor_primaria || '#2797ff');
    document.documentElement.style.setProperty('--cnv-secondary', config.cor_secundaria || '#0b67bc');
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
      event: '*',  // INSERT + UPDATE + DELETE
      schema: 'public',
      table: 'cnv_perguntas'
    }, async () => {
      if (sessao?.modo === 'perguntas') {
        renderizarPerguntas(); // sem fade geral, mais rápido
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

    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv_quiz_participantes'
    }, async () => {
      // Só faz sentido atualizar se o telão estiver no modo quiz
      if (sessao?.modo === 'quiz' && sessao.quiz_estado === 'cadastro_nomes') {
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

  // só anima quando o modo muda
  if (ultimoModoTelao !== sessao.modo) {
    container.classList.remove('fade-in');
    container.classList.add('fade-out');

    setTimeout(async () => {
      container.classList.remove('fade-out');
      container.classList.add('fade-in');

      ultimoModoTelao = sessao.modo;
      await renderizarModo();
    }, 160);
    
    return;
  }

  // não mudou o modo → renderiza sem animação
  await renderizarModo();
}


// ============================================
// MODO: AGUARDANDO
// ============================================

function renderizarAguardando() {
  const container = document.getElementById('telaoContainer');
  
  container.innerHTML = `
    <div class="relative flex flex-col items-center justify-center h-full breathe overflow-hidden">

      <div class="relative text-center">
        <h1 class="text-8xl font-bold mb-6 ocean-text">
          ${esc(config?.nome_evento || 'CNV 2025')}
        </h1>

        <div class="glow-tertiary text-5xl font-extrabold mb-4 animate-motivational">
          🌊 Mar de Oportunidades
        </div>

        <p id="fraseMotivacional" class="text-3xl text-gray-100 mt-6 motivational-subtitle"></p>
      </div>
    </div>
  `;

  iniciarRotacaoFrases();
}

let indiceFrase = 0;
let intervaloFrases = null;

function iniciarRotacaoFrases() {
  const elemento = document.getElementById("fraseMotivacional");
  if (!elemento) return;

  // evita múltiplos timers
  if (intervaloFrases) clearInterval(intervaloFrases);

  // define primeira frase imediatamente
  elemento.textContent = frasesMotivacionais[indiceFrase];

  intervaloFrases = setInterval(() => {
    indiceFrase = (indiceFrase + 1) % frasesMotivacionais.length;

    elemento.classList.add("fade-out");

    setTimeout(() => {
      elemento.textContent = frasesMotivacionais[indiceFrase];
      elemento.classList.remove("fade-out");
      elemento.classList.add("fade-in");

      setTimeout(() => {
        elemento.classList.remove("fade-in");
      }, 900);
    }, 900);
  }, 11000); // tempo total de troca (11s)
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
    container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-4xl ocean-text">Aguardando palestra...</p></div>';
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
        <div class="ocean-card rounded-3xl p-12 max-w-4xl w-full bubble">
          <div class="mb-6">
            <h2 class="text-3xl font-bold glow-tertiary">${esc(palestraAtual.nome)}</h2>
            <p class="text-xl text-gray-200 ocean-text">${esc(palestraAtual.palestrante)}</p>
          </div>
          <div class="mb-4">
            <p class="text-2xl text-gray-300 mb-2 ocean-text">💬 ${pergunta.nome_autor || 'Participante'} pergunta:</p>
          </div>
          <p class="text-5xl font-bold leading-relaxed ocean-text">${esc(pergunta.pergunta)}</p>
        </div>
      </div>
    `;
  } else {

    // 🔥 NOVO: buscar total de perguntas no Supabase
    const { data: listaPerguntas } = await supabase
    .from('cnv_perguntas')
    .select('id')
    .eq('palestra_id', palestraAtual.id)
    .eq('deletada', false);
  
  const totalPerguntas = listaPerguntas?.length || 0;
  
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-center">
  
      <h1 class="text-7xl font-extrabold mb-4 ocean-text glow-tertiary">
        ${esc(palestraAtual.nome)}
      </h1>
  
      <p class="text-3xl text-gray-200 opacity-80 mb-6">
        ${esc(palestraAtual.palestrante)}
      </p>
  
      <div class="w-64 h-[3px] sonar-line mb-10"></div>
  
      <div class="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl px-10 py-6 shadow-lg mb-8">
  
        ${
          sessao.perguntas_abertas
            ? `
              <p class="text-5xl font-bold text-green-300">
                Perguntas Abertas
              </p>
              <p class="text-xl text-gray-200 opacity-70 mt-4">
                Envie sua pergunta pelo celular
              </p>
            `
            : `
              <p class="text-5xl font-bold text-red-300">
                Perguntas Fechadas
              </p>
              <p class="text-xl text-gray-300 opacity-70 mt-4">
                Perguntas encerradas
              </p>
            `
        }
  
      </div>
  
      <div class="bg-white/10 backdrop-blur-lg border border-white/20 px-6 py-2 rounded-full text-gray-200 text-lg opacity-90">
        📬 ${totalPerguntas} perguntas recebidas
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
    container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-4xl ocean-text">Aguardando enquete...</p></div>';
    return;
  }
  
  const opcoes = normalizarOpcoesEnquete(enqueteAtual.opcoes);
  
  // Se deve mostrar resultado
  if (sessao.enquete_mostrar_resultado) {
    const { data: resultado } = await supabase.rpc('cnv_resultado_enquete', {
      p_enquete_id: enqueteAtual.id
    });
    
    const totalVotos = (resultado || []).reduce((sum, r) => sum + parseInt(r.total_votos), 0);
    
    container.innerHTML = `
      <div class="flex flex-col h-full justify-center">
        <h2 class="text-6xl font-bold text-center mb-12 ocean-text">${esc(enqueteAtual.nome)}</h2>
        
        <div class="space-y-6 px-12">
          ${(resultado || []).map((r, index) => {
            const percentual = r.percentual || 0;
            const cores = ['bg-blue-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-sky-500', 'bg-blue-600'];
            const corBarra = cores[index % cores.length];
            
            return `
              <div class="ocean-card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-3">
                  <p class="text-3xl font-bold ocean-text">${esc(r.texto)}</p>
                  <div class="text-right">
                    <p class="text-4xl font-bold glow-tertiary">${percentual}%</p>
                    <p class="text-xl text-gray-300">${r.total_votos} votos</p>
                  </div>
                </div>
                <div class="w-full bg-white bg-opacity-20 rounded-full h-6 overflow-hidden">
                  <div class="${corBarra} h-6 rounded-full shimmer transition-all duration-1000" style="width: ${percentual}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <p class="text-center text-3xl mt-8 text-gray-300 ocean-text">Total de votos: ${totalVotos}</p>
      </div>
    `;
  } else {
    // Votação aberta
    const statusVotacao = sessao.enquete_votacao_aberta ?
      '<span class="text-green-400">🟢 VOTAÇÃO ABERTA</span>' :
      '<span class="text-gray-400">🔴 VOTAÇÃO FECHADA</span>';
    
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-center max-w-5xl">
          <h2 class="text-7xl font-bold mb-8 ocean-text">${esc(enqueteAtual.nome)}</h2>
          
          <div class="text-6xl font-bold mb-12">${statusVotacao}</div>
          
          <div class="grid grid-cols-1 gap-4 mb-8">
            ${opcoes.map((opcao, index) => `
              <div class="ocean-card rounded-2xl p-6 bubble" style="animation-delay: ${index * 0.1}s">
                <p class="text-4xl font-bold ocean-text">${String.fromCharCode(65 + index)}) ${esc(opcao)}</p>
              </div>
            `).join('')}
          </div>
          
          ${sessao.enquete_votacao_aberta ? 
            '<p class="text-4xl glow-tertiary animate-pulse">📱 Vote pelo seu celular!</p>' : 
            '<p class="text-4xl text-gray-300 ocean-text">Aguardando resultado...</p>'
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
  if (sessao.quiz_ativo_id && (!quizAtual || quizAtual.id !== sessao.quiz_ativo_id)) {
    const { data } = await supabase
      .from('cnv_quizzes')
      .select('*')
      .eq('id', sessao.quiz_ativo_id)
      .single();
    
    quizAtual = data;
  }
  
  if (!quizAtual) {
    const container = document.getElementById('telaoContainer');
    container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-4xl ocean-text">Aguardando quiz...</p></div>';
    return;
  }
  
  const estado = sessao.quiz_estado;

  if (estado === 'cadastro_nomes') {
    await renderizarQuizCadastro();
  } else if (estado === 'aguardando_inicio') {
    await renderizarQuizAguardando();
  } else if (estado === 'countdown_3s') {
    await renderizarQuizCountdown3s();
  } else if (estado === 'jogando_pergunta') {
    await renderizarQuizPergunta();
  } else if (estado === 'tempo_esgotado') {
    renderizarQuizTempoEsgotado();
  } else if (estado === 'resposta_revelada') {
    await renderizarQuizResultado();
  } else if (estado === 'ranking') {
    await renderizarQuizRanking(sessao.metadata.quiz_ranking_fake)
  } else {
    await renderizarQuizAguardando();
  }
}

async function renderizarQuizCadastro() {
  const container = document.getElementById('telaoContainer');
  
  const { data: participantes } = await supabase
    .from('cnv_quiz_participantes')
    .select('nome')
    .eq('quiz_id', quizAtual.id)
    .order('cadastrado_em', { ascending: false });
  
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full">
      <h1 class="text-8xl font-bold mb-8 ocean-text breathe">🎮 ${esc(quizAtual.nome)}</h1>
      <p class="text-5xl glow-tertiary mb-12">Cadastro de Participantes</p>
      
      ${(participantes || []).length > 0 ? `
        <div class="grid grid-cols-4 gap-4 max-w-6xl">
          ${participantes.slice(0, 16).map(p => `
            <div class="ocean-card rounded-xl p-4 text-center bubble">
              <p class="text-2xl font-bold ocean-text">👤 ${esc(p.nome)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <p class="text-3xl mt-12 glow-tertiary animate-pulse">📱 Cadastre-se pelo seu celular!</p>
    </div>
  `;
}

function renderizarQuizAguardando() {
  const container = document.getElementById('telaoContainer');
  
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full breathe">
      <h1 class="text-7xl font-bold mb-8 ocean-text">🎮 ${esc(quizAtual.nome)}</h1>
      <p class="text-5xl glow-tertiary">O quiz vai começar!</p>
      <p class="text-3xl mt-8 text-gray-200 ocean-text">⏳ Aguardando primeira pergunta...</p>
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
          <div class="text-[20rem] font-bold leading-none glow-tertiary">${contador}</div>
          <p class="text-6xl mt-8 ocean-text">segundos</p>
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
        <h2 class="text-4xl font-bold glow-tertiary">Pergunta ${perguntaQuizAtual.ordem}</h2>
        <div id="tempoRestante" class="text-6xl font-bold mt-4 ocean-text">${tempoLimite}s</div>
      </div>
      
      <div class="flex-1 flex flex-col items-center justify-center">
        <div class="ocean-card rounded-3xl p-12 max-w-5xl w-full mb-8">
          <p class="text-5xl font-bold text-center leading-relaxed ocean-text">${esc(perguntaQuizAtual.pergunta)}</p>
        </div>
        
        <div class="grid grid-cols-2 gap-6 max-w-5xl w-full">
          <div class="ocean-card rounded-2xl p-6" style="border-left: 4px solid #3b82f6;">
            <p class="text-4xl font-bold ocean-text">A) ${esc(perguntaQuizAtual.opcao_a)}</p>
          </div>
          <div class="ocean-card rounded-2xl p-6" style="border-left: 4px solid #10b981;">
            <p class="text-4xl font-bold ocean-text">B) ${esc(perguntaQuizAtual.opcao_b)}</p>
          </div>
          <div class="ocean-card rounded-2xl p-6" style="border-left: 4px solid #06b6d4;">
            <p class="text-4xl font-bold ocean-text">C) ${esc(perguntaQuizAtual.opcao_c)}</p>
          </div>
          <div class="ocean-card rounded-2xl p-6" style="border-left: 4px solid #acc420;">
            <p class="text-4xl font-bold ocean-text">D) ${esc(perguntaQuizAtual.opcao_d)}</p>
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
        el.classList.remove('ocean-text');
        el.classList.add('text-yellow-400', 'countdown-display');
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
        <p class="text-8xl font-bold text-yellow-400">TEMPO</p>
        <p class="text-8xl font-bold text-yellow-400">ESGOTADO!</p>
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
        <div class="ocean-card rounded-3xl p-6 inline-block mb-4" style="border: 3px solid #10b981;">
          <p class="text-5xl font-bold glow-tertiary">✓ RESPOSTA CORRETA: ${correta}</p>
        </div>
        <p class="text-4xl ocean-text">${percentualAcerto}% acertaram</p>
        <p class="text-2xl text-gray-300">${totalRespostas} respostas</p>
      </div>
      
      <div class="grid grid-cols-4 gap-4 px-8">
        ${['A', 'B', 'C', 'D'].map(letra => {
          const isCorreta = letra === correta;
          const dados = distribuicao[letra] || { votos: 0, percentual: 0 };
          
          return `
            <div class="ocean-card rounded-2xl p-6 ${isCorreta ? 'ring-4 ring-yellow-400' : ''}">
              <div class="text-center mb-4">
                <p class="text-4xl font-bold ocean-text">${letra}</p>
                ${isCorreta ? '<p class="text-4xl glow-tertiary">✓</p>' : ''}
              </div>
              <p class="text-2xl font-bold text-center ocean-text">${dados.votos} votos</p>
              <div class="w-full bg-white bg-opacity-30 rounded-full h-4 mt-3 overflow-hidden">
                <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-4 rounded-full shimmer transition-all duration-1000" style="width: ${dados.percentual || 0}%"></div>
              </div>
              <p class="text-xl text-center mt-2 ocean-text">${dados.percentual || 0}%</p>
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
      <h1 class="text-8xl font-bold text-center mb-12 ocean-text breathe">🏆 RANKING</h1>
      
      <div class="space-y-4 px-12">
        ${top10.map(r => {
          const medal = r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : `${r.posicao}º`;
          const isTop3 = r.posicao <= 3;
          
          return `
            <div class="ocean-card rounded-2xl p-6 flex items-center justify-between bubble ${isTop3 ? 'ring-2 ring-yellow-400' : ''}" style="animation-delay: ${r.posicao * 0.1}s">
              <div class="flex items-center gap-6">
                <span class="text-6xl font-bold">${medal}</span>
                <span class="text-5xl font-bold ocean-text">${esc(r.nome)}</span>
              </div>
              <div class="text-right">
                <p class="text-5xl font-bold glow-tertiary shimmer">${r.pontos_totais} pts</p>
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
        <p class="text-4xl ocean-text">${esc(mensagem)}</p>
      </div>
    </div>
  `;
}

// ============================================
// INICIAR
// ============================================

document.addEventListener('DOMContentLoaded', inicializar);
