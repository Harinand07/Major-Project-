/* explorer.js — mock data and simple renderers for the frontend-only explorer */

(function(){
  function randHex(len){ const chars = '0123456789abcdef'; let s=''; for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)]; return s; }

  const blocks = JSON.parse(localStorage.getItem('blockchainBlocks') || '[]');
  let transactions = JSON.parse(localStorage.getItem('blockchainTransactions') || '[]');
  let mempool = JSON.parse(localStorage.getItem('blockchainMempool') || '[]');
  let mempoolTimestamps = JSON.parse(localStorage.getItem('mempoolTimestamps') || '{}');

  /* Blocks: schema only — no mock data instantiated */
  /* MemPool: schema only — no mock data instantiated */

  function fmtTime(ts){ try{ const d = new Date(ts*1000); return d.toLocaleString(); }catch(e){return ts} }

  function renderBlocksTable(){ const tbody = document.querySelector('#blocksTable tbody'); if(!tbody) return; tbody.innerHTML = ''; blocks.forEach(b=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td><a href="blocks.html?height=${b.height}">${b.height}</a></td><td class="mono">${b.hash.slice(0,48)}…</td><td>${b.tx}</td><td>${b.size}</td><td>${fmtTime(b.time)}</td>`; tbody.appendChild(tr); }); }

  function renderMempool(){ const tbody = document.querySelector('#mempoolTable tbody'); if(!tbody) return; tbody.innerHTML = ''; mempool.forEach(m=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td class="mono">${m.id}</td><td>${m.amount}</td><td>${m.status}</td>`; tbody.appendChild(tr); }); }

  function saveMempoolToStorage(){ localStorage.setItem('blockchainMempool', JSON.stringify(mempool)); }
  
  function saveTransactionsToStorage(){ localStorage.setItem('blockchainTransactions', JSON.stringify(transactions)); }
  
  function saveMempoolTimestamps(){ localStorage.setItem('mempoolTimestamps', JSON.stringify(mempoolTimestamps)); }
  
  function saveBlocksToStorage(){ localStorage.setItem('blockchainBlocks', JSON.stringify(blocks)); }
  
  // Process pending transactions - move to confirmed if 5+ seconds old
  function processPendingTransactions(){
    const now = Date.now();
    const toConfirm = [];
    
    for(let i = mempool.length - 1; i >= 0; i--){
      const tx = mempool[i];
      const createdAt = mempoolTimestamps[tx.id] || now;
      
      if(now - createdAt >= 5000){
        toConfirm.push(tx);
        mempool.splice(i, 1);
        delete mempoolTimestamps[tx.id];
      }
    }
    
    toConfirm.forEach(tx => {
      transactions.push({
        hash: tx.id,
        block: Math.floor(Math.random() * 100000) + 800000,
        fee: '0.001',
        size: Math.floor(Math.random() * 500) + 100,
        status: 'confirmed',
        inputs: [{addr: 'unknown', amt: parseFloat(tx.amount)}],
        outputs: [{addr: 'unknown', amt: parseFloat(tx.amount)}],
        eta: 'Confirmed'
      });
    });
    
    if(toConfirm.length > 0){
      saveMempoolToStorage();
      saveMempoolTimestamps();
      saveTransactionsToStorage();
    }
  }

  // Mining function - creates blocks from mempool transactions
  function mineBlock(){
    if(mempool.length === 0) return; // No transactions to mine
    
    const blockHeight = blocks.length;
    const prevHash = blockHeight > 0 ? blocks[blockHeight - 1].hash : '0000000000000000000000000000000000000000000000000000000000000000';
    
    // Get transactions to include in block (up to 10 per block)
    const txsToMine = mempool.splice(0, Math.min(10, mempool.length));
    const txIds = txsToMine.map(tx => tx.id);
    
    // Remove timestamps for mined transactions
    txIds.forEach(id => delete mempoolTimestamps[id]);
    
    // Create block
    const block = {
      height: blockHeight,
      hash: randHex(64),
      prev: prevHash,
      tx: txsToMine.length,
      size: txsToMine.length * 250 + 80, // Approximate block size
      merkle: randHex(64), // Simplified merkle root
      nonce: Math.floor(Math.random() * 1000000000),
      time: Math.floor(Date.now() / 1000),
      transactions: txIds
    };
    
    // Add block to blockchain
    blocks.push(block);
    
    // Move transactions to confirmed status
    txsToMine.forEach(tx => {
      transactions.push({
        hash: tx.id,
        block: blockHeight,
        fee: '0.001',
        size: Math.floor(Math.random() * 500) + 100,
        status: 'confirmed',
        inputs: [{addr: 'unknown', amt: parseFloat(tx.amount)}],
        outputs: [{addr: 'unknown', amt: parseFloat(tx.amount)}],
        eta: 'Confirmed'
      });
    });
    
    // Save everything
    saveBlocksToStorage();
    saveMempoolToStorage();
    saveMempoolTimestamps();
    saveTransactionsToStorage();
    
    console.log(`✓ Block #${blockHeight} mined with ${txsToMine.length} transactions`);
  }

  function renderTransactionsList(){ const tbody = document.querySelector('#txTable tbody'); if(!tbody) return; tbody.innerHTML = ''; transactions.forEach(t=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td class="mono"><a href="transactions.html?tx=${t.hash}">${t.hash.slice(0,40)}…</a></td><td>${t.block}</td><td>${t.fee} BTC</td><td>${t.size}</td><td>${t.status}</td>`; tbody.appendChild(tr); }); }

  function renderTransactionDetail(){
    const container = document.getElementById('txDetail');
    if(!container) return;
    const params = new URLSearchParams(location.search);
    const txhash = params.get('tx');
    const tx = txhash && transactions.find(t=>t.hash===txhash) || transactions.find(t=>t.hash.startsWith(txhash||'')) || transactions[0];
    if(!tx){
      container.innerHTML = '<p class="muted">Transaction schema (no data).</p><table class="detail-table"><tr><th>Tx Hash</th><td>—</td></tr><tr><th>Block Height</th><td>—</td></tr><tr><th>Status</th><td>—</td></tr><tr><th>Transaction Fee</th><td>—</td></tr><tr><th>Transaction Size</th><td>—</td></tr><tr><th>ETA</th><td>—</td></tr></table><div class="tx-io"><div class="io"><h4>Inputs</h4><p class="muted">(address, amount)</p><ul></ul></div><div class="io"><h4>Outputs</h4><p class="muted">(address, amount)</p><ul></ul></div></div>';
      return;
    }
    container.innerHTML = `<h2 class="mono">${tx.hash}</h2><table class="detail-table"><tr><th>Block Height</th><td>${tx.block}</td></tr><tr><th>Status</th><td>${tx.status}</td></tr><tr><th>Transaction Fee</th><td>${tx.fee} BTC</td></tr><tr><th>Transaction Size</th><td>${tx.size}</td></tr><tr><th>ETA</th><td>${tx.eta}</td></tr></table><div class="tx-io"><div class="io"><h4>Inputs</h4><ul>${tx.inputs.map(i=>`<li><span class="mono">${i.addr}</span> — ${i.amt} BTC</li>`).join('')}</ul></div><div class="io"><h4>Outputs</h4><ul>${tx.outputs.map(o=>`<li><span class="mono">${o.addr}</span> — ${o.amt} BTC</li>`).join('')}</ul></div></div>`;
  }

  function renderBlockDetail(){
    const params = new URLSearchParams(location.search);
    const h = params.get('height');
    const container = document.querySelector('.page .card');
    if(!container) return;
    const b = h ? blocks.find(x=>String(x.height)===String(h)) : null;
    if(!b){
      if(h) container.innerHTML = '<p class="muted">Block schema (no data).</p><div class="block-card mono"><div><strong>Hash</strong><div>—</div></div><div><strong>Previous Block Hash</strong><div>—</div></div><div><strong>Total Transactions</strong><div>—</div></div><div><strong>Block Size</strong><div>—</div></div><div><strong>Merkle Root</strong><div>—</div></div><div><strong>Nonce</strong><div>—</div></div><div><strong>Timestamp</strong><div>—</div></div>';
      return;
    }
    container.innerHTML = `<h2>BLOCK #${b.height}</h2><div class="block-card mono"><div><strong>Hash</strong><div class="mono">${b.hash}</div></div><div><strong>Previous Block Hash</strong><div class="mono">${b.prev}</div></div><div><strong>Total Transactions</strong><div>${b.tx}</div></div><div><strong>Block Size</strong><div>${b.size}</div></div><div><strong>Merkle Root</strong><div class="mono">${b.merkle}</div></div><div><strong>Nonce</strong><div>${b.nonce}</div></div><div><strong>Timestamp</strong><div>${fmtTime(b.time)}</div></div></div>`;
  }

  function wireWallet(){
    const btn = document.getElementById('sendBtn');
    const mineBtn = document.getElementById('mineBtn');
    const clearBtn = document.getElementById('clearDataBtn');
    
    if(mineBtn){
      mineBtn.addEventListener('click', ()=>{
        if(mempool.length === 0){
          alert('No transactions in mempool to mine!');
          return;
        }
        mineBlock();
        renderBlocksTable();
        renderMempool();
        renderTransactionsList();
        alert(`✓ Block mined! ${mempool.length} transactions remaining in mempool.`);
      });
    }
    
    if(clearBtn){
      clearBtn.addEventListener('click', ()=>{
        if(confirm('Clear all blockchain data? This cannot be undone.')){
          localStorage.removeItem('blockchainTransactions');
          localStorage.removeItem('blockchainMempool');
          localStorage.removeItem('blockchainBlocks');
          localStorage.removeItem('walletTransactions');
          localStorage.removeItem('mempoolTimestamps');
          transactions = [];
          mempool = [];
          blocks.length = 0;
          mempoolTimestamps = {};
          renderTransactionsList();
          renderMempool();
          renderBlocksTable();
          alert('All data cleared!');
          location.reload();
        }
      });
    }
    
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      const from = document.getElementById('fromAddr').value || '';
      const to = document.getElementById('toAddr').value || '';
      const amt = document.getElementById('amount').value || '';
      
      // Validate inputs
      if(!from.trim()){ alert('Error: From address required'); return; }
      if(!to.trim()){ alert('Error: To address required'); return; }
      if(!amt || isNaN(amt) || parseFloat(amt) <= 0){ alert('Error: Valid amount required'); return; }
      if(from === to){ alert('Error: Cannot send to same address'); return; }
      
      // Validate address format (basic Bitcoin address validation)
      const addrRegex = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/;
      if(!addrRegex.test(from)){ alert('Error: Invalid from address'); return; }
      if(!addrRegex.test(to)){ alert('Error: Invalid to address'); return; }
      
      // Create transaction object
      const tx = {
        id: randHex(64),
        from: from,
        to: to,
        amount: parseFloat(amt),
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
        fee: (parseFloat(amt) * 0.001).toFixed(8)
      };
      
      // Save to localStorage
      let txHistory = JSON.parse(localStorage.getItem('walletTransactions') || '[]');
      txHistory.push(tx);
      localStorage.setItem('walletTransactions', JSON.stringify(txHistory));
      
      // Update mempool
      const txId = tx.id;
      mempool.push({
        id: txId,
        amount: `${tx.amount} BTC`,
        status: 'pending'
      });
      mempoolTimestamps[txId] = Date.now();
      saveMempoolToStorage();
      saveMempoolTimestamps();
      
      // Simulate confirmation after 5 seconds (local timeout as backup)
      setTimeout(() => {
        processPendingTransactions();
        renderMempool();
        renderTransactionsList();
      }, 5000);
      
      alert(`✓ Transaction Created\n\nTx ID: ${tx.id.slice(0,32)}…\nAmount: ${tx.amount} BTC\nFee: ${tx.fee} BTC\nStatus: ${tx.status}\n\nTransaction broadcasted to mempool.`);
      
      // Clear form
      document.getElementById('fromAddr').value = '';
      document.getElementById('toAddr').value = '';
      document.getElementById('amount').value = '';
      
      renderMempool();
      saveMempoolToStorage();
    });
  }

  function createSearchOverlay(results, query){ let existing = document.getElementById('searchResults'); if(existing) existing.remove(); const overlay = document.createElement('div'); overlay.id = 'searchResults'; overlay.className = 'search-results'; const header = document.createElement('div'); header.className = 'sr-header'; header.innerHTML = `<strong>Search results for "${query}"</strong>`; const close = document.createElement('button'); close.className = 'sr-close'; close.textContent = 'Close'; close.onclick = ()=>overlay.remove(); header.appendChild(close); overlay.appendChild(header); const list = document.createElement('div'); list.className = 'sr-list'; if(!results.length){ list.innerHTML = '<div class="sr-none">No results</div>'; } else { results.forEach(r=>{ const a = document.createElement('a'); a.className = 'sr-item'; a.href = r.href; a.innerHTML = `<span class="sr-type">${r.type}</span> ${r.text}`; list.appendChild(a); }); } overlay.appendChild(list); document.body.appendChild(overlay); }

  function performSearch(q){ q = (q||'').trim(); if(!q) return createSearchOverlay([], q); const results = []; const qlow = q.toLowerCase(); blocks.forEach(b=>{ if(String(b.height)===q || b.hash.toLowerCase().includes(qlow)) results.push({ type: 'Block', text: `#${b.height} — ${b.hash.slice(0,28)}…`, href: `blocks.html?height=${b.height}` }); }); transactions.forEach(t=>{ if(t.hash.toLowerCase().includes(qlow) || t.inputs.some(i=>i.addr.toLowerCase().includes(qlow)) || t.outputs.some(o=>o.addr.toLowerCase().includes(qlow)) ) results.push({ type: 'Transaction', text: `${t.hash.slice(0,36)}…`, href: `transactions.html?tx=${t.hash}` }); }); mempool.forEach(m=>{ if(m.id.toLowerCase().includes(qlow)) results.push({ type: 'MemPool', text: `${m.id} ${m.amount}`, href: 'mempool.html' }); }); createSearchOverlay(results, q); }

  // Auto-refresh every 500ms to catch confirmed transactions in real-time
  setInterval(()=>{
    transactions = JSON.parse(localStorage.getItem('blockchainTransactions') || '[]');
    mempool = JSON.parse(localStorage.getItem('blockchainMempool') || '[]');
    mempoolTimestamps = JSON.parse(localStorage.getItem('mempoolTimestamps') || '{}');
    processPendingTransactions();
    renderTransactionsList();
    renderMempool();
    renderBlocksTable();
  }, 500);

  // Mining interval - mine blocks every 10 seconds if there are transactions
  setInterval(()=>{
    mineBlock();
  }, 10000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ renderBlocksTable(); renderMempool(); renderTransactionsList(); renderTransactionDetail(); renderBlockDetail(); wireWallet(); const input = document.getElementById('searchInput') || document.querySelector('.search input'); const btn = document.getElementById('searchBtn') || document.querySelector('.search button'); if(btn && input){ btn.addEventListener('click', ()=>performSearch(input.value)); input.addEventListener('keypress', (e)=>{ if(e.key==='Enter') performSearch(input.value); }); } });
  } else {
    renderBlocksTable(); renderMempool(); renderTransactionsList(); renderTransactionDetail(); renderBlockDetail(); wireWallet(); const input = document.getElementById('searchInput') || document.querySelector('.search input'); const btn = document.getElementById('searchBtn') || document.querySelector('.search button'); if(btn && input){ btn.addEventListener('click', ()=>performSearch(input.value)); input.addEventListener('keypress', (e)=>{ if(e.key==='Enter') performSearch(input.value); }); }
  }

})();
