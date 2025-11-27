// ============================================
// MODERADOR-EXPORTAR.JS
// Exportação de dados em CSV
// ============================================

// COLE ESTE CÓDIGO NO FINAL DO moderador.js

// ============================================
// EXPORTAR: ATUALIZAR SELECTS
// ============================================

function atualizarSelectExportPalestras() {
  const select = document.getElementById('exportPalestraSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione uma palestra...</option>' +
    palestras.filter(p => p.ativa).map(p => 
      `<option value="${p.id}">${esc(p.nome)}</option>`
    ).join('');
}

function atualizarSelectExportEnquetes() {
  const select = document.getElementById('exportEnqueteSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione uma enquete...</option>' +
    enquetes.filter(e => e.ativa).map(e => 
      `<option value="${e.id}">${esc(e.nome)}</option>`
    ).join('');
}

// ============================================
// EXPORTAR: PERGUNTAS
// ============================================

async function exportarPerguntas() {
  const select = document.getElementById('exportPalestraSelect');
  const palestraId = select.value;
  
  if (!palestraId) {
    alert('Selecione uma palestra');
    return;
  }
  
  const palestra = palestras.find(p => p.id === palestraId);
  
  try {
    const { data, error } = await supabase.rpc('cnv_exportar_perguntas', {
      p_palestra_id: palestraId
    });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      alert('Nenhuma pergunta para exportar');
      return;
    }
    
    // Converter para CSV
    const headers = ['Autor', 'Email', 'Pergunta', 'Data'];
    const rows = data.map(r => [
      r.autor,
      r.email,
      r.pergunta,
      r.data
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `perguntas_${palestra.nome.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    alert(`✅ Exportado ${data.length} perguntas!`);
    
  } catch (error) {
    console.error('Erro ao exportar perguntas:', error);
    alert('❌ Erro ao exportar perguntas');
  }
}

// ============================================
// EXPORTAR: ENQUETE
// ============================================

async function exportarEnquete() {
  const select = document.getElementById('exportEnqueteSelect');
  const enqueteId = select.value;
  
  if (!enqueteId) {
    alert('Selecione uma enquete');
    return;
  }
  
  const enquete = enquetes.find(e => e.id === enqueteId);
  
  try {
    const { data, error } = await supabase.rpc('cnv_exportar_enquete', {
      p_enquete_id: enqueteId
    });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      alert('Nenhum voto para exportar');
      return;
    }
    
    // Converter para CSV
    const headers = ['Opção', 'Votos', 'Percentual'];
    const rows = data.map(r => [
      r.opcao,
      r.votos,
      `${r.percentual}%`
    ]);
    
    // Adicionar total
    const totalVotos = data.reduce((sum, r) => sum + parseInt(r.votos), 0);
    rows.push(['TOTAL', totalVotos, '100%']);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `enquete_${enquete.nome.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    alert(`✅ Exportado resultado da enquete (${totalVotos} votos)!`);
    
  } catch (error) {
    console.error('Erro ao exportar enquete:', error);
    alert('❌ Erro ao exportar enquete');
  }
}

// ============================================
// CONFIGURAÇÕES (BONUS)
// ============================================

function abrirConfig() {
  const modal = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="fecharModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">⚙️ Configurações do Evento</h3>
        <form onsubmit="salvarConfig(event)">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-bold mb-1">Nome do Evento</label>
              <input type="text" id="configNome" value="${esc(config?.nome_evento || 'CNV 2025')}" 
                class="w-full p-2 border rounded">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Sigla</label>
              <input type="text" id="configSigla" value="${esc(config?.sigla_evento || 'CNV25')}" 
                class="w-full p-2 border rounded">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Ano</label>
              <input type="number" id="configAno" value="${config?.ano || 2025}" 
                class="w-full p-2 border rounded">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Cor Primária</label>
              <input type="color" id="configCorPrimaria" value="${config?.cor_primaria || '#0066CC'}" 
                class="w-full p-2 border rounded h-12">
            </div>
            <div>
              <label class="block text-sm font-bold mb-1">Cor Secundária</label>
              <input type="color" id="configCorSecundaria" value="${config?.cor_secundaria || '#FF6B00'}" 
                class="w-full p-2 border rounded h-12">
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

async function salvarConfig(event) {
  event.preventDefault();
  
  const dados = {
    nome_evento: document.getElementById('configNome').value.trim(),
    sigla_evento: document.getElementById('configSigla').value.trim(),
    ano: parseInt(document.getElementById('configAno').value),
    cor_primaria: document.getElementById('configCorPrimaria').value,
    cor_secundaria: document.getElementById('configCorSecundaria').value
  };
  
  try {
    const { error } = await supabase
      .from('cnv_config')
      .update(dados)
      .eq('id', 1);
    
    if (error) throw error;
    
    alert('✅ Configurações salvas! Recarregue a página.');
    fecharModal();
    
  } catch (error) {
    console.error('Erro ao salvar config:', error);
    alert('❌ Erro ao salvar configurações');
  }
}
