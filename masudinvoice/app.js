/* =========================================================
   app.js — Invoice Studio
   ---------------------------------------------------------
   The invoice itself (fields, totals, numbering, QR, PAID
   stamp, signature) and the way invoices are stored — browser
   storage plus the Firestore "invoices" collection — work the
   same as before, with the same data format.

   New here: sign-in is required, deleting needs the delete
   PIN, and saving never silently replaces another invoice.
   ========================================================= */

function setCloudChip(state){
  const chip = document.getElementById('cloudChip');
  const label = chip.querySelector('[data-role="cloud-label"]');
  const map = {
    on:    ['Cloud synced', 'chip cloud-on'],
    busy:  ['Syncing…', 'chip cloud-busy'],
    error: ['Cloud error', 'chip cloud-err'],
    off:   ['Local only', 'chip cloud-off']
  };
  const m = map[state] || map.off;
  label.textContent = m[0]; chip.className = m[1];
}
setCloudChip(firebaseEnabled ? 'on' : 'off');

/* ============ CURRENCIES ============ */
const CURRENCIES = [
  ["USD","US Dollar ($)","$"],["EUR","Euro (€)","€"],["GBP","British Pound (£)","£"],
  ["AED","UAE Dirham (د.إ)","AED "],["SAR","Saudi Riyal (﷼)","SAR "],["QAR","Qatari Riyal","QAR "],
  ["BDT","Bangladeshi Taka (৳)","৳"],["INR","Indian Rupee (₹)","₹"],["PKR","Pakistani Rupee (₨)","₨"],
  ["CAD","Canadian Dollar (C$)","C$"],["AUD","Australian Dollar (A$)","A$"],["NZD","NZ Dollar (NZ$)","NZ$"],
  ["SGD","Singapore Dollar (S$)","S$"],["MYR","Malaysian Ringgit (RM)","RM"],["JPY","Japanese Yen (¥)","¥"],
  ["CNY","Chinese Yuan (¥)","¥"],["ZAR","South African Rand (R)","R"],["EGP","Egyptian Pound (E£)","E£"],
  ["NGN","Nigerian Naira (₦)","₦"],["KES","Kenyan Shilling (KSh)","KSh"],["CHF","Swiss Franc (CHF)","CHF "],
  ["SEK","Swedish Krona (kr)","kr"],["NOK","Norwegian Krone (kr)","kr"],["DKK","Danish Krone (kr)","kr"],
  ["TRY","Turkish Lira (₺)","₺"],["THB","Thai Baht (฿)","฿"],["PHP","Philippine Peso (₱)","₱"],
  ["IDR","Indonesian Rupiah (Rp)","Rp"],["VND","Vietnamese Dong (₫)","₫"],["BRL","Brazilian Real (R$)","R$"],
  ["MXN","Mexican Peso (MX$)","MX$"],["KWD","Kuwaiti Dinar (KD)","KD"],["OMR","Omani Rial (OMR)","OMR "]
];
const sel = document.getElementById('currencySelect');
CURRENCIES.forEach(([code,label,sym])=>{
  const o=document.createElement('option'); o.value=code; o.dataset.sym=sym; o.textContent=code+' — '+label;
  sel.appendChild(o);
});
sel.value='USD';

/* ============ STATE ============ */
let currentInvoiceId = null;
let paid = false;
let paidDateStr = '';
let paidSignatureSnapshot = null; // frozen signature at time of marking paid
let cloudCache = {};              // invoice number -> data, mirrored from Firestore
let lastRenderedList = {};        // snapshot used by the modal's live search filter

const itemsBody = document.getElementById('itemsBody');
const sheet = document.getElementById('sheet');

function fmt(n){
  n = isNaN(n) ? 0 : n;
  return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function curSym(){
  const opt = sel.options[sel.selectedIndex];
  return opt ? opt.dataset.sym : '$';
}

/* ============ ROW MANAGEMENT ============ */
function addRow(desc='', qty=1, price=0){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="num">${itemsBody.children.length+1}</td>
    <td><span contenteditable="true" class="descCell" data-ph="Service description">${desc}</span></td>
    <td class="qty"><input type="number" class="qtyInput" value="${qty}" min="0" step="1"></td>
    <td class="price"><input type="number" class="priceInput" value="${price}" min="0" step="0.01"></td>
    <td class="total"><span class="rowTotal">0.00</span></td>
    <td class="rm no-print"><button type="button" class="rmbtn" title="Remove this line" aria-label="Remove this line">✕</button></td>
  `;
  itemsBody.appendChild(tr);
  tr.querySelector('.qtyInput').addEventListener('input', recalc);
  tr.querySelector('.priceInput').addEventListener('input', recalc);
  tr.querySelector('.rmbtn').addEventListener('click', ()=>{ tr.remove(); renumber(); recalc(); });
  recalc();
}
function renumber(){
  [...itemsBody.children].forEach((tr,i)=>{ tr.querySelector('.num').textContent = i+1; });
}
document.getElementById('addRowBtn').addEventListener('click', ()=>addRow());

/* ============ CALCULATIONS ============ */
function recalc(){
  const sym = curSym();
  let subtotal = 0;
  [...itemsBody.children].forEach(tr=>{
    const q = parseFloat(tr.querySelector('.qtyInput').value)||0;
    const p = parseFloat(tr.querySelector('.priceInput').value)||0;
    const t = q*p;
    tr.querySelector('.rowTotal').textContent = sym + fmt(t);
    subtotal += t;
  });
  const discount = parseFloat(document.getElementById('discountInput').value)||0;
  const grand = Math.max(subtotal - discount, 0);
  const advanceInputEl = document.getElementById('advanceInput');
  // Balance Due always reflects what was actually paid — supports partial
  // payments (e.g. $400 bill, client pays $200 → $200 still shows as due).
  const advance = parseFloat(advanceInputEl.value)||0;
  const balance = Math.max(grand - advance, 0);

  document.getElementById('subtotalVal').textContent = sym + fmt(subtotal);
  document.getElementById('grandVal').textContent = sym + fmt(grand);
  document.getElementById('balanceVal').textContent = sym + fmt(balance);

  updateStatusChip(paid, advance, balance, grand);
}

function updateStatusChip(isPaid, advance, balance, grand){
  const chip = document.getElementById('statusChip');
  if(balance <= 0 && grand > 0){
    chip.textContent = 'Paid'; chip.className = 'chip paid';
  } else if(isPaid && balance > 0){
    chip.textContent = 'Paid (Balance Due)'; chip.className = 'chip partial';
  } else if(advance > 0 && balance > 0){
    chip.textContent = 'Partially Paid'; chip.className = 'chip partial';
  } else {
    chip.textContent = 'Unpaid'; chip.className = 'chip unpaid';
  }
}
document.getElementById('discountInput').addEventListener('input', recalc);
document.getElementById('advanceInput').addEventListener('input', recalc);
sel.addEventListener('change', recalc);

/* ============ SIGNATURE ============
   Signature is embedded directly as base64 (see DEFAULT_SIGNATURE below) —
   no manual upload needed. It's applied automatically once an invoice is
   marked as Paid. */
const SIG_KEY = 'masudSavedSignature';
// DEFAULT_SIGNATURE lives in signature-data.js
function getSavedSignature(){ return localStorage.getItem(SIG_KEY) || DEFAULT_SIGNATURE; }
function renderSignature(){
  const slot = document.getElementById('sigSlot');
  if(paid && paidSignatureSnapshot){
    slot.innerHTML = `<img src="${paidSignatureSnapshot}" alt="Signature">`;
  } else if(paid && !paidSignatureSnapshot){
    slot.innerHTML = `<div class="sig-pending">No signature uploaded yet</div>`;
  } else {
    slot.innerHTML = `<div class="sig-pending">Signature appears once marked Paid</div>`;
  }
}

/* ============ QR VERIFICATION ============
   Encodes a link to your verification page on masudppc.com, e.g.:
   https://masudppc.com/verify.html?inv=MPPC-2026-0001
   The verify page looks the invoice up live in the same Firestore
   database this tool saves to — so the QR only resolves to something
   meaningful AFTER the invoice has been saved (see btnSave).
*/
const VERIFY_BASE_URL = "https://masudppc.com/verify.html";
function updateQR(){
  const invNum = document.getElementById('invNum').textContent.trim();
  const img = document.getElementById('qrImg');
  if(!invNum){ img.src=''; return; }
  const verifyUrl = VERIFY_BASE_URL + '?inv=' + encodeURIComponent(invNum);
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=' + encodeURIComponent(verifyUrl);
  img.title = 'Verify at: ' + verifyUrl;
}
document.getElementById('invNum').addEventListener('blur', updateQR);


/* ============ PAID TOGGLE ============ */
function setPaid(state){
  paid = state;
  if(paid){
    if(!paidDateStr){
      const d = new Date();
      paidDateStr = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    }
    paidSignatureSnapshot = getSavedSignature();
    document.getElementById('paidDate').textContent = paidDateStr;
    sheet.classList.add('is-paid');
  } else {
    sheet.classList.remove('is-paid');
  }
  document.querySelectorAll('[data-act="paid"]').forEach(btn=>{
    btn.classList.toggle('is-paid', paid);
    btn.querySelector('use').setAttribute('href', paid ? '#i-undo' : '#i-check');
    const long = btn.querySelector('[data-role="paid-label"]');
    const short = btn.querySelector('[data-role="paid-label-short"]');
    if(long) long.textContent = paid ? 'Mark as unpaid' : 'Mark as paid';
    if(short) short.textContent = paid ? 'Unpaid' : 'Paid';
  });
  renderSignature();
  recalc();
}
async function togglePaid(){
  if(!paid){ setPaid(true); UI.toast('Marked as paid. Save to keep the change.'); return; }
  const ok = await UI.confirm({
    title:'Mark as unpaid?',
    text:'The PAID stamp and signature will be hidden on this invoice.',
    okLabel:'Mark as unpaid'
  });
  if(ok){ paidDateStr=''; setPaid(false); }
}

/* ============ SERIALIZE / DESERIALIZE ============ */
function serializeInvoice(){
  const infoVs = [...document.querySelectorAll('.info-col .v')].map(el=>el.innerHTML);
  const items = [...itemsBody.children].map(tr=>({
    desc: tr.querySelector('.descCell').innerHTML,
    qty: tr.querySelector('.qtyInput').value,
    price: tr.querySelector('.priceInput').value,
  }));
  const notes = [...document.querySelectorAll('#notesList span')].map(s=>s.innerHTML);
  return {
    invNum: document.getElementById('invNum').textContent.trim(),
    infoVs, items, notes,
    currency: sel.value,
    discount: document.getElementById('discountInput').value,
    advance: document.getElementById('advanceInput').value,
    paid, paidDateStr,
    signature: paidSignatureSnapshot,
    savedAt: new Date().toISOString()
  };
}
function loadInvoiceData(data){
  document.getElementById('invNum').textContent = data.invNum || '';
  const infoEls = [...document.querySelectorAll('.info-col .v')];
  (data.infoVs||[]).forEach((html,i)=>{ if(infoEls[i]) infoEls[i].innerHTML = html; });

  itemsBody.innerHTML='';
  (data.items||[]).forEach(it=>addRow(it.desc, it.qty, it.price));
  if(!data.items || data.items.length===0) addRow();

  const notesEls = [...document.querySelectorAll('#notesList span')];
  (data.notes||[]).forEach((html,i)=>{ if(notesEls[i]) notesEls[i].innerHTML = html; });

  sel.value = data.currency || 'USD';
  document.getElementById('discountInput').value = data.discount || 0;
  document.getElementById('advanceInput').value = data.advance || 0;

  paidDateStr = data.paidDateStr || '';
  paidSignatureSnapshot = data.signature || null;
  setPaid(!!data.paid);
  recalc();
  updateQR();
}

/* ============ LOCAL STORAGE LAYER ============ */
const LIST_KEY = 'masudInvoicesList';
function getLocalInvoices(){
  try{ return JSON.parse(localStorage.getItem(LIST_KEY)) || {}; }catch(e){ return {}; }
}
function saveLocalInvoices(obj){ localStorage.setItem(LIST_KEY, JSON.stringify(obj)); }

/* ============ CLOUD (FIRESTORE) LAYER ============ */
let lastCloudError = null;
// Resolves true when the invoice reached the cloud, false otherwise.
async function cloudSave(invNum, data){
  if(!firebaseEnabled) return false;
  try{
    setCloudChip('busy');
    await db.collection('invoices').doc(invNum).set(data);
    setCloudChip('on');
    return true;
  }catch(e){
    console.warn('Cloud save failed:', e);
    lastCloudError = e; setCloudChip('error');
    return false;
  }
}
async function cloudDelete(invNum){
  if(!firebaseEnabled) return true;
  try{ await db.collection('invoices').doc(invNum).delete(); return true; }
  catch(e){ console.warn('Cloud delete failed:', e); lastCloudError = e; return false; }
}
async function cloudFetchAll(){
  if(!firebaseEnabled) return {};
  try{
    setCloudChip('busy');
    const snap = await db.collection('invoices').get();
    const out = {};
    snap.forEach(doc=>{ out[doc.id] = doc.data(); });
    setCloudChip('on'); lastCloudError = null;
    return out;
  }catch(e){
    console.warn('Cloud fetch failed:', e);
    lastCloudError = e; setCloudChip('error');
    return {};
  }
}
// Resolves the invoice, null if there is none, or throws if the cloud could not be asked.
async function cloudFetchOne(invNum){
  if(!firebaseEnabled) return null;
  const doc = await db.collection('invoices').doc(invNum).get();
  return doc.exists ? doc.data() : null;
}
function cloudErrorText(){
  const e = lastCloudError;
  if(e && e.code === 'permission-denied') return 'The cloud refused access. Check the Firestore rules (see README.md).';
  return 'The cloud could not be reached. Check your connection.';
}

/* Merge local + cloud (cloud wins on conflict if it's newer) */
function mergeInvoices(localObj, cloudObj){
  const merged = {...localObj};
  Object.keys(cloudObj).forEach(k=>{
    const c = cloudObj[k], l = merged[k];
    if(!l || new Date(c.savedAt) >= new Date(l.savedAt)) merged[k] = c;
  });
  return merged;
}
async function getAllInvoicesMerged(){
  const local = getLocalInvoices();
  cloudCache = await cloudFetchAll();
  return mergeInvoices(local, cloudCache);
}

/* ============ SAVE ============ */
async function saveInvoice(){
  const data = serializeInvoice();
  if(!data.invNum){ UI.toast('Set an invoice number before saving.', 'error'); return; }

  // Never silently replace a different saved invoice that has the same number.
  if(data.invNum !== currentInvoiceId){
    const local = getLocalInvoices();
    let exists = !!local[data.invNum], unsure = false;
    if(!exists && firebaseEnabled){
      try{ exists = !!(await cloudFetchOne(data.invNum)); }catch(e){ unsure = true; lastCloudError = e; }
    }
    if(exists || unsure){
      const ok = await UI.confirm({
        title: exists ? 'Replace invoice #' + data.invNum + '?' : 'Could not check the cloud',
        text: exists
          ? 'An invoice with this number is already saved. Saving now will replace it.'
          : 'The app could not check whether invoice #' + data.invNum + ' already exists in the cloud. Saving may replace it.',
        okLabel: exists ? 'Replace it' : 'Save anyway',
        danger: true
      });
      if(!ok) return;
    }
  }

  const local = getLocalInvoices();
  local[data.invNum] = data;
  saveLocalInvoices(local);
  currentInvoiceId = data.invNum;
  updateQR();
  const synced = await cloudSave(data.invNum, data);
  if(synced) UI.toast('Invoice #' + data.invNum + ' saved. The QR code is now verifiable.');
  else UI.toast('Invoice #' + data.invNum + ' saved on this device only. ' + cloudErrorText(), 'error');
}

/* ============ SAVED INVOICES + SEARCH ============ */
async function openSavedInvoices(){
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('invListArea').innerHTML = '<div class="empty-hint">Loading…</div>';
  document.getElementById('modalSearch').value = '';
  lastRenderedList = await getAllInvoicesMerged();
  renderInvoiceList(lastRenderedList);
  if(lastCloudError) UI.toast('Showing invoices saved on this device. ' + cloudErrorText(), 'error');
}
function closeSavedInvoices(){ document.getElementById('modalOverlay').classList.remove('show'); }
document.getElementById('modalClose').addEventListener('click', closeSavedInvoices);
document.getElementById('modalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='modalOverlay') closeSavedInvoices();
});
document.getElementById('modalSearch').addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  if(!q){ renderInvoiceList(lastRenderedList); return; }
  const filtered = {};
  Object.keys(lastRenderedList).forEach(k=>{
    const inv = lastRenderedList[k];
    const name = plainText((inv.infoVs||[])[0]).toLowerCase();
    if(k.toLowerCase().includes(q) || name.includes(q)) filtered[k] = inv;
  });
  renderInvoiceList(filtered);
});

function plainText(html){
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').trim();
}

function invoiceStatusLabel(inv){
  let subtotal = 0;
  (inv.items||[]).forEach(it=>{
    const q = parseFloat(it.qty)||0, p = parseFloat(it.price)||0;
    subtotal += q*p;
  });
  const discount = parseFloat(inv.discount)||0;
  const grand = Math.max(subtotal - discount, 0);
  const advance = parseFloat(inv.advance)||0;
  const balance = Math.max(grand - advance, 0);

  if(balance <= 0 && grand > 0) return 'Paid';
  if(inv.paid && balance > 0) return 'Paid (Balance Due)';
  if(advance > 0 && balance > 0) return 'Partially Paid';
  return 'Unpaid';
}

function invoiceTotalLabel(inv){
  let subtotal = 0;
  (inv.items||[]).forEach(it=>{ subtotal += (parseFloat(it.qty)||0) * (parseFloat(it.price)||0); });
  const grand = Math.max(subtotal - (parseFloat(inv.discount)||0), 0);
  const cur = CURRENCIES.find(c=>c[0]===inv.currency);
  return (cur ? cur[2] : '') + fmt(grand);
}
const STATUS_CLASS = {'Paid':'paid','Paid (Balance Due)':'partial','Partially Paid':'partial','Unpaid':'unpaid'};

function renderInvoiceList(all){
  const area = document.getElementById('invListArea');
  const keys = Object.keys(all).sort((a,b)=> new Date(all[b].savedAt) - new Date(all[a].savedAt));
  if(keys.length===0){
    area.innerHTML = '<div class="empty-hint">No invoices found. Save one and it will appear here.</div>';
    return;
  }
  area.innerHTML = keys.map(k=>{
    const inv = all[k];
    const clientName = plainText((inv.infoVs||[])[0]) || 'No client name';
    const statusTxt = invoiceStatusLabel(inv);
    return `<div class="inv-list-item">
      <div class="meta">
        <span class="n">${escapeHtmlLocal(clientName)}</span>
        <span class="d">#${escapeHtmlLocal(k)} · saved ${new Date(inv.savedAt).toLocaleDateString()}</span>
      </div>
      <div class="amt">
        <span class="a">${escapeHtmlLocal(invoiceTotalLabel(inv))}</span>
        <span class="chip sm ${STATUS_CLASS[statusTxt]||'unpaid'}">${statusTxt}</span>
      </div>
      <div class="acts">
        <button type="button" class="btn-open" data-k="${escapeHtmlLocal(k)}">Open</button>
        <button type="button" class="btn-del" data-k="${escapeHtmlLocal(k)}" aria-label="Delete invoice ${escapeHtmlLocal(k)}">${UI.icon('trash')}</button>
      </div>
    </div>`;
  }).join('');
  area.querySelectorAll('.btn-open').forEach(b=>b.addEventListener('click', ()=>{
    loadInvoiceData(all[b.dataset.k]);
    currentInvoiceId = b.dataset.k;
    closeSavedInvoices();
  }));
  area.querySelectorAll('.btn-del').forEach(b=>b.addEventListener('click', ()=>deleteInvoice(b.dataset.k)));
}

/* ============ DELETE (needs the delete PIN) ============ */
async function deleteInvoice(k){
  const ok = await MPPin.confirmDelete('Delete invoice #' + k + '? This cannot be undone.');
  if(!ok || !MPPin.recentlyVerified()) return;
  const cloudOk = await cloudDelete(k);
  if(!cloudOk){
    UI.toast('Invoice #' + k + ' was not deleted. ' + cloudErrorText(), 'error');
    return;
  }
  const local = getLocalInvoices();
  delete local[k];
  saveLocalInvoices(local);
  delete lastRenderedList[k];
  if(currentInvoiceId === k) currentInvoiceId = null;
  renderInvoiceList(lastRenderedList);
  UI.toast('Invoice #' + k + ' deleted.');
}
function escapeHtmlLocal(s){
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

/* ============ PROFESSIONAL INVOICE NUMBERING ============
   Format: MPPC-YYYY-0001  (brand prefix - year - 4-digit sequence, auto-incrementing per year)
*/
async function nextInvoiceNumber(){
  const year = new Date().getFullYear();
  const prefix = 'MPPC-' + year + '-';
  const merged = await getAllInvoicesMerged();
  const nums = Object.keys(merged)
    .filter(k=>k.indexOf(prefix)===0)
    .map(k=>parseInt(k.slice(prefix.length),10))
    .filter(n=>!isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(4,'0');
}

/* ============ NEW INVOICE ============ */
async function newInvoice(){
  const ok = await UI.confirm({
    title:'Start a new invoice?',
    text:'Changes to the current invoice that you have not saved will be lost.',
    okLabel:'Start new'
  });
  if(!ok) return;
  document.getElementById('invNum').textContent = await nextInvoiceNumber();
  [...document.querySelectorAll('.info-col .v')].forEach(el=>el.innerHTML='');
  itemsBody.innerHTML=''; addRow();
  document.getElementById('discountInput').value=0;
  document.getElementById('advanceInput').value=0;
  paidDateStr=''; paidSignatureSnapshot=null;
  setPaid(false);
  setToday();
  recalc();
  updateQR();
  currentInvoiceId=null;
}

/* ============ ACTION BUTTONS (top bar + phone bottom bar) ============ */
const ACTIONS = { new:newInvoice, save:saveInvoice, open:openSavedInvoices, paid:togglePaid, print:()=>window.print() };
document.querySelectorAll('[data-act]').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    if(btn.disabled) return;
    btn.disabled = true;
    try{ await ACTIONS[btn.dataset.act](); } finally { btn.disabled = false; }
  });
});

/* ============ MENU ============ */
const menuBtn = document.getElementById('menuBtn'), menu = document.getElementById('menu');
function closeMenu(){ menu.hidden = true; menuBtn.setAttribute('aria-expanded','false'); }
menuBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', (e)=>{ if(!menu.hidden && !menu.contains(e.target)) closeMenu(); });
menu.addEventListener('click', (e)=>{ if(e.target.closest('button')) closeMenu(); });
document.getElementById('menuPin').addEventListener('click', ()=>MPPin.openManage());
document.getElementById('menuLogout').addEventListener('click', async ()=>{
  const ok = await UI.confirm({ title:'Sign out?', text:'You will need your email and password to open Invoice Studio again.', okLabel:'Sign out' });
  if(ok && fbAuth) fbAuth.signOut();
});
MPPin.onChange(()=>{ document.getElementById('menuPinState').textContent = MPPin.isSet() ? 'Set' : 'Not set'; });

/* ============ INIT ============ */
function setToday(){
  const d = new Date();
  document.getElementById('invDate').textContent = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
let appStarted = false;
async function startApp(){
  if(appStarted) return;
  appStarted = true;
  setToday();
  document.getElementById('invNum').textContent = await nextInvoiceNumber();
  addRow('Google Ads Campaign Strategy, Creatives, Ad Copy & Setup (Search / P-Max)', 1, 150);
  addRow('Campaign Optimization & Management', 1, 200);
  addRow('Conversion Tracking Setup & Reporting', 1, 50);
  setPaid(false);
  recalc();
  updateQR();
  if(lastCloudError) UI.toast('Saved invoices could not be loaded from the cloud. ' + cloudErrorText(), 'error');
}

/* ============ SIGN-IN GATE ============
   The app stays hidden until Firebase confirms who is signed in. */
const loginView = document.getElementById('loginView'), appView = document.getElementById('appView');
function showLogin(message){
  document.body.classList.remove('is-loading');
  appView.hidden = true; loginView.hidden = false;
  const box = document.getElementById('loginAlert');
  box.textContent = message || ''; box.hidden = !message; box.className = 'alert alert-danger';
}
function showApp(user){
  document.body.classList.remove('is-loading');
  loginView.hidden = true; appView.hidden = false;
  document.getElementById('menuUser').textContent = user && user.email ? 'Signed in as ' + user.email : '';
}
function friendlyAuthError(err){
  const code = err && err.code;
  if(code==='auth/user-not-found' || code==='auth/wrong-password' || code==='auth/invalid-credential') return 'Incorrect email or password.';
  if(code==='auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
  if(code==='auth/invalid-email') return 'Enter a valid email address.';
  if(code==='auth/operation-not-allowed') return 'Email/Password sign-in is not switched on in Firebase yet (Authentication → Sign-in method).';
  if(code==='auth/network-request-failed') return 'No connection. Check your internet and try again.';
  return (err && err.message) || 'Something went wrong. Try again.';
}

if(!firebaseEnabled || !fbAuth){
  showLogin('The sign-in service could not be loaded. Check your internet connection and reload.');
} else {
  fbAuth.onAuthStateChanged(async user=>{
    if(user){
      showApp(user);
      await MPPin.start();
      startApp();
    } else {
      MPPin.stop();
      if(appStarted){ window.location.reload(); return; }   // signed out: clear the invoice from the screen
      showLogin('');
    }
  });
}

document.getElementById('loginForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  if(!fbAuth) return;
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if(!email || !password){ showLogin('Enter your email and password.'); return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  const persistence = document.getElementById('rememberMe').checked
    ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
  fbAuth.setPersistence(persistence)
    .then(()=>fbAuth.signInWithEmailAndPassword(email, password))
    .catch(err=>showLogin(friendlyAuthError(err)))
    .finally(()=>{ btn.disabled = false; btn.textContent = 'Sign in'; });
});
document.getElementById('forgotLink').addEventListener('click', (e)=>{
  e.preventDefault();
  if(!fbAuth) return;
  const email = document.getElementById('loginEmail').value.trim();
  if(!email){ showLogin('Type your email first, then press “Forgot password?”.'); return; }
  fbAuth.sendPasswordResetEmail(email).then(()=>{
    const box = document.getElementById('loginAlert');
    box.textContent = 'Password reset email sent to ' + email + '.';
    box.className = 'alert alert-ok'; box.hidden = false;
  }).catch(err=>showLogin(friendlyAuthError(err)));
});
