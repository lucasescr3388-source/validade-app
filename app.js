/* ================== Estado e armazenamento ================== */
const STORAGE_KEY = 'validade_items_v1';
const HISTORY_KEY = 'validade_history_v1';

let items = loadItems();
let history = loadHistory();
let currentTab = 'vencendo';
let currentPhotoData = null;
let scanStream = null;
let barcodeDetector = null;

function loadItems(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveItems(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function loadHistory(){
  try{
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveHistory(){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function uid(){
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

/* ================== Classificação por urgência ================== */
// vermelho: vencido ou <= 3 dias | amarelo: <= 10 dias | verde: > 10 dias
function daysUntil(dateStr){
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}
function urgencyOf(item){
  const d = daysUntil(item.validade);
  if(d < 0) return 'vencido';
  if(d <= 3) return 'vermelho';
  if(d <= 10) return 'amarelo';
  return 'verde';
}
function urgencyLabel(u, item){
  const d = daysUntil(item.validade);
  if(u === 'vencido') return `Vencido há ${Math.abs(d)} dia${Math.abs(d)===1?'':'s'}`;
  if(d === 0) return 'Vence hoje';
  if(d === 1) return 'Vence amanhã';
  return `Vence em ${d} dias`;
}

/* ================== Toast ================== */
let toastTimer;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2400);
}

/* ================== Render: categorias no filtro ================== */
function refreshCategoryOptions(){
  const sel = document.getElementById('filterCategoria');
  const datalist = document.getElementById('categoriaList');
  const cats = [...new Set(items.map(i => (i.categoria||'').trim()).filter(Boolean))].sort();
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">Todas categorias</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  sel.value = cats.includes(currentVal) ? currentVal : '';
  datalist.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const unidadeLabel = { unidade:'un', caixa:'cx', kg:'kg', pacote:'pct' };

/* ================== Render principal da lista ================== */
function getFilteredItems(){
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const fCategoria = document.getElementById('filterCategoria').value;
  const fUnidade = document.getElementById('filterUnidade').value;
  const fStatus = document.getElementById('filterStatus').value;

  return items.filter(item => {
    const u = urgencyOf(item);
    const uForFilter = u === 'vencido' ? 'vermelho' : u;

    if(currentTab === 'vencendo' && u === 'vencido') return false;
    if(currentTab === 'vencendo' && u === 'verde') return false;
    if(currentTab === 'vencidos' && u !== 'vencido') return false;

    if(search){
      const hay = `${item.nome} ${item.codigoBarras||''} ${item.categoria||''}`.toLowerCase();
      if(!hay.includes(search)) return false;
    }
    if(fCategoria && item.categoria !== fCategoria) return false;
    if(fUnidade && item.unidadeMedida !== fUnidade) return false;
    if(fStatus && uForFilter !== fStatus) return false;

    return true;
  }).sort((a,b) => new Date(a.validade) - new Date(b.validade));
}

function updateTabCounts(){
  const vencendo = items.filter(i => { const u = urgencyOf(i); return u==='vermelho'||u==='amarelo'; }).length;
  const vencidos = items.filter(i => urgencyOf(i) === 'vencido').length;
  document.getElementById('countVencendo').textContent = vencendo;
  document.getElementById('countTodos').textContent = items.length;
  document.getElementById('countVencidos').textContent = vencidos;
}

function renderList(){
  refreshCategoryOptions();
  updateTabCounts();
  const list = document.getElementById('itemList');
  const empty = document.getElementById('emptyState');
  const emptyText = document.getElementById('emptyText');
  const filtered = getFilteredItems();

  list.innerHTML = '';

  if(filtered.length === 0){
    empty.classList.remove('hidden');
    if(items.length === 0){
      emptyText.textContent = 'Nenhum item cadastrado ainda. Toque em "+" para começar.';
    } else if(currentTab === 'vencendo'){
      emptyText.textContent = 'Nada vencendo agora — tudo sob controle. 🎉';
    } else if(currentTab === 'vencidos'){
      emptyText.textContent = 'Nenhum item vencido. Ótimo trabalho!';
    } else {
      emptyText.textContent = 'Nenhum item encontrado com esse filtro.';
    }
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach(item => {
    const u = urgencyOf(item);
    const badgeClass = u === 'vencido' ? 'vermelho' : u;
    const li = document.createElement('li');
    li.className = `item-card urg-${badgeClass}`;
    li.dataset.id = item.id;

    const thumb = item.foto
      ? `<img src="${item.foto}" class="item-thumb" alt="">`
      : `<div class="item-thumb-fallback">📦</div>`;

    li.innerHTML = `
      ${thumb}
      <div class="item-info">
        <p class="item-name">${escapeHtml(item.nome)}</p>
        <p class="item-meta">
          <span>${formatDate(item.validade)}</span>
          <span class="sep">·</span>
          <span>${item.quantidade ?? ''} ${unidadeLabel[item.unidadeMedida]||''}</span>
          ${item.categoria ? `<span class="sep">·</span><span>${escapeHtml(item.categoria)}</span>` : ''}
        </p>
      </div>
      <div class="item-actions">
        <span class="item-badge badge-${badgeClass}">${urgencyLabel(u, item)}</span>
      </div>
    `;
    li.addEventListener('click', () => openActionSheet(item.id));
    list.appendChild(li);
  });
}

function formatDate(dateStr){
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/* ================== Tabs ================== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected','true');
    currentTab = tab.dataset.tab;
    renderList();
  });
});

['searchInput','filterCategoria','filterUnidade','filterStatus'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderList);
  document.getElementById(id).addEventListener('change', renderList);
});

/* ================== Menu ================== */
const menuPanel = document.getElementById('menuPanel');
document.getElementById('btnMenu').addEventListener('click', (e) => {
  e.stopPropagation();
  menuPanel.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if(!menuPanel.classList.contains('hidden') && !menuPanel.contains(e.target)){
    menuPanel.classList.add('hidden');
  }
});

/* ================== Form: abrir / fechar ================== */
const modalForm = document.getElementById('modalForm');
const itemForm = document.getElementById('itemForm');

function openNewItemForm(prefillBarcode){
  itemForm.reset();
  document.getElementById('itemId').value = '';
  document.getElementById('formTitle').textContent = 'Novo item';
  document.getElementById('btnDelete').classList.add('hidden');
  document.getElementById('photoPreview').classList.add('hidden');
  document.getElementById('btnRemovePhoto').classList.add('hidden');
  currentPhotoData = null;
  document.getElementById('quantidade').value = 1;
  document.getElementById('unidadeMedida').value = 'unidade';
  if(prefillBarcode) document.getElementById('barcode').value = prefillBarcode;
  // default validade: 7 dias a frente como sugestão neutra
  modalForm.classList.remove('hidden');
  setTimeout(()=>document.getElementById('nome').focus(), 150);
}

function openEditItemForm(id){
  const item = items.find(i => i.id === id);
  if(!item) return;
  document.getElementById('itemId').value = item.id;
  document.getElementById('formTitle').textContent = 'Editar item';
  document.getElementById('btnDelete').classList.remove('hidden');
  document.getElementById('barcode').value = item.codigoBarras || '';
  document.getElementById('nome').value = item.nome || '';
  document.getElementById('categoria').value = item.categoria || '';
  document.getElementById('unidadeMedida').value = item.unidadeMedida || 'unidade';
  document.getElementById('quantidade').value = item.quantidade ?? 1;
  document.getElementById('preco').value = item.preco ?? '';
  document.getElementById('validade').value = item.validade || '';
  document.getElementById('local').value = item.local || '';
  document.getElementById('observacoes').value = item.observacoes || '';
  currentPhotoData = item.foto || null;
  const preview = document.getElementById('photoPreview');
  if(currentPhotoData){
    preview.src = currentPhotoData;
    preview.classList.remove('hidden');
    document.getElementById('btnRemovePhoto').classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
    document.getElementById('btnRemovePhoto').classList.add('hidden');
  }
  modalForm.classList.remove('hidden');
}

document.getElementById('closeForm').addEventListener('click', () => modalForm.classList.add('hidden'));
document.getElementById('fabAdd').addEventListener('click', () => openNewItemForm());
document.getElementById('emptyAddBtn').addEventListener('click', () => openNewItemForm());

itemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('itemId').value || uid();
  const data = {
    id,
    codigoBarras: document.getElementById('barcode').value.trim(),
    nome: document.getElementById('nome').value.trim(),
    categoria: document.getElementById('categoria').value.trim(),
    unidadeMedida: document.getElementById('unidadeMedida').value,
    quantidade: parseFloat(document.getElementById('quantidade').value) || 0,
    preco: parseFloat(document.getElementById('preco').value) || 0,
    validade: document.getElementById('validade').value,
    local: document.getElementById('local').value.trim(),
    observacoes: document.getElementById('observacoes').value.trim(),
    foto: currentPhotoData,
    criadoEm: items.find(i=>i.id===id)?.criadoEm || new Date().toISOString(),
  };

  const idx = items.findIndex(i => i.id === id);
  if(idx >= 0) items[idx] = data; else items.push(data);
  saveItems();
  modalForm.classList.add('hidden');
  renderList();
  toast(idx >= 0 ? 'Item atualizado' : 'Item cadastrado');
});

document.getElementById('btnDelete').addEventListener('click', () => {
  const id = document.getElementById('itemId').value;
  if(!id) return;
  if(confirm('Excluir este item permanentemente?')){
    items = items.filter(i => i.id !== id);
    saveItems();
    modalForm.classList.add('hidden');
    renderList();
    toast('Item excluído');
  }
});

/* ================== Foto ================== */
document.getElementById('btnTakePhoto').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});
document.getElementById('photoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    compressImage(ev.target.result, (compressed) => {
      currentPhotoData = compressed;
      const preview = document.getElementById('photoPreview');
      preview.src = compressed;
      preview.classList.remove('hidden');
      document.getElementById('btnRemovePhoto').classList.remove('hidden');
    });
  };
  reader.readAsDataURL(file);
});
document.getElementById('btnRemovePhoto').addEventListener('click', () => {
  currentPhotoData = null;
  document.getElementById('photoPreview').classList.add('hidden');
  document.getElementById('btnRemovePhoto').classList.add('hidden');
  document.getElementById('photoInput').value = '';
});

function compressImage(dataUrl, cb){
  const img = new Image();
  img.onload = () => {
    const maxSize = 480;
    let { width, height } = img;
    if(width > height && width > maxSize){ height *= maxSize/width; width = maxSize; }
    else if(height > maxSize){ width *= maxSize/height; height = maxSize; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    cb(canvas.toDataURL('image/jpeg', 0.72));
  };
  img.src = dataUrl;
}

/* ================== Scanner de código de barras ================== */
const modalScan = document.getElementById('modalScan');
const scanVideo = document.getElementById('scanVideo');
const scanStatus = document.getElementById('scanStatus');

document.getElementById('btnScan').addEventListener('click', startScanner);
document.getElementById('closeScan').addEventListener('click', stopScanner);
document.getElementById('btnManualBarcode').addEventListener('click', () => {
  stopScanner();
  document.getElementById('barcode').focus();
});

async function startScanner(){
  modalScan.classList.remove('hidden');
  scanStatus.textContent = 'Aponte a câmera para o código de barras…';

  if(!('BarcodeDetector' in window)){
    scanStatus.textContent = 'Seu navegador não suporta leitura automática. Digite o código manualmente.';
    return;
  }

  try{
    if(!barcodeDetector){
      barcodeDetector = new BarcodeDetector({
        formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code']
      });
    }
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    scanVideo.srcObject = scanStream;
    await scanVideo.play();
    scanLoop();
  }catch(err){
    scanStatus.textContent = 'Não foi possível acessar a câmera. Verifique as permissões ou digite manualmente.';
  }
}

let scanRAF;
async function scanLoop(){
  if(!scanStream) return;
  try{
    const codes = await barcodeDetector.detect(scanVideo);
    if(codes.length > 0){
      const value = codes[0].rawValue;
      stopScanner();
      document.getElementById('barcode').value = value;
      toast('Código lido: ' + value);
      return;
    }
  }catch(err){ /* ignora frame inválido */ }
  scanRAF = requestAnimationFrame(scanLoop);
}

function stopScanner(){
  cancelAnimationFrame(scanRAF);
  if(scanStream){
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
  modalScan.classList.add('hidden');
}

/* ================== Ação rápida: baixa do item ================== */
const modalAction = document.getElementById('modalAction');
let actionTargetId = null;

function openActionSheet(id){
  actionTargetId = id;
  const item = items.find(i => i.id === id);
  if(!item) return;
  document.getElementById('actionItemName').textContent = item.nome;
  modalAction.classList.remove('hidden');
}
document.getElementById('closeAction').addEventListener('click', () => modalAction.classList.add('hidden'));

// long-press/click no item abre ação rápida; clique no texto "editar" abre form.
// Para simplicidade: clique no card abre ação; adicionamos botão de editar dentro do sheet de ação via duplo uso.
document.querySelectorAll('.action-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    const reason = btn.dataset.reason;
    finalizeItem(actionTargetId, reason);
  });
});

function finalizeItem(id, reason){
  const item = items.find(i => i.id === id);
  if(!item) return;

  history.push({
    id: uid(),
    nome: item.nome,
    categoria: item.categoria,
    quantidade: item.quantidade,
    unidadeMedida: item.unidadeMedida,
    preco: item.preco,
    validade: item.validade,
    motivo: reason, // vendido | promocao | perda
    data: new Date().toISOString(),
  });
  saveHistory();

  items = items.filter(i => i.id !== id);
  saveItems();
  modalAction.classList.add('hidden');
  renderList();

  const msgs = { vendido: 'Saída registrada', promocao: 'Venda com desconto registrada', perda: 'Perda registrada' };
  toast(msgs[reason] || 'Item baixado');
}

// Permitir editar a partir do action sheet com um clique longo seria ideal,
// mas para manter simples: adicionar botão "Editar" no topo do sheet via JS.
(function addEditButtonToActionSheet(){
  const head = document.querySelector('#modalAction .modal-head');
  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.style.marginRight = '8px';
  editBtn.title = 'Editar item';
  editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  editBtn.addEventListener('click', () => {
    modalAction.classList.add('hidden');
    openEditItemForm(actionTargetId);
  });
  head.insertBefore(editBtn, head.querySelector('h2'));
})();

/* ================== Exportar / Importar ================== */
document.getElementById('btnExport').addEventListener('click', () => {
  const payload = { items, history, exportadoEm: new Date().toISOString() };
  downloadFile('validade-backup.json', JSON.stringify(payload, null, 2), 'application/json');
  menuPanel.classList.add('hidden');
  toast('Backup exportado');
});

document.getElementById('btnExportCsv').addEventListener('click', () => {
  const header = ['Nome','Codigo de Barras','Categoria','Unidade','Quantidade','Preco','Validade','Local','Observacoes'];
  const rows = items.map(i => [
    i.nome, i.codigoBarras, i.categoria, i.unidadeMedida, i.quantidade, i.preco, i.validade, i.local, i.observacoes
  ]);
  const csv = [header, ...rows].map(r =>
    r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(';')
  ).join('\n');
  downloadFile('validade-itens.csv', '\uFEFF' + csv, 'text/csv');
  menuPanel.classList.add('hidden');
  toast('Planilha exportada');
});

function downloadFile(filename, content, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try{
      const data = JSON.parse(ev.target.result);
      const incoming = Array.isArray(data) ? data : (data.items || []);
      if(!Array.isArray(incoming)) throw new Error('formato inválido');

      const existingIds = new Set(items.map(i => i.id));
      let added = 0;
      incoming.forEach(it => {
        if(!it.id || existingIds.has(it.id)) it.id = uid();
        if(!it.nome || !it.validade) return;
        items.push(it);
        added++;
      });
      if(data.history && Array.isArray(data.history)){
        history = history.concat(data.history);
        saveHistory();
      }
      saveItems();
      renderList();
      toast(`${added} item(ns) importado(s)`);
    }catch(err){
      alert('Não foi possível importar este arquivo. Verifique se é um backup válido.');
    }
    e.target.value = '';
    menuPanel.classList.add('hidden');
  };
  reader.readAsText(file);
});

/* ================== Apagar tudo ================== */
document.getElementById('btnClearAll').addEventListener('click', () => {
  if(confirm('Isso vai apagar TODOS os itens e o histórico. Deseja continuar?')){
    items = []; history = [];
    saveItems(); saveHistory();
    renderList();
    menuPanel.classList.add('hidden');
    toast('Todos os dados foram apagados');
  }
});

/* ================== Relatório de perdas ================== */
document.getElementById('btnReport').addEventListener('click', () => {
  renderReport();
  document.getElementById('modalReport').classList.remove('hidden');
  menuPanel.classList.add('hidden');
});
document.getElementById('closeReport').addEventListener('click', () => document.getElementById('modalReport').classList.add('hidden'));

function renderReport(){
  const body = document.getElementById('reportBody');
  if(history.length === 0){
    body.innerHTML = '<p class="report-empty">Ainda não há registros de baixa de itens. Quando você marcar itens como vendidos ou perdidos, eles aparecerão aqui.</p>';
    return;
  }

  const perdas = history.filter(h => h.motivo === 'perda');
  const promocao = history.filter(h => h.motivo === 'promocao');
  const vendidos = history.filter(h => h.motivo === 'vendido');

  const valorPerdido = perdas.reduce((s,h) => s + (h.preco||0) * (h.quantidade||0), 0);
  const valorPromocao = promocao.reduce((s,h) => s + (h.preco||0) * (h.quantidade||0), 0);

  const porCategoria = {};
  perdas.forEach(h => {
    const cat = h.categoria || 'Sem categoria';
    porCategoria[cat] = (porCategoria[cat]||0) + (h.preco||0)*(h.quantidade||0);
  });
  const catRows = Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]).slice(0,8);

  body.innerHTML = `
    <div class="report-stat-grid">
      <div class="report-stat"><div class="num" style="color:var(--red)">${perdas.length}</div><div class="label">itens perdidos</div></div>
      <div class="report-stat"><div class="num" style="color:var(--red)">${formatMoney(valorPerdido)}</div><div class="label">prejuízo total</div></div>
      <div class="report-stat"><div class="num" style="color:var(--amber)">${promocao.length}</div><div class="label">vendidos c/ desconto</div></div>
      <div class="report-stat"><div class="num" style="color:var(--green)">${vendidos.length}</div><div class="label">saídas normais</div></div>
    </div>
    <div class="report-section">
      <h3>Perdas por categoria</h3>
      ${catRows.length ? catRows.map(([cat,val]) => `
        <div class="report-row"><span>${escapeHtml(cat)}</span><span style="color:var(--red)">${formatMoney(val)}</span></div>
      `).join('') : '<p class="report-empty">Sem dados de perda ainda.</p>'}
    </div>
  `;
}

function formatMoney(v){
  return 'R$ ' + v.toFixed(2).replace('.', ',');
}

/* ================== Dicas ================== */
document.getElementById('btnTips').addEventListener('click', () => {
  document.getElementById('modalTips').classList.remove('hidden');
  menuPanel.classList.add('hidden');
});
document.getElementById('closeTips').addEventListener('click', () => document.getElementById('modalTips').classList.add('hidden'));

/* ================== Service worker / PWA ================== */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* ================== Notificação local diária (opcional, best-effort) ================== */
function checkAndNotify(){
  if(!('Notification' in window)) return;
  const urgentCount = items.filter(i => { const u = urgencyOf(i); return u==='vermelho'||u==='vencido'; }).length;
  if(urgentCount === 0) return;
  if(Notification.permission === 'granted'){
    // Evita spam: só notifica uma vez por dia
    const lastNotif = localStorage.getItem('lastNotifDate');
    const today = new Date().toDateString();
    if(lastNotif !== today){
      new Notification('Itens urgentes no estoque', {
        body: `${urgentCount} item(ns) vencendo ou vencido(s). Abra o app para revisar.`,
        icon: 'icons/icon-192.png'
      });
      localStorage.setItem('lastNotifDate', today);
    }
  }
}

/* ================== Init ================== */
renderList();
setTimeout(checkAndNotify, 1500);
