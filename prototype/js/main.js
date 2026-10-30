/* Routeur et gestion des évènements. */
function render() {
  const y = window.scrollY;
  const h = location.hash.replace(/^#\/?/, '') || 'produits';
  const [a, b] = h.split('/');
  let body, step = -1;
  switch (a) {
    case 'admin':
      body = b === 'nouveau' ? viewCreator() : b === 'services' ? viewServices() : b === 'catalogue' ? viewCatalogue() : b === 'donnees' ? viewData() : viewCodes();
      break;
    case 'recap': step = 1; body = viewRecap(); break;
    case 'facturation': step = 2; body = viewBilling(); break;
    case 'paiement': step = 3; body = viewPay(); break;
    case 'confirmation': step = 4; body = viewDone(); break;
    default: step = 0; body = viewProducts();
  }
  app.innerHTML = header(a) + (step >= 0 ? stepper(step) : '') + `<main class="wrap ${a === 'admin' ? 'wide' : ''}">${body}</main>` + (ui.assign ? assignModal() : '');
  save();
  window.scrollTo(0, y);
}

function guard() {
  const a = (location.hash.replace(/^#\/?/, '') || 'produits').split('/')[0];
  const go = h => { location.hash = h; return true; };
  if (['recap', 'facturation', 'paiement'].includes(a) && !S.cart.length) return go('#/produits');
  if (a === 'paiement' && !S.billingOk) return go('#/facturation');
  if (a === 'confirmation' && !S.lastOrder) return go('#/produits');
  if (a !== 'admin' || (location.hash.split('/')[2] !== 'nouveau')) ui.result = null;
  if (!location.hash.startsWith('#/admin/nouveau')) ui.creator = null;
  return false;
}
function route() { ui.assign = null; if (!guard()) render(); }
window.addEventListener('hashchange', route);

const cartItem = id => S.cart.find(i => i.id === id);
const actions = {
  tab: a => { ui.tab = a.dataset.t; render(); },
  step: a => { const i = a.parentElement.querySelector('input'); const min = i.min === '0' ? 0 : 1; i.value = Math.max(min, Math.min(+i.max, (+i.value || 0) + +a.dataset.d)); },
  'add-acc': a => {
    const card = a.closest('.pcard');
    const key = card.dataset.key || card.querySelector('[name=key]').value;
    const opt = card.querySelector('[name=opt]')?.value || null;
    const n = Math.max(1, Math.min(50, +card.querySelector('[name=qty]').value || 1));
    for (let i = 0; i < n; i++) S.cart.push({ id: uid(), type: 'acc', key, seats: Array.from({ length: P[key].pack ? 1 : P[key].seats }, () => ({ name: randName(), opt })) });
    save(); render(); toast(`${n} × ${P[key].label} ajouté${n > 1 ? 's' : ''}`);
  },
  'add-film': a => {
    const card = a.closest('.pcard');
    const n = Math.max(1, Math.min(50, +card.querySelector('[name=qty]').value || 1));
    const up = card.querySelector('[name=upload]').value || null;
    for (let i = 0; i < n; i++) S.cart.push({ id: uid(), type: 'film', title: randFilm(), upload: up });
    save(); render(); toast(`${n} film(s) ajouté(s)`);
  },
  'add-stand': a => {
    let added = 0;
    a.closest('.pcard').querySelectorAll('input[data-key]').forEach(i => {
      const q = +i.value || 0; if (!q) return;
      const ex = S.cart.find(x => x.type === 'stand' && x.key === i.dataset.key);
      if (ex) ex.qty += q; else S.cart.push({ id: uid(), type: 'stand', key: i.dataset.key, qty: q });
      added += q;
    });
    if (!added) return toast('Choisissez une quantité.');
    save(); render(); toast('Produits stand ajoutés');
  },
  random: () => {
    const n = Math.max(1, Math.min(30, +document.getElementById('randn').value || 5));
    const accKeys = Object.values(P).filter(p => p.kind === 'tarif' && ACC_CTX.includes(p.ctx)).map(p => p.key);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.7) {
        const key = pick(accKeys), isM = P[key].ctx === 'M';
        const opt = isM && Math.random() < 0.4 ? pick(['pn', 'prio']) : null;
        S.cart.push({ id: uid(), type: 'acc', key, seats: [{ name: randName(), opt }] });
      } else if (r < 0.85) S.cart.push({ id: uid(), type: 'film', title: randFilm(), upload: pick([null, 'film:upload-online', 'film:upload-dcp', 'film:upload-physique']) });
      else S.cart.push({ id: uid(), type: 'stand', key: pick(Object.keys(P).filter(k => k.startsWith('stand:'))), qty: 1 + Math.floor(Math.random() * 4) });
    }
    save(); render(); toast(`${n} produit(s) ajouté(s) au hasard`);
  },
  'add-seat': a => { const it = cartItem(a.dataset.id); if (it.seats.length < P[it.key].seats) it.seats.push({ name: randName(), opt: null }); render(); },
  'rm-seat': a => { const it = cartItem(a.dataset.id); if (it.seats.length > 1) it.seats.splice(+a.dataset.i, 1); render(); },
  rm: a => { S.cart = S.cart.filter(i => i.id !== a.dataset.id); render(); },
  'clear-cart': () => { S.cart = []; S.applied = []; render(); },
  dice: a => { cartItem(a.dataset.id).seats[+a.dataset.i].name = randName(); render(); },
  'apply-code': applyCode,
  'fill-code': a => { const i = document.getElementById('promo'); i.value = a.dataset.code; i.focus(); },
  reassign: a => openAssign(a.dataset.code),
  rmcode: a => { S.applied = S.applied.filter(x => x.codeId !== a.dataset.code); ui.promoMsg = null; render(); },
  'assign-cancel': () => { ui.assign = null; render(); },
  'assign-ok': () => {
    const as = ui.assign;
    if (!as.sel.size) return toast('Sélectionnez au moins un produit.');
    const entry = { codeId: as.codeId, lineIds: [...as.sel] };
    const i = S.applied.findIndex(x => x.codeId === as.codeId);
    if (i >= 0) S.applied[i] = entry; else S.applied.push(entry);
    ui.assign = null; ui.promoMsg = { ok: true, text: `Code ${as.codeId} appliqué.` }; render();
  },
  'fill-billing': () => {
    Object.entries({ civ: 'Madame', prenom: pick(FIRST), nom: pick(LAST).toUpperCase(), societe: pick(COMPANIES), tva: 'FR12345678901', pays: 'France', adresse: '12 boulevard de la Croisette',
      adresse2: '', cp: '06400', ville: 'Cannes', email: 'facturation@example.com', tel: '+33 4 00 00 00 00' })
      .forEach(([k, v]) => { const el = document.querySelector(`[data-b=${k}]`); if (el) el.value = v; });
  },
  'billing-next': () => {
    const b = {}; let ok = true;
    document.querySelectorAll('[data-b]').forEach(el => {
      b[el.dataset.b] = el.value.trim(); el.classList.remove('err');
      if (el.dataset.req === '1' && !b[el.dataset.b]) { el.classList.add('err'); ok = false; }
    });
    if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) { document.querySelector('[data-b=email]').classList.add('err'); ok = false; }
    if (!ok) return toast('Veuillez compléter les champs obligatoires.');
    S.billing = b; S.billingOk = true; save(); location.hash = '#/paiement';
  },
  pay: doPay,
  unburn: a => { codeBy(a.dataset.code).used = false; render(); },
  'del-code': a => { S.codes = S.codes.filter(c => c.code !== a.dataset.code); S.applied = S.applied.filter(x => x.codeId !== a.dataset.code); render(); },
  'svc-add': () => { const i = document.getElementById('svcnew'); const v = i.value.trim(); if (!v) return; if (S.services.some(s => s.label.toLowerCase() === v.toLowerCase())) return toast('Ce service existe déjà.'); S.services.unshift({ id: uid(), label: v }); render(); },
  'svc-rm': a => { S.services = S.services.filter(s => s.id !== a.dataset.id); render(); },
  'svc-del': a => { ui.creator.services = ui.creator.services.filter(l => l !== a.dataset.l); document.getElementById('chosen').innerHTML = chosenChips(); document.querySelectorAll('[data-cr-svc]').forEach(i => { if (i.value === a.dataset.l) i.checked = false; }); refreshPreview(); },
  'create-codes': createCodes,
  'cr-again': () => { ui.result = null; ui.creator = null; render(); },
  reset: () => { if (confirm('Réinitialiser toutes les données de démonstration ?')) { resetAll(); ui.creator = null; render(); toast('Données réinitialisées'); } }
};
function refreshPreview() { const p = document.getElementById('preview'); if (p) p.innerHTML = creatorPreview(); }

document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) { e.preventDefault(); actions[a.dataset.act](a, e); } });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'promo') applyCode(); });

function setCreator(el) {
  const c = ui.creator, f = el.dataset.cr;
  c[f] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value;
  if (f === 'ctx') {
    c.target = targetsFor(c.ctx)[0];
    if (!ACC_CTX.includes(c.ctx)) { c.services = []; if (c.effect === 'contrib') c.effect = 'reduction'; }
  }
  if (['ctx', 'effect', 'mode', 'saveTpl'].includes(f)) render(); else refreshPreview();
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.cr && !['radio', 'checkbox'].includes(el.type) && el.tagName !== 'SELECT') setCreator(el);
  if (el.dataset.svcfilter !== undefined) {
    const q = el.value.toLowerCase();
    document.querySelectorAll('.svclist li, .svcpick li').forEach(li => { li.style.display = li.dataset.l.includes(q) ? '' : 'none'; });
  }
});
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset;
  if (d.cr && (['radio', 'checkbox'].includes(el.type) || el.tagName === 'SELECT')) return setCreator(el);
  if (el.hasAttribute('data-cr-svc')) {
    const s = ui.creator.services;
    if (el.checked) { if (!s.includes(el.value)) s.push(el.value); } else ui.creator.services = s.filter(x => x !== el.value);
    document.getElementById('chosen').innerHTML = chosenChips(); return refreshPreview();
  }
  if (d.actChange === 'tpl') {
    if (el.value === '') return;
    const t = S.templates[+el.value];
    ui.creator = { ...defaultCreator(), ...JSON.parse(JSON.stringify(t.cfg)), count: 1, saveTpl: false, tplName: '' };
    ui.creator.start = defaultCreator().start; return render();
  }
  switch (d.chg) {
    case 'seatname': cartItem(d.id).seats[+d.i].name = el.value.trim() || randName(); save(); break;
    case 'seatopt': cartItem(d.id).seats[+d.i].opt = el.value || null; render(); break;
    case 'filmtitle': cartItem(d.id).title = el.value.trim() || randFilm(); save(); break;
    case 'filmupload': cartItem(d.id).upload = el.value || null; render(); break;
    case 'standqty': cartItem(d.id).qty = Math.max(1, +el.value || 1); render(); break;
    case 'svc-edit': { const s = S.services.find(x => x.id === d.id); if (s) { s.label = el.value.trim() || s.label; save(); } break; }
    case 'assign': {
      const as = ui.assign, c = codeBy(as.codeId), t = priceCart();
      if (el.checked) {
        const units = [...as.sel].reduce((n, id) => n + (t.lines.find(l => l.id === id)?.qty || 0), 0);
        if (units >= (c.quota || 1)) { el.checked = false; return toast(`Maximum ${c.quota || 1} produit(s) pour ce code : décochez-en un d'abord.`); }
        as.sel.add(d.id);
      } else as.sel.delete(d.id);
      render(); break;
    }
  }
});

S = loadState();
route();
