(function(){
  const genButtons = document.querySelectorAll('.gen-btn');
  const txTableBody = document.querySelector('#txTable tbody');
  const startBtn = document.getElementById('startExec');
  const execTimeEl = document.getElementById('execTime');
  const throughputEl = document.getElementById('throughput');
  const compText = document.getElementById('compText');

  let transactions = [];
  const history = { sequential: null, parallel: null };

  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min }

  function generateTransactions(count){
    transactions = [];
    for(let i=1;i<=count;i++){
      const type = Math.random() < 0.6 ? 'TRANSFER' : 'CONTRACT_CALL';
      transactions.push({ id: `tx-${Date.now()}-${i}`, type, status: 'Pending' });
    }
    renderTable();
  }

  function renderTable(){
    if(!txTableBody) return;
    txTableBody.innerHTML = '';
    transactions.forEach(tx =>{
      const tr = document.createElement('tr');
      const idTd = document.createElement('td'); idTd.textContent = tx.id;
      const typeTd = document.createElement('td'); typeTd.textContent = tx.type;
      const statusTd = document.createElement('td'); statusTd.textContent = tx.status;
      tr.appendChild(idTd); tr.appendChild(typeTd); tr.appendChild(statusTd);
      txTableBody.appendChild(tr);
    })
  }

  function processTransactionMock(tx){
    const delay = randInt(20, 200);
    return new Promise(resolve => setTimeout(()=>{ resolve({ tx, delay }); }, delay));
  }

  async function runSequential(txList){
    for(let tx of txList){
      tx.status = 'Running'; renderTable();
      await processTransactionMock(tx);
      tx.status = 'Committed'; renderTable();
    }
  }

  async function runParallel(txList){
    const promises = txList.map(async tx =>{
      tx.status = 'Running'; renderTable();
      await processTransactionMock(tx);
      tx.status = 'Committed'; renderTable();
    });
    return Promise.all(promises);
  }

  async function execute(mode){
    if(!transactions.length) return alert('Generate transactions first.');
    transactions.forEach(t=>t.status='Pending'); renderTable();
    const txClone = transactions.map(t=>Object.assign({}, t));
    const start = performance.now();
    if(mode === 'sequential') await runSequential(txClone); else await runParallel(txClone);
    const end = performance.now();
    const durationMs = end - start;
    const secs = Math.max(0.001, durationMs / 1000);
    const tps = (txClone.length / secs).toFixed(2);
    history[mode] = { timeMs: durationMs, tps: Number(tps), count: txClone.length };
    if(execTimeEl) execTimeEl.textContent = `${durationMs.toFixed(0)} ms`;
    if(throughputEl) throughputEl.textContent = `${tps} tx/s`;
    updateComparison();
  }

  function updateComparison(){
    if(!compText) return;
    const s = history.sequential; const p = history.parallel;
    if(!s && !p){ compText.textContent = 'Run sequential or parallel execution to see results.'; return }
    if(s && !p){ compText.textContent = `Sequential: ${s.timeMs.toFixed(0)} ms, ${s.tps} tx/s.`; return }
    if(p && !s){ compText.textContent = `Parallel: ${p.timeMs.toFixed(0)} ms, ${p.tps} tx/s.`; return }
    const faster = s.timeMs < p.timeMs ? 'Sequential' : 'Parallel';
    compText.innerHTML = `${faster} was faster.<br/>Sequential: ${s.timeMs.toFixed(0)} ms, ${s.tps} tx/s.<br/>Parallel: ${p.timeMs.toFixed(0)} ms, ${p.tps} tx/s.`;
  }

  genButtons.forEach(btn => btn.addEventListener('click', ()=>{
    const count = Number(btn.getAttribute('data-count')) || 10;
    const useApi = document.getElementById('useApi')?.checked;
    if(useApi){
      callBackendGenerate(count).catch(()=>{ generateTransactions(count); });
    } else { generateTransactions(count); }
  }));

  if(startBtn) startBtn.addEventListener('click', ()=>{
    const mode = document.querySelector('input[name="mode"]:checked').value;
    startBtn.disabled = true; startBtn.textContent = 'Running...';
    const useApi = document.getElementById('useApi')?.checked;
    if(useApi){ callBackendExecute(mode).catch(()=> execute(mode)).finally(()=>{ startBtn.disabled = false; startBtn.textContent = 'Start Execution'; });
    } else { execute(mode).finally(()=>{ startBtn.disabled = false; startBtn.textContent = 'Start Execution'; }); }
  });

  generateTransactions(10);

  async function callBackendGenerate(count){
    const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ count }) });
    if(!res.ok) throw new Error('Backend generate failed');
    const data = await res.json();
    if(Array.isArray(data.transactions)){
      transactions = data.transactions.map(t=>({ id: t.id||t.txid||t.id, type: t.type||'TRANSFER', status: t.status||'Pending' }));
      const tbody = document.querySelector('#txTable tbody'); if(tbody) tbody.innerHTML = '';
      transactions.forEach(tx =>{ const tr = document.createElement('tr'); tr.innerHTML = `<td>${tx.id}</td><td>${tx.type}</td><td>${tx.status}</td>`; document.querySelector('#txTable tbody').appendChild(tr); });
      return data;
    }
    throw new Error('Unexpected backend response');
  }

  async function callBackendExecute(mode){
    const res = await fetch('/api/execute', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ mode }) });
    if(!res.ok) throw new Error('Backend execute failed');
    const data = await res.json();
    if(data.timeMs){
      document.getElementById('execTime').textContent = `${Number(data.timeMs).toFixed(0)} ms`;
      document.getElementById('throughput').textContent = `${Number(data.tps).toFixed(2)} tx/s`;
      if(Array.isArray(data.transactions)){
        transactions = data.transactions.map(t=>({ id: t.id||t.txid, type: t.type||'TRANSFER', status: t.status||'Committed' }));
        const tbody = document.querySelector('#txTable tbody'); if(tbody) tbody.innerHTML = ''; transactions.forEach(tx =>{ const tr = document.createElement('tr'); tr.innerHTML = `<td>${tx.id}</td><td>${tx.type}</td><td>${tx.status}</td>`; tbody.appendChild(tr); });
      }
      const hist = { timeMs: Number(data.timeMs), tps: Number(data.tps), count: data.count||transactions.length };
      history[mode] = hist;
      const s = history.sequential; const p = history.parallel; const compTextEl = document.getElementById('compText');
      if(compTextEl){
        if(!s && !p) compTextEl.textContent = 'Run sequential or parallel execution to see results.';
        else if(s && !p) compTextEl.textContent = `Sequential: ${s.timeMs.toFixed(0)} ms, ${s.tps} tx/s.`;
        else if(p && !s) compTextEl.textContent = `Parallel: ${p.timeMs.toFixed(0)} ms, ${p.tps} tx/s.`;
        else { const faster = s.timeMs < p.timeMs ? 'Sequential' : 'Parallel'; compTextEl.innerHTML = `${faster} was faster.<br/>Sequential: ${s.timeMs.toFixed(0)} ms, ${s.tps} tx/s.<br/>Parallel: ${p.timeMs.toFixed(0)} ms, ${p.tps} tx/s.`; }
      }
      return data;
    }
    throw new Error('Unexpected backend execute response');
  }

  const navLinks = document.querySelectorAll('.navlinks a');
  if(navLinks && navLinks.length) navLinks.forEach(a=> a.addEventListener('click', ()=>{ document.querySelectorAll('.navlinks li').forEach(li=>li.classList.remove('active')); const li = a.closest('li'); if(li) li.classList.add('active'); }));

})();
