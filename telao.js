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
    const nomeAutor = pergunta.nome_autor ? esc(pergunta.nome_autor) : "Anônimo";
    const avatarEmoji = pergunta.nome_autor ? "🧑" : "🕵️";
  
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full select-none">
  
        <div class="backdrop-blur-3xl bg-white/10 border border-white/20
                    shadow-[0_12px_60px_rgba(0,0,0,0.35)]
                    rounded-3xl max-w-5xl w-full p-16 animate-[fadeZoom_0.4s_ease-out]">
  
          <!-- Header -->
          <h2 class="text-4xl font-extrabold mb-2 ocean-text">
            ${esc(palestraAtual.nome)}
          </h2>
  
          <p class="text-2xl text-gray-100 opacity-80 mb-8">
            ${esc(palestraAtual.palestrante)}
          </p>
  
          <!-- SONAR LINE -->
          <div class="w-full h-[3px] sonar-line mb-10"></div>
  
          <!-- Autor -->
          <div class="flex items-center gap-4 mb-6">
            <span class="text-4xl">${avatarEmoji}</span>
            <span class="text-2xl text-gray-200 opacity-90">
              ${nomeAutor} perguntou:
            </span>
          </div>
  
          <!-- Pergunta -->
          <div class="max-w-3xl mx-auto">
            <p class="text-5xl leading-snug text-white font-semibold drop-shadow-xl break-words">
              ${esc(pergunta.pergunta)}
            </p>
          </div>
  
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
  
  // Carregar enquete ativa
  if (sessao.enquete_ativa_id && (!enqueteAtual || enqueteAtual.id !== sessao.enquete_ativa_id)) {
    const { data } = await supabase
      .from('cnv_enquetes')
      .select('*')
      .eq('id', sessao.enquete_ativa_id)
      .single();
    
    enqueteAtual = data;
  }
  
  if (!enqueteAtual) {
    container.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <p class="text-4xl ocean-text">Aguardando enquete...</p>
      </div>
    `;
    return;
  }

  const opcoes = normalizarOpcoesEnquete(enqueteAtual.opcoes || []);

  // =====================================================================
  // MODO: MOSTRAR RESULTADO
  // =====================================================================
  if (sessao.enquete_mostrar_resultado) {
    const { data: resultado } = await supabase.rpc('cnv_resultado_enquete', {
      p_enquete_id: enqueteAtual.id
    });

    // Garantir array
    const listaResultado = Array.isArray(resultado) ? resultado : [];
  
    // Montar lista de opções preservando ORDEM ORIGINAL
    // e casando por ÍNDICE, não por texto
    const itens = opcoes.map((texto, index) => {
      const r = listaResultado[index]; // mesmo índice da opção
      const votos = r ? parseInt(r.total_votos || 0, 10) : 0;
      const percentual = r ? (r.percentual || 0) : 0;
  
      return {
        indice: index + 1,
        texto,
        votos,
        percentual
      };
    });
  
    const totalVotos = itens.reduce((sum, item) => sum + item.votos, 0);


    // Descobrir índice da vencedora (maior número de votos; em empate, primeira)
    let indiceVencedora = 0;
    for (let i = 1; i < itens.length; i++) {
      if (itens[i].votos > itens[indiceVencedora].votos) {
        indiceVencedora = i;
      }
    }

    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center select-none px-8">

        <!-- TÍTULO ENQUETE -->
        <h2 class="text-6xl font-extrabold mb-4 ocean-text glow-tertiary">
          ${esc(enqueteAtual.nome)}
        </h2>

        <!-- LINHA SONAR -->
        <div class="w-64 h-[3px] sonar-line mb-10"></div>

        <!-- GRID DE OPÇÕES (todas, na ordem, com destaque na vencedora) -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 max-w-6xl w-full mx-auto mb-10">
          ${itens.map((item, idx) => {
            const ehVencedora = totalVotos > 0 && idx === indiceVencedora;
            const classeDestaque = ehVencedora
              ? 'border-4 border-green-300/80 bg-white/15 scale-[1.02]'
              : 'border border-white/20 bg-white/8';

            return `
              <div class="backdrop-blur-2xl ${classeDestaque}
                          rounded-3xl px-8 py-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]
                          text-left transition-transform duration-300">

                ${ehVencedora ? `
                  <p class="text-lg text-green-200 mb-2">Opção mais votada</p>
                ` : `
                  <p class="text-lg text-gray-300 mb-2">Opção ${item.indice}</p>
                `}

                <p class="text-3xl text-white font-semibold mb-4 leading-snug break-words">
                  ${esc(item.texto)}
                </p>

                <div class="flex items-baseline justify-between">
                  <p class="text-2xl text-gray-200">
                    ${item.votos} voto${item.votos === 1 ? '' : 's'}
                  </p>
                  <p class="text-4xl font-extrabold text-green-300">
                    ${item.percentual}%
                  </p>
                </div>

              </div>
            `;
          }).join('')}
        </div>

        <p class="text-2xl text-gray-200 opacity-80 mt-2">
          Total de votos: ${totalVotos}
        </p>

      </div>
    `;
    return;
  }

  // =====================================================================
  // MODO: VOTAÇÃO ABERTA / FECHADA (SEM OPÇÕES)
  // =====================================================================

  // Buscar total de votos para o badge
  const { data: resultadoContagem } = await supabase.rpc('cnv_resultado_enquete', {
    p_enquete_id: enqueteAtual.id
  });

  const totalVotosContagem = (resultadoContagem || []).reduce(
    (sum, r) => sum + parseInt(r.total_votos || 0, 10),
    0
  );

  const votacaoAberta = !!sessao.enquete_votacao_aberta;

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-center select-none px-8">

      <!-- TÍTULO ENQUETE -->
      <h2 class="text-6xl font-extrabold mb-4 ocean-text glow-tertiary">
        ${esc(enqueteAtual.nome)}
      </h2>

      <!-- LINHA SONAR -->
      <div class="w-64 h-[3px] sonar-line mb-10"></div>

      <!-- CARD PRINCIPAL -->
      <div class="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl px-12 py-10 shadow-lg max-w-4xl w-full mb-8">

        <p class="text-4xl mb-4 text-gray-100 flex items-center justify-center gap-3">
          <span>📊</span>
          <span class="font-extrabold">
            Enquete ${votacaoAberta ? 'Aberta' : 'Fechada'}
          </span>
        </p>

        ${
          votacaoAberta
            ? `
              <p class="text-2xl text-gray-200 opacity-80">
                Vote pelo seu celular
              </p>
            `
            : `
              <p class="text-2xl text-gray-300 opacity-80">
                Votação encerrada
              </p>
            `
        }

      </div>

      <!-- BADGE DISCRETO DE VOTOS -->
      <div class="bg-white/10 backdrop-blur-lg border border-white/20 px-6 py-2 rounded-full text-gray-200 text-lg opacity-90">
        🗳️ ${totalVotosContagem} voto${totalVotosContagem === 1 ? '' : 's'} recebido${totalVotosContagem === 1 ? '' : 's'}
      </div>

    </div>
  `;
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

  // Tempo limite da pergunta (fallback 30s se vier vazio)
  const tempoLimite = perguntaQuizAtual.tempo_limite_seg || quizAtual?.tempo_limite_seg || 30;

  const nomeQuiz = quizAtual?.nome || 'Quiz';

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full select-none px-8">

      <!-- TÍTULO QUIZ + PERGUNTA -->
      <div class="text-center mb-10">
        <h2 class="text-5xl font-extrabold ocean-text mb-2">
          ${esc(nomeQuiz)}
        </h2>
        <p class="text-3xl text-gray-200 opacity-80">
          Pergunta ${perguntaQuizAtual.ordem}
        </p>

        <!-- TIMER -->
        <div id="tempoRestante" class="mt-6 inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/10 border border-white/20 text-3xl font-bold ocean-text">
          ⏱️ <span>${tempoLimite}s</span>
        </div>

        <!-- LINHA SONAR -->
        <div class="w-64 h-[3px] sonar-line mt-8 mx-auto"></div>
      </div>

      <!-- PERGUNTA -->
      <div class="backdrop-blur-3xl bg-white/10 border border-white/20 rounded-3xl shadow-[0_12px_60px_rgba(0,0,0,0.35)]
                  max-w-5xl w-full px-10 py-10 mb-10">
        <p class="text-5xl font-semibold text-white leading-snug text-center break-words">
          ${esc(perguntaQuizAtual.pergunta)}
        </p>
      </div>

      <!-- OPÇÕES -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full">
        ${[
          { letra: 'A', texto: perguntaQuizAtual.opcao_a, cor: '#3b82f6' },
          { letra: 'B', texto: perguntaQuizAtual.opcao_b, cor: '#10b981' },
          { letra: 'C', texto: perguntaQuizAtual.opcao_c, cor: '#06b6d4' },
          { letra: 'D', texto: perguntaQuizAtual.opcao_d, cor: '#acc420' },
        ].map(op => `
          <div class="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl px-6 py-5 shadow-lg flex gap-4 items-start">
            <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                 style="background:${op.cor};">
              ${op.letra}
            </div>
            <p class="text-3xl text-white leading-snug break-words">
              ${esc(op.texto || '')}
            </p>
          </div>
        `).join('')}
      </div>

    </div>
  `;

  // TIMER REGRESSIVO
  let tempo = tempoLimite;
  const inicioLocal = Date.now();
  
  const intervalo = setInterval(() => {
    tempo = tempoLimite - Math.floor((Date.now() - inicioLocal) / 1000);
  
    const el = document.getElementById("tempoRestante");
    if (el) {
      const span = el.querySelector("span");
      if (span) span.textContent = `${tempo}s`;
    }
  
    if (tempo <= 0) clearInterval(intervalo);
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
  
  // Buscar estatísticas agregadas da pergunta
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
  const nomeQuiz = quizAtual?.nome || 'Quiz';

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full select-none px-8">

      <!-- TÍTULO -->
      <div class="text-center mb-10">
        <h2 class="text-5xl font-extrabold ocean-text mb-2">
          ${esc(nomeQuiz)}
        </h2>
        <p class="text-3xl text-gray-200 opacity-80 mb-4">
          Resultado da Pergunta ${perguntaQuizAtual.ordem}
        </p>
        <div class="w-64 h-[3px] sonar-line mx-auto"></div>
      </div>

      <!-- BLOCO RESPOSTA CORRETA -->
      <div class="backdrop-blur-3xl bg-white/10 border-4 border-green-300/80 rounded-3xl shadow-[0_12px_60px_rgba(0,0,0,0.35)]
                  max-w-5xl w-full px-10 py-8 mb-10 animate-[fadeZoom_0.4s_ease-out]">

        <p class="text-2xl text-green-200 mb-3">
          Resposta correta
        </p>

        <p class="text-4xl font-extrabold text-white mb-4 leading-snug break-words">
          ${correta}) ${esc(opcoes[correta] || '')}
        </p>

        <div class="flex items-baseline justify-center gap-6">
          <p class="text-6xl font-extrabold text-green-300">
            ${percentualAcerto}%
          </p>
          <p class="text-2xl text-gray-200">
            acertaram
          </p>
        </div>

        <p class="text-2xl text-gray-300 mt-3">
          ${totalRespostas} resposta${totalRespostas === 1 ? '' : 's'}
        </p>
      </div>

      <!-- DISTRIBUIÇÃO DAS RESPOSTAS -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl w-full mb-6">
        ${['A', 'B', 'C', 'D'].map(letra => {
          const isCorreta = letra === correta;
          const dados = distribuicao[letra] || { votos: 0, percentual: 0 };
          
          return `
            <div class="backdrop-blur-xl bg-white/10 border ${isCorreta ? 'border-green-300/80' : 'border-white/20'}
                        rounded-2xl px-6 py-5 shadow-lg text-center">

              <p class="text-3xl font-extrabold text-white mb-1">
                ${letra}
              </p>
              ${isCorreta ? '<p class="text-xl text-green-300 mb-1">Correta</p>' : ''}

              <p class="text-2xl text-gray-100 mb-2">
                ${dados.votos} voto${dados.votos === 1 ? '' : 's'}
              </p>

              <div class="w-full bg-white/20 rounded-full h-4 overflow-hidden mb-2">
                <div class="h-4 rounded-full"
                     style="width: ${dados.percentual || 0}%; background: linear-gradient(90deg, #22c55e, #4ade80);"></div>
              </div>

              <p class="text-xl text-gray-100">
                ${dados.percentual || 0}%
              </p>
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
  const nomeQuiz = quizAtual?.nome || 'Quiz';

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full select-none px-8">

      <!-- TÍTULO -->
      <div class="text-center mb-10">
        <h1 class="text-6xl font-extrabold ocean-text mb-2">
          🏆 Ranking do Quiz
        </h1>
        <p class="text-3xl text-gray-200 opacity-80">
          ${esc(nomeQuiz)}
        </p>
        <div class="w-64 h-[3px] sonar-line mx-auto mt-6"></div>
      </div>

      <!-- LISTA TOP 10 -->
      <div class="max-w-5xl w-full space-y-4">
        ${top10.map(r => {
          const medal = r.posicao === 1 ? '🥇'
                       : r.posicao === 2 ? '🥈'
                       : r.posicao === 3 ? '🥉'
                       : `${r.posicao}º`;

          const destaqueClasse = r.posicao <= 3
            ? 'bg-white/15 border-yellow-300/70'
            : 'bg-white/8 border-white/20';

          return `
            <div class="backdrop-blur-2xl ${destaqueClasse} rounded-3xl px-8 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]
                        flex items-center justify-between">

              <div class="flex items-center gap-6">
                <span class="text-5xl">
                  ${medal}
                </span>
                <span class="text-3xl md:text-4xl font-semibold text-white break-words">
                  ${esc(r.nome || '')}
                </span>
              </div>

              <div class="text-right">
                <p class="text-4xl font-extrabold text-green-300">
                  ${r.pontos_totais} pts
                </p>
                <p class="text-xl text-gray-200">
                  ${r.total_acertos} acerto${r.total_acertos === 1 ? '' : 's'}
                </p>
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
