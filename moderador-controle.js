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
// CONTROLE: PERGUNTAS
// ============================================

async function carregarControlePerguntas() {
  const container = document.getElementById('controleStatusPerguntas');
  const listaPerguntasDiv = document.getElementById('listaPerguntasRecebidas');
  
  if (!sessaoAtual?.palestra_ativa_id) {
    container.innerHTML = `
      <div class="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p class="text-yellow-800">⚠️ Nenhuma palestra selecionada</p>
        <button onclick="selecionarPalestraParaPerguntas()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Selecionar Palestra
        </button>
      </div>
    `;
    listaPerguntasDiv.innerHTML = '';
    return;
  }
  
  const palestra = palestras.find(p => p.id === sessaoAtual.palestra_ativa_id);
  
  container.innerHTML = `
    <div class="p-4 bg-blue-50 border border-blue-200 rounded">
      <h4 class="font-bold text-lg mb-2">${esc(palestra?.nome || 'Palestra')}</h4>
      <p class="text-sm text-gray-700 mb-3">Palestrante: ${esc(palestra?.palestrante || '')}</p>
      <div class="flex gap-2">
        ${sessaoAtual.perguntas_abertas ? `
          <button onclick="fecharPerguntasParticipantes()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            🔒 Fechar Perguntas
          </button>
        ` : `
          <button onclick="abrirPerguntasParticipantes()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            🔓 Abrir Perguntas
          </button>
        `}
        <button onclick="selecionarPalestraParaPerguntas()" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
          🔄 Trocar Palestra
        </button>
      </div>
      <p class="text-xs text-gray-600 mt-2">
        Status: ${sessaoAtual.perguntas_abertas ? '🟢 ABERTO' : '🔴 FECHADO'}
      </p>
    </div>
  `;
  
  // Carregar perguntas recebidas
  await carregarPerguntasRecebidas();
}

function selecionarPalestraParaPerguntas() {
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">Selecionar Palestra</h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${palestras.filter(p => p.ativa).map(p => `
            <button onclick="ativarPalestraPerguntas('${p.id}')" 
              class="w-full p-3 text-left border rounded hover:bg-blue-50 transition">
              <p class="font-bold">${esc(p.nome)}</p>
              <p class="text-sm text-gray-600">${esc(p.palestrante)}</p>
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

async function ativarPalestraPerguntas(palestraId) {
  try {
    // Atualiza no Supabase e retorna linha atualizada
    const { data, error } = await supabase
      .from("cnv_sessao")
      .update({
        palestra_ativa_id: palestraId,
        perguntas_abertas: false
      })
      .eq("id", 1)
      .select()
      .single();

    if (error) throw error;

    // Atualiza sessão local imediatamente
    sessaoAtual = data;

    // Recarrega palestras para puxar nome, palestrante etc.
    await carregarPalestras();

    // Atualiza a UI da aba Controle (sem depender do realtime)
    await carregarControlePerguntas();

    fecharModal();

  } catch (error) {
    console.error("Erro ao ativar palestra:", error);
    alert("❌ Erro ao selecionar palestra");
  }
}

async function abrirPerguntasParticipantes() {
  try {
    const { data, error } = await supabase
      .from('cnv_sessao')
      .update({ perguntas_abertas: true })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    // 🔥 Atualiza sessão local
    sessaoAtual = data;

    // 🔥 Atualiza UI do módulo de perguntas
    await carregarControlePerguntas();

  } catch (error) {
    console.error('Erro ao abrir perguntas:', error);
    alert('❌ Erro ao abrir perguntas');
  }
}

async function fecharPerguntasParticipantes() {
  try {
    const { data, error } = await supabase
      .from('cnv_sessao')
      .update({ perguntas_abertas: false })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    // 🔥 Atualiza sessão local
    sessaoAtual = data;

    // 🔥 Atualiza UI do módulo de perguntas
    await carregarControlePerguntas();

  } catch (error) {
    console.error('Erro ao fechar perguntas:', error);
    alert('❌ Erro ao fechar perguntas');
  }
}

async function carregarPerguntasRecebidas() {
  const listaPerguntasDiv = document.getElementById('listaPerguntasRecebidas');
  
  if (!sessaoAtual?.palestra_ativa_id) {
    listaPerguntasDiv.innerHTML = '';
    return;
  }
  
  const { data, error } = await supabase
    .from('cnv_perguntas')
    .select('*')
    .eq('palestra_id', sessaoAtual.palestra_ativa_id)
    .eq('deletada', false)
    .order('criada_em', { ascending: false });
  
  if (error) {
    console.error('Erro ao carregar perguntas:', error);
    return;
  }
  
  perguntasRecebidas = data || [];
  
  if (perguntasRecebidas.length === 0) {
    listaPerguntasDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma pergunta recebida ainda</p>';
    return;
  }
  
  listaPerguntasDiv.innerHTML = `
    <h4 class="font-bold mb-2">Perguntas Recebidas (${perguntasRecebidas.length})</h4>
    <div class="space-y-2">
      ${perguntasRecebidas.map(p => `
        <div class="p-3 border rounded
          ${p.exibida_no_telao ? ' bg-green-50 border-green-300' : ''}
          ${p.respondida ? ' bg-gray-100 opacity-75' : ''}">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1">
              <p class="font-medium">${esc(p.pergunta)}</p>
              <p class="text-xs text-gray-500 mt-1">
                ${p.nome_autor ? esc(p.nome_autor) : 'Anônimo'} • 
                ${new Date(p.criada_em).toLocaleString('pt-BR')}
              </p>
              ${p.respondida ? '<p class="text-xs font-semibold text-emerald-700 mt-1">✅ Respondida</p>' : ''}
            </div>
            <div class="flex flex-col gap-1 items-end">
              <div class="flex gap-1">
                <button onclick="editarPerguntaRecebida('${p.id}')" 
                  class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                  ✏️
                </button>
                <button onclick="exibirPerguntaNoTelao('${p.id}')" 
                  class="px-2 py-1 text-xs ${p.exibida_no_telao ? 'bg-gray-400' : 'bg-green-500'} text-white rounded hover:opacity-80">
                  ${p.exibida_no_telao ? '👁️' : '📺'}
                </button>
                <button onclick="togglePerguntaRespondida('${p.id}')"
                  class="px-2 py-1 text-xs ${p.respondida ? 'bg-emerald-600' : 'bg-emerald-500'} text-white rounded hover:bg-emerald-700">
                  ${p.respondida ? '↩️ Pendente' : '✅ Respondida'}
                </button>
                <button onclick="deletarPerguntaRecebida('${p.id}')" 
                  class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function editarPerguntaRecebida(id) {
  const pergunta = perguntasRecebidas.find(p => p.id === id);
  if (!pergunta) return;
  
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">Editar Pergunta</h3>
        <form onsubmit="salvarEdicaoPergunta(event, '${id}')">
          <textarea id="perguntaTexto" rows="4" required
            class="w-full p-2 border rounded">${esc(pergunta.pergunta)}</textarea>
          <div class="flex gap-2 mt-4">
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

async function salvarEdicaoPergunta(event, id) {
  event.preventDefault();
  
  const novaPergunta = document.getElementById('perguntaTexto').value.trim();
  
  try {
    const { error } = await supabase
      .from('cnv_perguntas')
      .update({ 
        pergunta: novaPergunta,
        editada_por_moderador: true 
      })
      .eq('id', id);
    
    if (error) throw error;
    
    fecharModal();
    alert('✅ Pergunta editada!');
    await carregarPerguntasRecebidas();
    
  } catch (error) {
    console.error('Erro ao editar pergunta:', error);
    alert('❌ Erro ao editar pergunta');
  }
}

async function exibirPerguntaNoTelao(id) {
  try {
    // Descobre como está o estado atual desta pergunta
    const pergunta = perguntasRecebidas.find(p => p.id === id);
    const jaExibida = !!pergunta?.exibida_no_telao;

    if (jaExibida) {
      // 🔹 Se já está no telão, eu APENAS oculto
      const { error } = await supabase
        .from('cnv_perguntas')
        .update({ exibida_no_telao: false })
        .eq('id', id);

      if (error) throw error;
    } else {
      // 🔹 Se ainda NÃO está no telão, faço o fluxo atual:
      // limpa todas da palestra e marca só essa
      const { error: clearError } = await supabase
        .from('cnv_perguntas')
        .update({ exibida_no_telao: false })
        .eq('palestra_id', sessaoAtual.palestra_ativa_id);

      if (clearError) throw clearError;

      const { error } = await supabase
        .from('cnv_perguntas')
        .update({ exibida_no_telao: true })
        .eq('id', id);

      if (error) throw error;
    }

    // 🔄 Atualiza a lista do moderador
    await carregarPerguntasRecebidas();

  } catch (error) {
    console.error('Erro ao exibir/ocultar pergunta:', error);
    alert('❌ Erro ao exibir/ocultar pergunta');
  }
}

async function deletarPerguntaRecebida(id) {
  if (!confirm('Excluir esta pergunta?')) return;
  
  try {
    const { error } = await supabase
      .from('cnv_perguntas')
      .update({ deletada: true })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarPerguntasRecebidas();
    
  } catch (error) {
    console.error('Erro ao deletar pergunta:', error);
    alert('❌ Erro ao deletar pergunta');
  }
}

async function togglePerguntaRespondida(id) {
  const pergunta = perguntasRecebidas.find(p => p.id === id);
  if (!pergunta) return;

  const novaFlag = !pergunta.respondida;

  try {
    const { error } = await supabase
      .from('cnv_perguntas')
      .update({ 
        respondida: novaFlag,
        exibida_no_telao: false // sempre tira do telão ao marcar como respondida
      })
      .eq('id', id);
    
    if (error) throw error;

    await carregarPerguntasRecebidas();
  } catch (error) {
    console.error('Erro ao marcar pergunta como respondida:', error);
    alert('❌ Erro ao marcar pergunta como respondida');
  }
}

// ============================================
// CONTROLE: ENQUETES
// ============================================

async function carregarControleEnquetes() {
  const container = document.getElementById('controleStatusEnquetes');
  const resultadoDiv = document.getElementById('controleResultadoEnquete');
  
  if (!sessaoAtual?.enquete_ativa_id) {
    container.innerHTML = `
      <div class="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p class="text-yellow-800">⚠️ Nenhuma enquete selecionada</p>
        <button onclick="selecionarEnquete()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Selecionar Enquete
        </button>
      </div>
    `;
    resultadoDiv.innerHTML = '';
    return;
  }
  
  const enquete = enquetes.find(e => e.id === sessaoAtual.enquete_ativa_id);
  const opcoes = enquete ? normalizarOpcoesEnquete(enquete.opcoes) : [];
  
  container.innerHTML = `
    <div class="p-4 bg-blue-50 border border-blue-200 rounded">
      <h4 class="font-bold text-lg mb-2">${esc(enquete?.nome || 'Enquete')}</h4>
      <p class="text-sm text-gray-700 mb-3">Opções: ${opcoes.length}</p>
      <div class="flex gap-2 flex-wrap">
        ${sessaoAtual.enquete_votacao_aberta ? `
          <button onclick="fecharVotacaoEnquete()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            🔒 Fechar Votação
          </button>
        ` : `
          <button onclick="abrirVotacaoEnquete()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            🔓 Abrir Votação
          </button>
        `}
        
        <button onclick="toggleResultadoEnquete()" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          ${sessaoAtual.enquete_mostrar_resultado ? '🙈 Ocultar' : '📊 Mostrar'} Resultado
        </button>

        <button onclick="selecionarEnquete()" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
          🔄 Trocar Enquete
        </button>

        <button onclick="zerarEnqueteAtual()" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
          🧹 Zerar Enquete
        </button>
      </div>
      <p class="text-xs text-gray-600 mt-2">
        Votação: ${sessaoAtual.enquete_votacao_aberta ? '🟢 ABERTA' : '🔴 FECHADA'} • 
        Resultado: ${sessaoAtual.enquete_mostrar_resultado ? '👁️ VISÍVEL' : '🙈 OCULTO'}
      </p>
    </div>
  `;
  
  // Carregar resultado
  await carregarResultadoEnquete();
}

function selecionarEnquete() {
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">Selecionar Enquete</h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${enquetes.filter(e => e.ativa).map(e => {
            const opcoes = normalizarOpcoesEnquete(e.opcoes);
            return `
              <button onclick="ativarEnquete('${e.id}')" 
                class="w-full p-3 text-left border rounded hover:bg-blue-50 transition">
                <p class="font-bold">${esc(e.nome)}</p>
                <p class="text-sm text-gray-600">${opcoes.length} opções</p>
              </button>
            `;
          }).join('')}
        </div>
        <button onclick="fecharModal()" class="mt-4 w-full px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
          Cancelar
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function ativarEnquete(enqueteId) {
  try {
    const { error } = await supabase
      .from('cnv_sessao')
      .update({
        enquete_ativa_id: enqueteId,
        enquete_votacao_aberta: false,
        enquete_mostrar_resultado: false
      })
      .eq('id', 1);
    
    if (error) throw error;
    
    fecharModal();
    alert('✅ Enquete selecionada!');
    
  } catch (error) {
    console.error('Erro ao ativar enquete:', error);
    alert('❌ Erro ao selecionar enquete');
  }
}

async function abrirVotacaoEnquete() {
  try {
    const { error } = await supabase
      .from('cnv_sessao')
      .update({ 
        enquete_votacao_aberta: true,
        enquete_mostrar_resultado: false 
      })
      .eq('id', 1);
    
    if (error) throw error;
    
    alert('✅ Votação aberta!');
    
  } catch (error) {
    console.error('Erro ao abrir votação:', error);
    alert('❌ Erro ao abrir votação');
  }
}

async function fecharVotacaoEnquete() {
  try {
    const { error } = await supabase
      .from('cnv_sessao')
      .update({ enquete_votacao_aberta: false })
      .eq('id', 1);
    
    if (error) throw error;
    
    alert('✅ Votação fechada!');
    
  } catch (error) {
    console.error('Erro ao fechar votação:', error);
    alert('❌ Erro ao fechar votação');
  }
}

async function toggleResultadoEnquete() {
  try {
    const novoValor = !sessaoAtual.enquete_mostrar_resultado;
    
    const { error } = await supabase
      .from('cnv_sessao')
      .update({ enquete_mostrar_resultado: novoValor })
      .eq('id', 1);
    
    if (error) throw error;
    
    alert(novoValor ? '✅ Resultado exibido no telão!' : '✅ Resultado ocultado!');
    
  } catch (error) {
    console.error('Erro ao toggle resultado:', error);
    alert('❌ Erro ao alterar exibição');
  }
}

async function zerarEnqueteAtual() {
  // Guard-rail: nada ativo
  if (!sessaoAtual?.enquete_ativa_id) {
    alert('⚠️ Nenhuma enquete ativa para zerar.');
    return;
  }

  if (!confirm('Tem certeza que deseja ZERAR a enquete atual? Todos os votos serão apagados.')) {
    return;
  }

  try {
    const enqueteId = sessaoAtual.enquete_ativa_id;

    // 1) Apagar todos os votos da enquete
    const { error: errVotos } = await supabase
      .from('cnv_enquete_votos')
      .delete()
      .eq('enquete_id', enqueteId);

    if (errVotos) throw errVotos;

    // 2) Resetar flags da sessão (fecha votação e esconde resultado)
    const { data, error: errSessao } = await supabase
      .from('cnv_sessao')
      .update({
        enquete_votacao_aberta: false,
        enquete_mostrar_resultado: false
      })
      .eq('id', 1)
      .select()
      .single();

    if (errSessao) throw errSessao;

    // Atualiza estado local de sessão
    sessaoAtual = data;

    // 3) Atualizar UI: status e resultado
    await carregarControleEnquetes();

    alert('✅ Enquete zerada com sucesso!');

  } catch (error) {
    console.error('Erro ao zerar enquete:', error);
    alert('❌ Erro ao zerar enquete. Verifique o console para mais detalhes.');
  }
}

async function carregarResultadoEnquete() {
  const resultadoDiv = document.getElementById('controleResultadoEnquete');
  
  if (!sessaoAtual?.enquete_ativa_id) {
    resultadoDiv.innerHTML = '';
    return;
  }
  
  const { data, error } = await supabase.rpc('cnv_resultado_enquete', {
    p_enquete_id: sessaoAtual.enquete_ativa_id
  });
  
  if (error) {
    console.error('Erro ao carregar resultado:', error);
    return;
  }
  
  const enquete = enquetes.find(e => e.id === sessaoAtual.enquete_ativa_id);
  const opcoes = enquete ? normalizarOpcoesEnquete(enquete.opcoes) : [];
  
  const totalVotos = data.reduce((sum, r) => sum + parseInt(r.total_votos), 0);
  
  resultadoDiv.innerHTML = `
    <div class="mt-4 p-4 border rounded">
      <h4 class="font-bold mb-3">📊 Resultado (${totalVotos} votos)</h4>
      <div class="space-y-2">
        ${opcoes.map((opcao, idx) => {
          const resultado = data.find(r => r.opcao_index === idx);
          const votos = resultado ? parseInt(resultado.total_votos) : 0;
          const percentual = resultado ? parseFloat(resultado.percentual) : 0;
          
          return `
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium">${idx + 1}. ${esc(opcao)}</span>
                <span class="text-gray-600">${votos} votos (${percentual}%)</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-4">
                <div class="bg-blue-600 h-4 rounded-full" style="width: ${percentual}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================
// CONTROLE: QUIZ (básico, detalhes em moderador-quiz.js)
// ============================================

async function carregarControleQuiz() {
  const container = document.getElementById('controleStatusQuiz');
  
  if (!sessaoAtual?.quiz_ativo_id) {
    container.innerHTML = `
      <div class="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p class="text-yellow-800">⚠️ Nenhum quiz selecionado</p>
        <button onclick="selecionarQuiz()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Selecionar Quiz
        </button>
      </div>
    `;
    return;
  }
  
  // Carregar detalhes do quiz
  await carregarQuizAtivo();
}

// ============================================
// CONTROLE: aguardando 
// ============================================

async function toggleQRCode() {
  const novoEstado = !sessaoAtual.mostrar_qrcode;
  
  const { error } = await supabase
    .from('cnv_sessao')
    .update({ mostrar_qrcode: novoEstado })
    .eq('id', 1);
  
  if (error) {
    alert('❌ Erro ao atualizar QR Code');
    return;
  }
  
  alert(`✅ QR Code ${novoEstado ? 'visível' : 'oculto'}`);
}
