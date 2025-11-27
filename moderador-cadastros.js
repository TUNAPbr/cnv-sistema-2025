
// ============================================
// CADASTRO: PALESTRAS
// ============================================

function renderizarListaPalestras() {
  const lista = document.getElementById('listaPalestras');
  
  if (palestras.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma palestra cadastrada</p>';
    return;
  }
  
  lista.innerHTML = palestras.map(p => `
    <div class="p-4 border rounded hover:shadow-md transition">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h4 class="font-bold">${esc(p.nome)}</h4>
          <p class="text-sm text-gray-600">Palestrante: ${esc(p.palestrante)}</p>
          <p class="text-xs text-gray-500">Máx ${p.max_perguntas_por_device} perguntas/device • Cooldown: ${p.tempo_entre_perguntas_seg}s</p>
        </div>
        <div class="flex gap-2">
          <button onclick="editarPalestra('${p.id}')" class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
            ✏️ Editar
          </button>
          <button onclick="deletarPalestra('${p.id}')" class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600">
            🗑️ Excluir
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function abrirModalPalestra(id = null) {
  const palestra = id ? palestras.find(p => p.id === id) : null;
  const titulo = palestra ? 'Editar Palestra' : 'Nova Palestra';
  
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">${titulo}</h3>
        <form onsubmit="salvarPalestra(event, '${id || ''}')">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-bold mb-1">Nome da Palestra *</label>
              <input type="text" id="palestraNome" value="${esc(palestra?.nome || '')}" required
                class="w-full p-2 border rounded" placeholder="Ex: Inteligência Artificial">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Palestrante *</label>
              <input type="text" id="palestraPalestrante" value="${esc(palestra?.palestrante || '')}" required
                class="w-full p-2 border rounded" placeholder="Ex: Dr. João Silva">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Máximo de perguntas por dispositivo *</label>
              <input type="number" id="palestraMaxPerguntas" value="${palestra?.max_perguntas_por_device || 3}" required min="1" max="10"
                class="w-full p-2 border rounded">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Tempo entre perguntas (segundos) *</label>
              <input type="number" id="palestraTempo" value="${palestra?.tempo_entre_perguntas_seg || 30}" required min="0" max="300"
                class="w-full p-2 border rounded">
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

async function salvarPalestra(event, id) {
  event.preventDefault();
  
  const dados = {
    nome: document.getElementById('palestraNome').value.trim(),
    palestrante: document.getElementById('palestraPalestrante').value.trim(),
    max_perguntas_por_device: parseInt(document.getElementById('palestraMaxPerguntas').value),
    tempo_entre_perguntas_seg: parseInt(document.getElementById('palestraTempo').value)
  };
  
  try {
    if (id) {
      // Editar
      const { error } = await supabase
        .from('cnv_palestras')
        .update(dados)
        .eq('id', id);
      
      if (error) throw error;
      alert('✅ Palestra atualizada!');
    } else {
      // Criar
      const { error } = await supabase
        .from('cnv_palestras')
        .insert(dados);
      
      if (error) throw error;
      alert('✅ Palestra criada!');
    }
    
    fecharModal();
    await carregarPalestras();
    
  } catch (error) {
    console.error('Erro ao salvar palestra:', error);
    alert('❌ Erro ao salvar palestra');
  }
}

function editarPalestra(id) {
  abrirModalPalestra(id);
}

async function deletarPalestra(id) {
  if (!confirm('Tem certeza que deseja excluir esta palestra?')) return;
  
  try {
    const { error } = await supabase
      .from('cnv_palestras')
      .update({ deletada: true })
      .eq('id', id);
    
    if (error) throw error;
    
    alert('✅ Palestra excluída!');
    await carregarPalestras();
    
  } catch (error) {
    console.error('Erro ao deletar palestra:', error);
    alert('❌ Erro ao deletar palestra');
  }
}

// ============================================
// CADASTRO: ENQUETES
// ============================================

function renderizarListaEnquetes() {
  const lista = document.getElementById('listaEnquetes');
  
  if (enquetes.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma enquete cadastrada</p>';
    return;
  }
  
  lista.innerHTML = enquetes.map(e => {
   const opcoes = Array.isArray(e.opcoes)
    ? e.opcoes
    : JSON.parse(e.opcoes || '[]');
    
    return `
      <div class="p-4 border rounded hover:shadow-md transition">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h4 class="font-bold">${esc(e.nome)}</h4>
            <p class="text-sm text-gray-600">Opções: ${opcoes.map((o, i) => `${i + 1}. ${o}`).join(' • ')}</p>
          </div>
          <div class="flex gap-2">
            <button onclick="editarEnquete('${e.id}')" class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
              ✏️ Editar
            </button>
            <button onclick="deletarEnquete('${e.id}')" class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600">
              🗑️ Excluir
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function abrirModalEnquete(id = null) {
  const enquete = id ? enquetes.find(e => e.id === id) : null;
  const opcoes = enquete
    ? (Array.isArray(enquete.opcoes) ? enquete.opcoes : JSON.parse(enquete.opcoes || '[]'))
    : ['', ''];
  const titulo = enquete ? 'Editar Enquete' : 'Nova Enquete';
  
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">${titulo}</h3>
        <form onsubmit="salvarEnquete(event, '${id || ''}')">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-bold mb-1">Nome da Enquete *</label>
              <input type="text" id="enqueteNome" value="${esc(enquete?.nome || '')}" required
                class="w-full p-2 border rounded" placeholder="Ex: Qual seu tema favorito?">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Opções (2 a 5) *</label>
              <div id="enqueteOpcoes" class="space-y-2">
                ${opcoes.map((o, i) => `
                  <input type="text" data-opcao="${i}" value="${esc(o)}" required
                    class="w-full p-2 border rounded" placeholder="Opção ${i + 1}">
                `).join('')}
              </div>
              <div class="flex gap-2 mt-2">
                <button type="button" onclick="adicionarOpcaoEnquete()" class="text-sm text-blue-600 hover:underline">
                  ➕ Adicionar opção
                </button>
                <button type="button" onclick="removerOpcaoEnquete()" class="text-sm text-red-600 hover:underline">
                  ➖ Remover última
                </button>
              </div>
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

function adicionarOpcaoEnquete() {
  const container = document.getElementById('enqueteOpcoes');
  const opcoes = container.querySelectorAll('input');
  
  if (opcoes.length >= 5) {
    alert('Máximo de 5 opções');
    return;
  }
  
  const novaOpcao = document.createElement('input');
  novaOpcao.type = 'text';
  novaOpcao.setAttribute('data-opcao', opcoes.length);
  novaOpcao.required = true;
  novaOpcao.className = 'w-full p-2 border rounded';
  novaOpcao.placeholder = `Opção ${opcoes.length + 1}`;
  
  container.appendChild(novaOpcao);
}

function removerOpcaoEnquete() {
  const container = document.getElementById('enqueteOpcoes');
  const opcoes = container.querySelectorAll('input');
  
  if (opcoes.length <= 2) {
    alert('Mínimo de 2 opções');
    return;
  }
  
  opcoes[opcoes.length - 1].remove();
}

async function salvarEnquete(event, id) {
  event.preventDefault();
  
  const nome = document.getElementById('enqueteNome').value.trim();
  const opcoesInputs = document.querySelectorAll('#enqueteOpcoes input');
  const opcoes = Array.from(opcoesInputs)
    .map(input => input.value.trim())
    .filter(o => o);

  if (opcoes.length < 2) {
    alert('Informe pelo menos 2 opções');
    return;
  }

  if (opcoes.some(o => !o)) {
    alert('Todas as opções devem ser preenchidas');
    return;
  }

  const dados = {
    nome,
    // IMPORTANTE: mandar o array direto
    opcoes
  };

  try {
    if (id) {
      const { error } = await supabase
        .from('cnv_enquetes')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
      alert('✅ Enquete atualizada!');
    } else {
      const { error } = await supabase
        .from('cnv_enquetes')
        .insert(dados);

      if (error) throw error;
      alert('✅ Enquete criada!');
    }

    fecharModal();
    await carregarEnquetes();

  } catch (error) {
    console.error('Erro ao salvar enquete:', error);
    alert('❌ Erro ao salvar enquete');
  }
}

function editarEnquete(id) {
  abrirModalEnquete(id);
}

async function deletarEnquete(id) {
  if (!confirm('Tem certeza que deseja excluir esta enquete?')) return;
  
  try {
    const { error } = await supabase
      .from('cnv_enquetes')
      .update({ deletada: true })
      .eq('id', id);
    
    if (error) throw error;
    
    alert('✅ Enquete excluída!');
    await carregarEnquetes();
    
  } catch (error) {
    console.error('Erro ao deletar enquete:', error);
    alert('❌ Erro ao deletar enquete');
  }
}

// ============================================
// CADASTRO: QUIZ (apenas estrutura básica, perguntas em outro arquivo)
// ============================================

function renderizarListaQuizzes() {
  const lista = document.getElementById('listaQuizzes');
  if (!lista) return;

  if (!quizzes || quizzes.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum quiz cadastrado</p>';
    return;
  }

  lista.innerHTML = quizzes.map(q => `
    <div class="p-4 border rounded hover:shadow-md transition">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h4 class="font-bold">${esc(q.nome)}</h4>
          <p class="text-sm text-gray-600">
            ${q.total_perguntas} perguntas • Status: ${q.status}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            onclick="editarTituloQuiz('${q.id}')"
            class="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
          >
            ✏️ Editar
          </button>
          <button
            onclick="editarQuiz('${q.id}')"
            class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            📚 Gerenciar
          </button>
          <button
            onclick="deletarQuiz('${q.id}')"
            class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            🗑️ Excluir
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// abre criação de quiz ou gerenciamento (atalho)
function abrirModalQuiz(id = null) {
  const quiz = id ? quizzes.find(q => q.id === id) : null;
  const titulo = quiz ? `Gerenciar Quiz: ${quiz.nome}` : 'Novo Quiz';

  if (quiz) {
    // Se já existe, vai direto pro gerenciamento de perguntas
    abrirModalGerenciarQuiz(quiz);
    return;
  }

  // Modal de criação de quiz
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">${titulo}</h3>
        <form onsubmit="salvarQuiz(event)">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-bold mb-1">Nome do Quiz *</label>
              <input type="text" id="quizNome" required
                class="w-full p-2 border rounded"
                placeholder="Ex: Quiz de Conhecimentos Gerais">
            </div>
          </div>
          <div class="flex gap-2 mt-6">
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              ➕ Criar Quiz
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

async function salvarQuiz(event) {
  event.preventDefault();
  
  const nome = document.getElementById('quizNome').value.trim();
  if (!nome) {
    alert('Informe o nome do quiz');
    return;
  }

  try {
    const { error } = await supabase
      .from('cnv_quizzes')
      .insert({ nome });

    if (error) throw error;

    alert('✅ Quiz criado com sucesso!');
    fecharModal();
    await carregarQuizzes();
  } catch (error) {
    console.error('Erro ao criar quiz:', error);
    alert('❌ Erro ao criar quiz');
  }
}

// atalho: abre gerenciamento de perguntas
function editarQuiz(id) {
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) return;
  abrirModalGerenciarQuiz(quiz);
}

// atalho: abre modal de edição de título/status (definido em moderador-quiz.js)
function editarTituloQuiz(id) {
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) return;
  abrirModalEditarQuiz(quiz);
}

async function deletarQuiz(id) {
  if (!confirm('Tem certeza que deseja excluir este quiz e todas as suas perguntas?')) return;
  
  try {
    const { error } = await supabase
      .from('cnv_quizzes')
      .update({ deletado: true })
      .eq('id', id);
    
    if (error) throw error;
    
    alert('✅ Quiz excluído!');
    await carregarQuizzes();
    
  } catch (error) {
    console.error('Erro ao deletar quiz:', error);
    alert('❌ Erro ao deletar quiz');
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

function fecharModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('modalContainer').innerHTML = '';
  }
}
