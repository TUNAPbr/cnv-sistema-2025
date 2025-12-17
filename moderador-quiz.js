// ============================================
// QUIZ: SELEÇÃO E CARREGAMENTO
// ============================================

function selecionarQuiz() {
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">Selecionar Quiz</h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${quizzes.filter(q => !q.deletado).map(q => `
            <button onclick="ativarQuiz('${q.id}')" 
              class="w-full p-3 text-left border rounded hover:bg-blue-50 transition">
              <p class="font-bold">${esc(q.nome)}</p>
              <p class="text-sm text-gray-600">${q.total_perguntas} perguntas • Status: ${q.status}</p>
            </button>
          `).join('')}
        </div>
        <button onclick="fecharModal()" class="mt-4 w-full px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
          Cancelar
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function ativarQuiz(quizId) {
  try {
    const { error } = await supabaseModerador
      .from('cnv_sessao')
      .update({
        quiz_ativo_id: quizId,
        quiz_estado: 'aguardando_inicio',
        quiz_pergunta_atual_id: null,
        quiz_mostrar_ranking: false
      })
      .eq('id', 1);
    
    if (error) throw error;
    
    fecharModal();
    alert('✅ Quiz selecionado!');
    
  } catch (error) {
    console.error('Erro ao ativar quiz:', error);
    alert('❌ Erro ao selecionar quiz');
  }
}

async function carregarQuizAtivo() {
  if (!sessaoAtual?.quiz_ativo_id) return;
  
  // Carregar dados do quiz
  const { data: quiz, error: errQuiz } = await supabaseModerador
    .from('cnv_quizzes')
    .select('*')
    .eq('id', sessaoAtual.quiz_ativo_id)
    .single();
  
  if (errQuiz) {
    console.error('Erro ao carregar quiz:', errQuiz);
    return;
  }
  
  quizAtual = quiz;
  
  // Carregar perguntas
  const { data: perguntas, error: errPerg } = await supabaseModerador
    .from('cnv_quiz_perguntas')
    .select('*')
    .eq('quiz_id', quiz.id)
    .order('ordem');
  
  if (errPerg) {
    console.error('Erro ao carregar perguntas:', errPerg);
    return;
  }
  
  perguntasQuiz = perguntas || [];
  
  // Atualizar UI
  renderizarControleQuiz();
}

function renderizarControleQuiz() {
  const container = document.getElementById('controleStatusQuiz');
  const listaPergDiv = document.getElementById('controleListaPerguntas');
  const rankingDiv = document.getElementById('controleRankingQuiz');
  
  if (!quizAtual) return;
  
  container.innerHTML = `
    <div class="p-4 bg-blue-50 border border-blue-200 rounded">
      <h4 class="font-bold text-lg mb-2">${esc(quizAtual.nome)}</h4>
      <p class="text-sm text-gray-700 mb-3">
        ${perguntasQuiz.length} perguntas • Status: ${quizAtual.status} • 
        Estado: ${sessaoAtual.quiz_estado || 'aguardando'}
      </p>
      <div class="flex gap-2 flex-wrap">
        ${quizAtual.status === 'preparando' ? `
          <button onclick="iniciarCadastroNomes()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            📝 Iniciar Cadastro de Nomes
          </button>
        ` : ''}
        
        ${sessaoAtual.quiz_estado === 'cadastro_nomes' ? `
          <button onclick="fecharCadastroIniciarQuiz()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            🎮 Fechar Cadastro e Iniciar Quiz
          </button>
        ` : ''}
        
        ${quizAtual.status === 'em_andamento' ? `
          <button onclick="finalizarQuiz()" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
            🏁 Finalizar Quiz
          </button>
        ` : ''}
        
        ${quizAtual.status !== 'preparando' ? `
          <button onclick="reiniciarQuiz()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            🔄 Reiniciar Quiz
          </button>
        ` : ''}
        
        <button onclick="toggleRankingTelao()" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          ${sessaoAtual.quiz_mostrar_ranking ? '🙈 Ocultar' : '📊 Mostrar'} Ranking
        </button>

        <button onclick="toggleRankingFake()" 
          class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700">
          🎭 Ranking Fake
        </button>
        
        <button onclick="dispararRankingIndividual()" 
          class="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">
          👤 Ranking Individual
        </button>
        
        <button onclick="abrirModalGerenciarQuiz(quizAtual)" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          ⚙️ Gerenciar Perguntas
        </button>
        
        <button onclick="selecionarQuiz()" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
          🔄 Trocar Quiz
        </button>
      </div>
    </div>
  `;
  
  // Lista de perguntas
  renderizarListaPerguntasQuiz();

  // Participantes
  carregarParticipantesQuiz();
  
  // Ranking
  carregarRankingQuiz();
}

async function carregarParticipantesQuiz() {
  const participantesDiv = document.getElementById('controleParticipantesQuiz');
  if (!participantesDiv || !quizAtual) return;

  const { data, error } = await supabaseModerador
    .from('cnv_quiz_participantes')
    .select('*')
    .eq('quiz_id', quizAtual.id)
    .order('cadastrado_em', { ascending: true });

  if (error) {
    console.error('Erro ao carregar participantes do quiz:', error);
    participantesDiv.innerHTML = `
      <div class="p-3 border rounded bg-white">
        <p class="text-sm text-red-600">Erro ao carregar participantes.</p>
      </div>
    `;
    return;
  }

  participantesQuiz = data || [];

  if (participantesQuiz.length === 0) {
    participantesDiv.innerHTML = `
      <div class="p-3 border rounded bg-white">
        <p class="text-sm text-gray-500">Nenhum participante cadastrado ainda.</p>
      </div>
    `;
    return;
  }

  participantesDiv.innerHTML = `
    <div class="p-3 border rounded bg-white">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-semibold text-sm">Participantes (${participantesQuiz.length})</h4>
        <span class="text-xs text-gray-500">Atualiza em tempo real</span>
      </div>
      <div class="flex flex-wrap gap-2">
        ${participantesQuiz.map(p => `
          <span class="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
            ${esc(p.nome || 'Sem nome')}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function renderizarListaPerguntasQuiz() {
  const listaPergDiv = document.getElementById('controleListaPerguntas');
  
  if (perguntasQuiz.length === 0) {
    listaPergDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma pergunta cadastrada. Clique em "Gerenciar Perguntas".</p>';
    return;
  }
  
  listaPergDiv.innerHTML = `
    <h4 class="font-bold mb-2">Perguntas do Quiz</h4>
    <div class="space-y-2">
      ${perguntasQuiz.map((p, idx) => `
        <div class="p-3 border rounded ${p.jogada ? 'bg-gray-100' : ''} ${p.revelada ? 'bg-green-50' : ''}">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1">
              <p class="font-medium">${idx + 1}. ${esc(p.pergunta)}</p>
              <p class="text-xs text-gray-500 mt-1">
                Resposta: ${p.resposta_correta} • Tempo: ${p.tempo_limite_seg}s
                ${p.jogada ? ' • ✅ Jogada' : ''}
                ${p.revelada ? ' • 👁️ Revelada' : ''}
              </p>
            </div>
            <div class="flex gap-1">
              ${!p.jogada && quizAtual.status !== 'finalizado' ? `
                <button onclick="jogarPergunta('${p.id}')" 
                  class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                  ▶️ Jogar
                </button>
              ` : ''}
              ${p.jogada && !p.revelada ? `
                <button onclick="revelarResposta('${p.id}')" 
                  class="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
                  👁️ Revelar
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// QUIZ: FLUXO DE CONTROLE
// ============================================

async function iniciarCadastroNomes() {
  if (!confirm('Iniciar cadastro de nomes dos participantes?')) return;
  
  try {
    // Atualizar quiz
    const { error: errQuiz } = await supabaseModerador
      .from('cnv_quizzes')
      .update({ status: 'em_andamento', iniciado_em: new Date().toISOString() })
      .eq('id', quizAtual.id);
    
    if (errQuiz) throw errQuiz;
    
    // Atualizar sessão
    const { error: errSessao } = await supabaseModerador
      .from('cnv_sessao')
      .update({ quiz_estado: 'cadastro_nomes' })
      .eq('id', 1);
    
    if (errSessao) throw errSessao;
    
    alert('✅ Cadastro de nomes aberto! Participantes podem se cadastrar agora.');
    
  } catch (error) {
    console.error('Erro ao iniciar cadastro:', error);
    alert('❌ Erro ao iniciar cadastro');
  }
}

async function fecharCadastroIniciarQuiz() {
  if (!confirm('Fechar cadastro e iniciar quiz? Quem não cadastrou NÃO poderá participar.')) return;
  
  try {
    const { error } = await supabaseModerador
      .from('cnv_sessao')
      .update({ quiz_estado: 'aguardando_inicio' })
      .eq('id', 1);
    
    if (error) throw error;
    
    alert('✅ Cadastro fechado! Agora selecione uma pergunta e clique em "Jogar".');
    
  } catch (error) {
    console.error('Erro ao fechar cadastro:', error);
    alert('❌ Erro ao fechar cadastro');
  }
}

async function jogarPergunta(perguntaId) {
  const pergunta = perguntasQuiz.find(p => p.id === perguntaId);
  if (!pergunta) return;
  
  if (!confirm(`Jogar pergunta "${pergunta.pergunta}"?`)) return;
  
  try {
    // Marcar como jogada
    const { error: errPerg } = await supabaseModerador
      .from('cnv_quiz_perguntas')
      .update({ jogada: true })
      .eq('id', perguntaId);
    
    if (errPerg) throw errPerg;
    
    // Atualizar sessão para countdown 3s
    const { error: errSessao } = await supabaseModerador
      .from('cnv_sessao')
      .update({
        quiz_estado: 'countdown_3s',
        quiz_pergunta_atual_id: perguntaId,
        metadata: { countdown_inicio: new Date().toISOString() }
      })
      .eq('id', 1);
    
    if (errSessao) throw errSessao;
    
    // Após 3 segundos, mudar para jogando_pergunta
    setTimeout(async () => {
      const { error } = await supabaseModerador
        .from('cnv_sessao')
        .update({
          quiz_estado: 'jogando_pergunta',
          metadata: { pergunta_inicio: new Date().toISOString() }
        })
        .eq('id', 1);
      
      if (error) console.error('Erro ao iniciar pergunta:', error);
    }, 3000);
    
    // Após tempo_limite, mudar para tempo_esgotado
    setTimeout(async () => {
      const { error } = await supabaseModerador
        .from('cnv_sessao')
        .update({ quiz_estado: 'tempo_esgotado' })
        .eq('id', 1);
      
      if (error) console.error('Erro ao esgotar tempo:', error);
    }, 3000 + (pergunta.tempo_limite_seg * 1000));
    
    alert('✅ Pergunta iniciada! Countdown de 3s...');
    
  } catch (error) {
    console.error('Erro ao jogar pergunta:', error);
    alert('❌ Erro ao jogar pergunta');
  }
}

async function revelarResposta(perguntaId) {
  if (!confirm('Revelar resposta correta?')) return;
  
  try {
    // Marca pergunta como revelada
    const { error: errPerg } = await supabaseModerador
      .from('cnv_quiz_perguntas')
      .update({ revelada: true })
      .eq('id', perguntaId);
    
    if (errPerg) throw errPerg;

    // 🔥 BUSCAR ESTATÍSTICAS COMPLETAS DA PERGUNTA (RPC NOVO)
    const { data: stats, error: errStats } = await supabaseModerador.rpc(
      'cnv_stats_pergunta_quiz',
      { p_pergunta_id: perguntaId }
    );

    // Verificação real - o Supabase RPC retorna diretamente no data, não em um objeto aninhado
    if (errStats || !stats) {
        console.error("Erro RPC:", errStats, stats);
        throw new Error("Falha ao buscar estatísticas da pergunta.");
    }

    console.log("📊 Estatísticas carregadas:", stats);

    // 🔥 GUARDAR ESTATÍSTICA NA SESSÃO PARA O TELÃO/APP
    const { error: errSessao } = await supabaseModerador
      .from('cnv_sessao')
      .update({
        quiz_estado: 'resposta_revelada',
        metadata: {
            quiz_stats: stats    // 🚀 stats JÁ contém os dados corretos!
        }
      })
      .eq('id', 1);

    if (errSessao) throw errSessao;

    alert('✅ Resposta revelada!');
    
    // Atualiza ranking do quiz geral
    await carregarRankingQuiz();

  } catch (error) {
    console.error('Erro ao revelar resposta:', error);
    alert('❌ Erro ao revelar resposta');
  }
}


async function finalizarQuiz() {
  if (!confirm('Finalizar quiz? Não será possível jogar mais perguntas.')) return;
  
  try {
    const { error } = await supabaseModerador
      .from('cnv_quizzes')
      .update({
        status: 'finalizado',
        finalizado_em: new Date().toISOString()
      })
      .eq('id', quizAtual.id);
    
    if (error) throw error;
    
    alert('✅ Quiz finalizado!');
    await carregarQuizAtivo();
    
  } catch (error) {
    console.error('Erro ao finalizar quiz:', error);
    alert('❌ Erro ao finalizar quiz');
  }
}

async function reiniciarQuiz() {
  if (!confirm('REINICIAR quiz? Isso vai APAGAR todas as respostas e resetar o quiz!')) return;
  
  try {
    const pergIds = perguntasQuiz.map(p => p.id);
    
    // Apagar respostas
    if (pergIds.length > 0) {
      const { error: errResp } = await supabaseModerador
        .from('cnv_quiz_respostas')
        .delete()
        .in('quiz_pergunta_id', pergIds);
      
      if (errResp) throw errResp;
    }
    
    // Apagar participantes
    const { error: errPart } = await supabaseModerador
      .from('cnv_quiz_participantes')
      .delete()
      .eq('quiz_id', quizAtual.id);
    
    if (errPart) throw errPart;
    
    // Resetar perguntas
    const { error: errPerg } = await supabaseModerador
      .from('cnv_quiz_perguntas')
      .update({ jogada: false, revelada: false })
      .eq('quiz_id', quizAtual.id);
    
    if (errPerg) throw errPerg;
    
    // Resetar quiz
    const { error: errQuiz } = await supabaseModerador
      .from('cnv_quizzes')
      .update({
        status: 'preparando',
        iniciado_em: null,
        finalizado_em: null
      })
      .eq('id', quizAtual.id);
    
    if (errQuiz) throw errQuiz;
    
    // Resetar sessão
    const { error: errSessao } = await supabaseModerador
      .from('cnv_sessao')
      .update({
        quiz_estado: 'aguardando_inicio',
        quiz_pergunta_atual_id: null,
        quiz_mostrar_ranking: false
      })
      .eq('id', 1);
    
    if (errSessao) throw errSessao;
    
    alert('✅ Quiz reiniciado com sucesso!');
    await carregarQuizAtivo();
    
  } catch (error) {
    console.error('Erro ao reiniciar quiz:', error);
    alert('❌ Erro ao reiniciar quiz');
  }
}

async function toggleRankingTelao() {
  try {
    const novoValor = !sessaoAtual.quiz_mostrar_ranking;
    
    const { error } = await supabaseModerador
      .from('cnv_sessao')
      .update({
        quiz_estado: novoValor ? 'ranking' : 'aguardando_inicio',
        quiz_mostrar_ranking: novoValor
      })
      .eq('id', 1);
    
    if (error) throw error;
    
    alert(novoValor ? '✅ Ranking exibido no telão!' : '✅ Ranking ocultado!');
    
  } catch (error) {
    console.error('Erro ao toggle ranking:', error);
    alert('❌ Erro ao alterar exibição');
  }
}

async function carregarRankingQuiz() {
  const rankingDiv = document.getElementById('controleRankingQuiz');
  
  if (!quizAtual) {
    rankingDiv.innerHTML = '';
    return;
  }
  
  const { data, error } = await supabaseModerador.rpc('cnv_ranking_quiz', {
    p_quiz_id: quizAtual.id
  });
  
  if (error) {
    console.error('Erro ao carregar ranking:', error);
    return;
  }
  
  rankingQuiz = data || [];
  
  if (rankingQuiz.length === 0) {
    rankingDiv.innerHTML = '<p class="text-gray-500 text-center py-4 mt-4">Nenhum participante ainda</p>';
    return;
  }
  
  rankingDiv.innerHTML = `
    <div class="mt-4 p-4 border rounded">
      <h4 class="font-bold mb-3">🏆 Ranking (Top 10)</h4>
      <div class="space-y-2">
        ${rankingQuiz.slice(0, 10).map(r => {
          const medal = r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : `${r.posicao}º`;
          return `
            <div class="flex items-center justify-between p-2 rounded ${r.posicao <= 3 ? 'bg-yellow-50' : ''}">
              <div class="flex items-center gap-3">
                <span class="text-xl font-bold">${medal}</span>
                <div>
                  <p class="font-medium">${esc(r.nome)}</p>
                  <p class="text-xs text-gray-600">${r.total_acertos} acertos</p>
                </div>
              </div>
              <p class="text-lg font-bold text-green-600">${r.pontos_totais} pts</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function toggleRankingFake() {
  const novoValor = !sessaoAtual.quiz_mostrar_ranking_fake;

  const { error } = await supabaseModerador
    .from('cnv_sessao')
    .update({
      quiz_mostrar_ranking_fake: novoValor,
      quiz_estado: novoValor ? 'ranking_fake' : 'aguardando_inicio'
    })
    .eq('id', 1);

  if (error) console.error(error);
}

async function dispararRankingIndividual() {
  await supabaseModerador
    .from('cnv_sessao')
    .update({
      metadata: { refresh_token: crypto.randomUUID() }
    })
    .eq('id', 1);

  // O participante escuta refresh_token → e troca pra tela de ranking pessoal
}

// ============================================
// QUIZ: GERENCIAR nome quiz
// ============================================

function abrirModalEditarQuiz(quiz) {
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">

        <h3 class="text-xl font-bold mb-4">Editar Quiz</h3>

        <form onsubmit="salvarEdicaoQuiz(event, '${quiz.id}')">
          <div class="space-y-4">

            <div>
              <label class="block text-sm font-bold mb-1">Título do Quiz *</label>
              <input
                type="text"
                id="quizTituloEditar"
                value="${esc(quiz.nome)}"
                required
                class="w-full p-2 border rounded"
              >
            </div>

            <div>
              <label class="block text-sm font-bold mb-1">Status *</label>
              <select id="quizStatusEditar" class="w-full p-2 border rounded">
                <option value="preparando" ${quiz.status === 'preparando' ? 'selected' : ''}>Preparando</option>
                <option value="ativo" ${quiz.status === 'ativo' ? 'selected' : ''}>Ativo</option>
                <option value="finalizado" ${quiz.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
              </select>
            </div>

          </div>

          <div class="flex gap-2 mt-6">
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              💾 Salvar
            </button>
            <button type="button" onclick="fecharModal()" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
              Cancelar
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modal;
}

async function salvarEdicaoQuiz(event, id) {
  event.preventDefault();

  const nome = document.getElementById('quizTituloEditar').value.trim();
  const status = document.getElementById('quizStatusEditar').value;

  const { error } = await supabaseModerador
    .from('cnv_quizzes')
    .update({ nome, status })
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('❌ Erro ao salvar edição do quiz.');
    return;
  }

  alert('✅ Quiz atualizado com sucesso!');
  fecharModal();
  carregarQuizzes(); // Atualiza a lista
}


// ============================================
// QUIZ: GERENCIAR PERGUNTAS
// ============================================

async function abrirModalGerenciarQuiz(quiz) {
  try {
    // Garante que o quizAtual está definido (funciona tanto vindo da aba Cadastros quanto da aba Controle)
    quizAtual = quiz;

    // Carrega as perguntas desse quiz independentemente da sessão
    const { data: perguntas, error } = await supabaseModerador
      .from('cnv_quiz_perguntas')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('ordem');

    if (error) {
      console.error('Erro ao carregar perguntas do quiz:', error);
      alert('❌ Erro ao carregar perguntas do quiz');
      return;
    }

    perguntasQuiz = perguntas || [];

    const modal = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
        <div class="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
          <h3 class="text-xl font-bold mb-4">Gerenciar Perguntas: ${esc(quiz.nome)}</h3>
          
          <div class="mb-4">
            <button onclick="abrirModalNovaPerguntaQuiz()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              ➕ Nova Pergunta
            </button>
          </div>
          
          <div id="listaPerguntasModal" class="space-y-2"></div>
          
          <button onclick="fecharModal()" class="mt-4 w-full px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
            Fechar
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modal;
    renderizarListaPerguntasModal();
  } catch (err) {
    console.error('Erro ao abrir modal de gerenciamento do quiz:', err);
    alert('❌ Erro ao abrir gerenciamento de perguntas');
  }
}

function renderizarListaPerguntasModal() {
  const lista = document.getElementById('listaPerguntasModal');
  
  if (perguntasQuiz.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma pergunta. Clique em "Nova Pergunta".</p>';
    return;
  }
  
  lista.innerHTML = perguntasQuiz.map((p, idx) => `
    <div class="p-3 border rounded">
      <div class="flex justify-between items-start gap-2">
        <div class="flex-1">
          <p class="font-bold">Pergunta ${idx + 1}</p>
          <p class="text-sm">${esc(p.pergunta)}</p>
          <p class="text-xs text-gray-600 mt-1">
            A) ${esc(p.opcao_a)} | B) ${esc(p.opcao_b)} | 
            C) ${esc(p.opcao_c)} | D) ${esc(p.opcao_d)}
          </p>
          <p class="text-xs text-green-600 font-bold mt-1">
            Correta: ${p.resposta_correta} • Tempo: ${p.tempo_limite_seg}s
          </p>
        </div>
        <div class="flex gap-1">
          <button onclick="editarPerguntaQuiz('${p.id}')" class="px-2 py-1 text-xs bg-blue-500 text-white rounded">✏️</button>
          <button onclick="deletarPerguntaQuiz('${p.id}')" class="px-2 py-1 text-xs bg-red-500 text-white rounded">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

function abrirModalNovaPerguntaQuiz() {
  const ordem = perguntasQuiz.length + 1;
  
  const modalPergunta = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModalPergunta(event)">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">Nova Pergunta (${ordem})</h3>
        <form onsubmit="salvarPerguntaQuiz(event)">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-bold mb-1">Pergunta *</label>
              <textarea id="quizPergunta" rows="2" required class="w-full p-2 border rounded"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-bold mb-1">Opção A *</label>
                <input type="text" id="quizOpcaoA" required class="w-full p-2 border rounded">
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Opção B *</label>
                <input type="text" id="quizOpcaoB" required class="w-full p-2 border rounded">
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Opção C *</label>
                <input type="text" id="quizOpcaoC" required class="w-full p-2 border rounded">
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Opção D *</label>
                <input type="text" id="quizOpcaoD" required class="w-full p-2 border rounded">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-bold mb-1">Resposta Correta *</label>
                <select id="quizRespostaCorreta" required class="w-full p-2 border rounded">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Tempo Limite (segundos) *</label>
                <input type="number" id="quizTempoLimite" value="30" min="10" max="120" required class="w-full p-2 border rounded">
              </div>
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">💾 Salvar</button>
            <button type="button" onclick="fecharModalPergunta()" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  const container = document.getElementById('modalContainer');
  container.innerHTML += modalPergunta;
}

async function salvarPerguntaQuiz(event, id = null) {
  event.preventDefault();
  
  const dados = {
    quiz_id: quizAtual.id,
    ordem: id ? undefined : perguntasQuiz.length + 1,
    pergunta: document.getElementById('quizPergunta').value.trim(),
    opcao_a: document.getElementById('quizOpcaoA').value.trim(),
    opcao_b: document.getElementById('quizOpcaoB').value.trim(),
    opcao_c: document.getElementById('quizOpcaoC').value.trim(),
    opcao_d: document.getElementById('quizOpcaoD').value.trim(),
    resposta_correta: document.getElementById('quizRespostaCorreta').value,
    tempo_limite_seg: parseInt(document.getElementById('quizTempoLimite').value)
  };
  
  try {
    if (id) {
      // Editar
      delete dados.quiz_id;
      delete dados.ordem;
      
      const { error } = await supabaseModerador
        .from('cnv_quiz_perguntas')
        .update(dados)
        .eq('id', id);
      
      if (error) throw error;
      alert('✅ Pergunta atualizada!');
    } else {
      // Criar
      const { error } = await supabaseModerador
        .from('cnv_quiz_perguntas')
        .insert(dados);
      
      if (error) throw error;
      
      // Atualizar total de perguntas
      await supabaseModerador
        .from('cnv_quizzes')
        .update({ total_perguntas: perguntasQuiz.length + 1 })
        .eq('id', quizAtual.id);
      
      alert('✅ Pergunta criada!');
    }
    
    fecharModalPergunta();
    await carregarQuizAtivo();
    abrirModalGerenciarQuiz(quizAtual);
    
  } catch (error) {
    console.error('Erro ao salvar pergunta:', error);
    alert('❌ Erro ao salvar pergunta');
  }
}

function editarPerguntaQuiz(id) {
  const pergunta = perguntasQuiz.find(p => p.id === id);
  if (!pergunta) return;

  const modalPergunta = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModalPergunta(event)">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">Editar Pergunta ${pergunta.ordem}</h3>
        <form onsubmit="salvarPerguntaQuiz(event, '${id}')">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-bold mb-1">Pergunta *</label>
              <textarea id="quizPergunta" rows="2" required class="w-full p-2 border rounded">${esc(pergunta.pergunta)}</textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-bold mb-1">Opção A *</label>
                <input
                  type="text"
                  id="quizOpcaoA"
                  value="${esc(pergunta.opcao_a)}"
                  required
                  class="w-full p-2 border rounded"
                >
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Opção B *</label>
                <input
                  type="text"
                  id="quizOpcaoB"
                  value="${esc(pergunta.opcao_b)}"
                  required
                  class="w-full p-2 border rounded"
                >
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Opção C *</label>
                <input
                  type="text"
                  id="quizOpcaoC"
                  value="${esc(pergunta.opcao_c)}"
                  required
                  class="w-full p-2 border rounded"
                >
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Opção D *</label>
                <input
                  type="text"
                  id="quizOpcaoD"
                  value="${esc(pergunta.opcao_d)}"
                  required
                  class="w-full p-2 border rounded"
                >
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-bold mb-1">Resposta Correta *</label>
                <select id="quizRespostaCorreta" required class="w-full p-2 border rounded">
                  <option value="A" ${pergunta.resposta_correta === 'A' ? 'selected' : ''}>A</option>
                  <option value="B" ${pergunta.resposta_correta === 'B' ? 'selected' : ''}>B</option>
                  <option value="C" ${pergunta.resposta_correta === 'C' ? 'selected' : ''}>C</option>
                  <option value="D" ${pergunta.resposta_correta === 'D' ? 'selected' : ''}>D</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold mb-1">Tempo Limite (segundos) *</label>
                <input
                  type="number"
                  id="quizTempoLimite"
                  value="${pergunta.tempo_limite_seg}"
                  min="10"
                  max="120"
                  required
                  class="w-full p-2 border rounded"
                >
              </div>
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button
              type="submit"
              class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              💾 Salvar
            </button>
            <button
              type="button"
              onclick="fecharModalPergunta()"
              class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const container = document.getElementById('modalContainer');
  container.innerHTML = modalPergunta;
}

async function deletarPerguntaQuiz(id) {
  if (!confirm('Excluir esta pergunta?')) return;
  
  try {
    const { error } = await supabaseModerador
      .from('cnv_quiz_perguntas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    await supabaseModerador
      .from('cnv_quizzes')
      .update({ total_perguntas: Math.max(0, perguntasQuiz.length - 1) })
      .eq('id', quizAtual.id);
    
    alert('✅ Pergunta excluída!');
    await carregarQuizAtivo();
    abrirModalGerenciarQuiz(quizAtual);
    
  } catch (error) {
    console.error('Erro ao deletar pergunta:', error);
    alert('❌ Erro ao deletar pergunta');
  }
}

function fecharModalPergunta(event) {
  if (!event || event.target === event.currentTarget) {
    abrirModalGerenciarQuiz(quizAtual);
  }
}
