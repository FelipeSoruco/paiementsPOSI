/* État (localStorage), codes promo et moteur de prix. */
const KEY = 'posi-proto-v1';
let S;

function seedCodes() {
  const base = { start: '2026-01-01', end: '2027-12-31', single: false, deferred: false, services: [], person: '', company: '', quota: 1, mode: 'eur', value: 0, target: '' };
  const mk = (code, c) => Object.assign({ code, used: false, created: new Date().toISOString().slice(0, 10) }, base, c);
  return [
    mk('MKT-GRATUIT3', { name: 'Marché – 3 accréditations offertes', ctx: 'M', effect: 'free', target: 'm:*', quota: 3, services: ['Wifi', 'Invité Marché', 'Salle Presse'] }),
    mk('MKT-TARDIF100', { name: 'Marché – 100 € HT sur Tardif', ctx: 'M', effect: 'reduction', mode: 'eur', value: 100, target: 'm:tardif', quota: 4 }),
    mk('MKT-PCT50', { name: 'Marché – 50 % sur accréditations', ctx: 'M', effect: 'reduction', mode: 'pct', value: 50, target: 'm:*', quota: 2 }),
    mk('MKT-FIXE300', { name: 'Marché – tarif fixe 300 € HT', ctx: 'M', effect: 'fixed', value: 300, target: 'm:*', quota: 5 }),
    mk('MKT-PNGRATUIT', { name: 'Marché – 3 PN gratuits', ctx: 'M', effect: 'free', target: 'opt:pn', quota: 3 }),
    mk('MKT-CONTRIB', { name: 'Marché – contribution seule', ctx: 'M', effect: 'contrib', target: 'm:*', quota: 3 }),
    mk('MKT-UNIQUE', { name: 'Marché – 50 € HT, usage unique', ctx: 'M', effect: 'reduction', mode: 'eur', value: 50, target: 'm:*', quota: 2, single: true }),
    mk('ONL-GRATUIT5', { name: 'Online – 5 accréditations gratuites', ctx: 'ONLINE', effect: 'free', target: 'online:*', quota: 5 }),
    mk('ACC-A-GRATUIT', { name: 'Presse audiovisuelle – 3 gratuites', ctx: 'A', effect: 'free', target: 'a:acc', quota: 3, services: ['Salle Presse', 'Wifi'] }),
    mk('FLM-REMISE20', { name: 'Film – 20 % sur les produits film', ctx: 'FILM', effect: 'reduction', mode: 'pct', value: 20, target: 'film:*', quota: 2 }),
    mk('STD-TABLES10', { name: 'Stand – 10 € HT par table', ctx: 'STAND', effect: 'reduction', mode: 'eur', value: 10, target: 'stand:table', quota: 4 }),
    mk('MKT-DIFFERE', { name: 'Marché – paiement différé', ctx: 'M', effect: 'none', deferred: true })
  ];
}

function seedState() {
  const codes = seedCodes();
  return {
    cart: [], applied: [], billing: {}, billingOk: false, lastOrder: null, orders: [],
    codes,
    templates: codes.filter(c => ['MKT-GRATUIT3', 'MKT-TARDIF100', 'MKT-CONTRIB', 'MKT-PNGRATUIT', 'MKT-DIFFERE'].includes(c.code))
      .map(c => ({ name: c.name, cfg: { ...c, code: undefined, used: undefined, created: undefined } })),
    services: SERVICES_SEED.map(label => ({ id: uid(), label }))
  };
}

function loadState() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) { /* stockage indisponible */ }
  return seedState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignoré */ } }
function resetAll() { try { localStorage.removeItem(KEY); } catch (e) { /* ignoré */ } S = seedState(); save(); }

const codeBy = id => S.codes.find(c => c.code === id);
const needsTargets = c => c.effect !== 'none' || (c.services && c.services.length > 0);

function expandLines() {
  const L = [];
  S.cart.forEach(it => {
    const start = L.length;
    let gt = '', gs = '';
    if (it.type === 'acc') {
      const p = P[it.key];
      const owner = it.seats.map(s => s.name).join(', ');
      gt = p.label; gs = (p.pack ? `${it.seats.length}/${p.seats} attribué(s) · ` : '') + owner;
      L.push({ id: it.id + ':t', item: it.id, key: it.key, ctx: p.ctx, kind: 'tarif', label: p.label, owner, ht: p.ht, vat: p.vat, qty: 1 });
      it.seats.forEach((s, i) => {
        if (s.opt) {
          const o = P['opt:' + s.opt];
          L.push({ id: it.id + ':o' + i, item: it.id, key: o.key, ctx: 'M', kind: 'option', label: o.label, owner: s.name, ht: o.ht, vat: o.vat, qty: 1 });
        }
      });
      if (p.contrib) L.push({ id: it.id + ':c', item: it.id, parent: it.id + ':t', ctx: p.ctx, kind: 'contrib', label: 'Contribution environnementale', owner, ht: CONTRIB.ht, vat: CONTRIB.vat, qty: p.contrib });
    } else if (it.type === 'film') {
      gt = 'Film'; gs = it.title;
      L.push({ id: it.id + ':f', item: it.id, key: 'film:fee', ctx: 'FILM', kind: 'tarif', label: P['film:fee'].label, owner: it.title, ht: 50, vat: 0.2, qty: 1 });
      if (it.upload) L.push({ id: it.id + ':u', item: it.id, key: it.upload, ctx: 'FILM', kind: 'tarif', label: P[it.upload].label, owner: it.title, ht: P[it.upload].ht, vat: 0.2, qty: 1 });
    } else if (it.type === 'stand') {
      const p = P[it.key];
      gt = p.label;
      L.push({ id: it.id + ':s', item: it.id, key: it.key, ctx: 'STAND', kind: 'tarif', label: p.label, owner: '', ht: p.ht, vat: p.vat, qty: it.qty });
    }
    for (let i = start; i < L.length; i++) { L[i].gt = gt; L[i].gs = gs; }
  });
  return L;
}

function eligibleLines(c, lines) {
  return lines.filter(l => l.kind !== 'contrib' && l.ctx === c.ctx && matches(c.target || '', l.key) &&
    (c.effect !== 'none' || l.kind === 'tarif'));
}

function priceCart() {
  const lines = expandLines();
  const byId = {};
  lines.forEach(l => { byId[l.id] = l; });
  S.applied.forEach(a => { a.lineIds = a.lineIds.filter(id => byId[id] && byId[id].kind !== 'contrib'); });
  S.applied = S.applied.filter(a => { const c = codeBy(a.codeId); return c && (!needsTargets(c) || a.lineIds.length); });

  const asg = {};
  S.applied.forEach(a => {
    const c = codeBy(a.codeId);
    let left = c.quota || 1;
    a.lineIds.forEach(id => { const u = Math.min(byId[id].qty, left); left -= u; asg[id] = { c, u }; });
  });

  lines.forEach(l => {
    l.base = r2(l.ht * l.qty);
    l.disc = 0;
    l.codeId = null;
    const a = asg[l.id];
    if (l.kind === 'contrib') {
      l.exo = !!(byId[l.parent] && byId[l.parent].free);
      l.disc = l.exo ? l.base : 0;
    } else if (a) {
      const { c, u } = a;
      l.codeId = c.code;
      l.units = u;
      l.services = c.services || [];
      if (c.effect === 'reduction') l.disc = c.mode === 'pct' ? l.ht * c.value / 100 * u : Math.min(l.ht, c.value) * u;
      else if (c.effect === 'fixed') l.disc = Math.max(0, l.ht - c.value) * u;
      else if (c.effect === 'free') { l.disc = l.ht * u; if (l.kind === 'tarif') l.free = true; }
      else if (c.effect === 'contrib') l.disc = l.ht * u;
    }
    l.disc = r2(l.disc);
    l.net = r2(l.base - l.disc);
    l.vatAmt = r2(l.net * l.vat);
    l.ttc = r2(l.net + l.vatAmt);
  });

  const t = { lines, ht: 0, ttc: 0, vat: {} };
  lines.forEach(l => { t.ht += l.net; t.ttc += l.ttc; t.vat[l.vat] = (t.vat[l.vat] || 0) + l.vatAmt; });
  t.ht = r2(t.ht); t.ttc = r2(t.ttc);
  t.deferred = S.applied.some(a => codeBy(a.codeId).deferred);
  t.counts = { acc: 0, films: lines.filter(l => l.key === 'film:fee').length, stand: lines.filter(l => l.ctx === 'STAND').reduce((n, l) => n + l.qty, 0) };
  t.persons = new Set(lines.filter(l => l.kind !== 'contrib' && l.ctx !== 'FILM' && l.ctx !== 'STAND').flatMap(l => l.owner.split(', '))).size;
  t.counts.acc = t.persons;
  return t;
}

function describeCode(c) {
  const tl = targetLabel(c.target || '');
  const q = c.quota || 1;
  let s = '';
  if (c.effect === 'reduction') s = c.mode === 'pct' ? `Réduction de ${c.value} % sur ${q} × ${tl}` : `Réduction de ${c.value} € HT par produit sur ${q} × ${tl}`;
  else if (c.effect === 'fixed') s = `Montant fixe de ${c.value} € HT pour ${q} × ${tl}`;
  else if (c.effect === 'free') s = `${q} × ${tl} gratuit${q > 1 ? 's' : ''}`;
  else if (c.effect === 'contrib') s = `${q} × ${tl} au tarif contribution seule`;
  const extra = [];
  if (c.services && c.services.length) extra.push('Services : ' + c.services.join(', '));
  if (c.deferred) extra.push('Paiement différé');
  return [s, ...extra].filter(Boolean).join(' · ') || 'Aucun effet';
}

function genCodeString(ctx) {
  const pre = { M: 'MKT', ONLINE: 'ONL', FILM: 'FLM', STAND: 'STD' }[ctx] || 'ACC';
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const blk = () => Array.from({ length: 4 }, () => ch[Math.floor(Math.random() * ch.length)]).join('');
  return `${pre}-${blk()}-${blk()}`;
}
