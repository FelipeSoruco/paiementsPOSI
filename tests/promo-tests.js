/* Batterie de tests de la maquette : cas calculés à la main + scénarios aléatoires vérifiés par un oracle indépendant.
   Usage : node tests/promo-tests.js   (nécessite Playwright) */
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../prototype/index.html');

/* ---------- Oracle indépendant (ne réutilise rien du code de la maquette) ---------- */
const PR = {};
['j', 'c', 'p', 'a', 'd'].forEach(k => PR[k + ':acc'] = { ht: 0, vat: .2, contrib: 1 });
PR['f:normal'] = { ht: 0, vat: .2, contrib: 1 }; PR['f:tardive'] = { ht: 181.82, vat: .1, contrib: 1 };
Object.entries({ normal: 509, 'early-bird': 439, tardif: 609 }).forEach(([k, v]) => PR['m:' + k] = { ht: v, vat: .1, contrib: 1 });
Object.entries({ 'pc1-eb': [1480, 1], 'pc1-n': [1680, 1], 'pc2-eb': [1910, 2], 'pc2-n': [2060, 2], 'pc3-eb': [2690, 3], 'pc3-n': [3040, 3], 'pc6-eb': [5580, 6], 'pc6-n': [6080, 6] })
  .forEach(([k, [v, n]]) => PR['m:' + k] = { ht: v, vat: .1, contrib: n, pack: true });
PR['online:normal'] = { ht: 219, vat: .1, contrib: 0 }; PR['online:early-bird'] = { ht: 189, vat: .1, contrib: 0 };
PR['opt:pn'] = { ht: 89, vat: .1 }; PR['opt:prio'] = { ht: 250, vat: .1 };
PR['film:fee'] = { ht: 50, vat: .2 }; PR['film:upload-online'] = { ht: 300, vat: .2 }; PR['film:upload-dcp'] = { ht: 400, vat: .2 }; PR['film:upload-physique'] = { ht: 450, vat: .2 };
Object.entries({ table: 40, chaise: 15, installation: 250, prise: 60, spot: 35, comptoir: 90, nettoyage: 80 }).forEach(([k, v]) => PR['stand:' + k] = { ht: v, vat: .2 });
const CTXOF = k => ({ j: 'J', c: 'C', p: 'P', a: 'A', d: 'D', f: 'F', m: 'M', online: 'ONLINE', opt: 'M', film: 'FILM', stand: 'STAND' })[k.split(':')[0]];
const tmatch = (t, key) => t === key || (t.endsWith('*') && key.startsWith(t.slice(0, -1)) && !PR[key].pack && !key.startsWith('opt:'));

function oracleLines(cart) {
  const L = [];
  cart.forEach(it => {
    if (it.type === 'acc') {
      const p = PR[it.key];
      L.push({ id: it.id + ':t', key: it.key, ht: p.ht, vat: p.vat, qty: 1, kind: 't' });
      it.seats.forEach((s, i) => { if (s.opt) L.push({ id: `${it.id}:o${i}`, key: 'opt:' + s.opt, ht: PR['opt:' + s.opt].ht, vat: PR['opt:' + s.opt].vat, qty: 1, kind: 'o' }); });
      if (p.contrib) L.push({ id: it.id + ':c', parent: it.id + ':t', ht: 20, vat: .2, qty: p.contrib, kind: 'c' });
    } else if (it.type === 'film') {
      L.push({ id: it.id + ':f', key: 'film:fee', ht: 50, vat: .2, qty: 1, kind: 't' });
      if (it.upload) L.push({ id: it.id + ':u', key: it.upload, ht: PR[it.upload].ht, vat: .2, qty: 1, kind: 't' });
    } else L.push({ id: it.id + ':s', key: it.key, ht: PR[it.key].ht, vat: .2, qty: it.qty, kind: 't' });
  });
  return L;
}
function oracle(cart, applied, codes) {
  const L = oracleLines(cart), by = {}; L.forEach(l => by[l.id] = l);
  const asg = {};
  applied.forEach(a => { const c = codes.find(x => x.code === a.codeId); let left = c.quota; a.lineIds.forEach(id => { if (!by[id]) return; const u = Math.min(by[id].qty, left); left -= u; asg[id] = { c, u }; }); });
  let ht = 0, ttc = 0; const vat = {};
  L.forEach(l => {
    const baseC = Math.round(l.ht * l.qty * 100); let dC = 0;
    if (l.kind === 'c') dC = by[l.parent].free ? baseC : 0;
    else if (asg[l.id]) {
      const { c, u } = asg[l.id];
      if (c.effect === 'reduction') dC = Math.round((c.mode === 'pct' ? l.ht * c.value / 100 : Math.min(l.ht, c.value)) * u * 100);
      if (c.effect === 'fixed') dC = Math.round(Math.max(0, l.ht - c.value) * u * 100);
      if (c.effect === 'free') { dC = Math.round(l.ht * u * 100); if (l.kind === 't') l.free = true; }
      if (c.effect === 'contrib') dC = Math.round(l.ht * u * 100);
    }
    const netC = baseC - dC, vC = Math.round(netC * l.vat);
    ht += netC; ttc += netC + vC; vat[l.vat] = (vat[l.vat] || 0) + vC;
  });
  return { ht: ht / 100, ttc: ttc / 100, vat: Object.fromEntries(Object.entries(vat).map(([k, v]) => [k, v / 100])) };
}

/* ---------- Outils ---------- */
let seed = 20261030; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const choice = a => a[Math.floor(rnd() * a.length)];
let uidn = 0; const mk = () => 'T' + (++uidn);
const acc = (key, n = 1, opts = []) => ({ id: mk(), type: 'acc', key, seats: Array.from({ length: PR[key].pack ? n : 1 }, (_, i) => ({ name: 'P' + i, opt: opts[i] || null })) });
const film = up => ({ id: mk(), type: 'film', title: 'F', upload: up || null });
const stand = (key, qty) => ({ id: mk(), type: 'stand', key, qty });
const ACCKEYS = Object.keys(PR).filter(k => /^(j|c|p|a|d|f|m|online):/.test(k));
function randomCart() {
  const c = []; const n = rint(3, 14);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    if (r < .65) { const k = choice(ACCKEYS); c.push(acc(k, PR[k].pack ? rint(1, 3) : 1, k.startsWith('m:') ? [choice([null, 'pn', 'prio']), choice([null, 'pn'])] : [])); }
    else if (r < .82) c.push(film(choice([null, 'film:upload-online', 'film:upload-dcp', 'film:upload-physique'])));
    else c.push(stand(choice(Object.keys(PR).filter(k => k.startsWith('stand:'))), rint(1, 6)));
  }
  return c;
}

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; failures.push(`${name} ${detail || ''}`); } };
const near = (a, b) => Math.abs(a - b) < 0.005;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
  const pageErrors = []; p.on('pageerror', e => pageErrors.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL);
  const setup = async cart => { await p.evaluate(c => { resetAll(); S.cart = c; location.hash = '#/produits'; }, cart); await p.evaluate(() => { location.hash = '#/recap'; }); await p.waitForSelector('#promo'); };
  const keep = async cart => { await p.evaluate(c => { S.cart = c; S.applied = []; ui.promoMsg = null; location.hash = '#/produits'; }, cart); await p.evaluate(() => { location.hash = '#/recap'; }); await p.waitForSelector('#promo'); };
  const apply = async code => {
    await p.fill('#promo', code); await p.click('[data-act=apply-code]');
    const modal = await p.locator('.modal').count();
    if (modal) { await p.click('[data-act=assign-ok]'); return 'applied'; }
    const msg = await p.locator('.msg').count() ? await p.locator('.msg').innerText() : '';
    return (await p.locator('.msg.ok').count()) ? 'applied-order' : 'error:' + msg;
  };
  const totals = () => p.evaluate(() => { const t = priceCart(); return { ht: t.ht, ttc: t.ttc, vat: t.vat, deferred: t.deferred, lines: t.lines.map(l => ({ id: l.id, net: l.net, exo: l.exo, codeId: l.codeId, services: l.services })) }; });

  /* A. Cas calculés à la main */
  const hand = [
    ['2 × M normal + MKT-GRATUIT3 → tout gratuit, contribution exonérée', [acc('m:normal'), acc('m:normal')], ['MKT-GRATUIT3'], 0],
    ['1 × M normal + MKT-CONTRIB → seulement 24 €', [acc('m:normal')], ['MKT-CONTRIB'], 24],
    ['M normal avec PN + MKT-PNGRATUIT → 559,90 + 24', [acc('m:normal', 1, ['pn'])], ['MKT-PNGRATUIT'], 583.90],
    ['1 × M normal + MKT-FIXE300 → 330 + 24', [acc('m:normal')], ['MKT-FIXE300'], 354],
    ['2 × M normal + MKT-PCT50 → 509 HT ×1,1 + 48', [acc('m:normal'), acc('m:normal')], ['MKT-PCT50'], 607.90],
    ['6 × Online + ONL-GRATUIT5 → 1 payante 240,90', Array.from({ length: 6 }, () => acc('online:normal')), ['ONL-GRATUIT5'], 240.90],
    ['Package PC 3 N + MKT-TARDIF100 (non éligible) → 3 416,00', [acc('m:pc3-n', 3)], ['MKT-TARDIF100'], 3416, 'error'],
    ['1 × A + ACC-A-GRATUIT → 0', [acc('a:acc')], ['ACC-A-GRATUIT'], 0],
    ['Film + upload DCP + FLM-REMISE20 → 432', [film('film:upload-dcp')], ['FLM-REMISE20'], 432],
    ['4 tables + STD-TABLES10 → 144', [stand('stand:table', 4)], ['STD-TABLES10'], 144],
    ['2 normal + 2 tardif, TARDIF100 puis PCT50 → 1 775,70', [acc('m:normal'), acc('m:normal'), acc('m:tardif'), acc('m:tardif')], ['MKT-TARDIF100', 'MKT-PCT50'], 1775.70],
    ['3 tardif, TARDIF100 puis PCT50 (plus rien d\'éligible) → 1 751,70', [acc('m:tardif'), acc('m:tardif'), acc('m:tardif')], ['MKT-TARDIF100', 'MKT-PCT50'], 1751.70, 'error'],
    ['Sans code : 1 × PC 2 EB avec PRIO → (1910+250)×1,1 + 48', [acc('m:pc2-eb', 1, ['prio'])], [], 2424]
  ];
  for (const [name, cart, codes, expected, expectErr] of hand) {
    await setup(cart); let sawErr = false;
    for (const c of codes) { const r = await apply(c); if (r.startsWith('error')) sawErr = true; }
    const t = await totals();
    check('MAIN ' + name, near(t.ttc, expected), `attendu ${expected}, obtenu ${t.ttc}`);
    if (expectErr) check('MAIN erreur attendue : ' + name, sawErr, 'aucune erreur affichée');
  }

  /* B. Comportements spécifiques */
  await setup([acc('m:normal'), acc('m:normal'), acc('m:normal')]);
  await apply('MKT-PCT50');
  let ids = await p.evaluate(() => S.applied[0].lineIds);
  check('Présélection : 2 lignes pour un quota de 2', ids.length === 2, JSON.stringify(ids));
  await p.click('[data-act=reassign]');
  await p.locator('.elig input').nth(2).click(); // tentative d'un 3e : doit être refusé
  check('Quota : 3e case refusée', (await p.locator('.elig input:checked').count()) === 2);
  await p.locator('.elig input').nth(0).click(); await p.locator('.elig input').nth(2).click(); await p.click('[data-act=assign-ok]');
  const ids2 = await p.evaluate(() => S.applied[0].lineIds);
  check('Déplacement du code vers une autre personne', ids2.length === 2 && !ids2.includes(ids[0]) && ids2.includes(ids[1]), JSON.stringify(ids2));
  const tt = await totals();
  check('Total après déplacement', near(tt.ttc, 3 * 24 + (254.5 * 2 + 509) * 1.1), `${tt.ttc}`);

  await setup([acc('m:normal'), acc('m:tardif')]); await apply('MKT-GRATUIT3');
  const sv = await totals();
  check('Services présents sur les lignes gratuites', sv.lines.filter(l => l.services && l.services.includes('Wifi')).length === 2);
  await p.evaluate(() => { S.applied = []; render(); }); await apply('MKT-GRATUIT3'); await apply('MKT-GRATUIT3').then(r => check('Même code deux fois refusé', r.startsWith('error')));
  const unk = await apply('NOEXISTE'); check('Code inconnu refusé', unk.startsWith('error'));
  await p.evaluate(() => { S.codes.push({ code: 'OLD-EXPIRED', name: 'x', ctx: 'M', effect: 'free', target: 'm:*', quota: 1, mode: 'eur', value: 0, services: [], deferred: false, start: '2020-01-01', end: '2020-12-31', single: false, used: false }); });
  check('Code expiré refusé', (await apply('OLD-EXPIRED')).startsWith('error'));
  await p.evaluate(() => { S.codes.push({ code: 'FUTUR', name: 'x', ctx: 'M', effect: 'free', target: 'm:*', quota: 1, mode: 'eur', value: 0, services: [], deferred: false, start: '2099-01-01', end: '2099-12-31', single: false, used: false }); });
  check('Code pas encore valable refusé', (await apply('FUTUR')).startsWith('error'));
  await p.evaluate(() => { S.codes.find(c => c.code === 'MKT-UNIQUE').used = true; });
  check('Code déjà utilisé refusé', (await apply('MKT-UNIQUE')).startsWith('error'));

  /* C. Parcours complet : usage unique brûlé + paiement différé */
  await setup([acc('m:normal'), acc('m:normal')]); await apply('MKT-UNIQUE'); await apply('MKT-DIFFERE');
  const exp = await totals(); check('Total avec usage unique (2 × (509−50) HT)', near(exp.ttc, 2 * ((509 - 50) * 1.1 + 24)), `${exp.ttc}`);
  await p.evaluate(() => { location.hash = '#/facturation'; }); await p.click('[data-act=fill-billing]'); await p.click('[data-act=billing-next]');
  await p.check('#cgv'); check('Paiement différé : pas de champ carte', (await p.locator('#cnum').count()) === 0);
  await p.click('[data-act=pay]'); await p.waitForSelector('.done .big');
  const st = await p.evaluate(() => ({ status: S.lastOrder.status, burned: codeBy('MKT-UNIQUE').used, cart: S.cart.length }));
  check('Commande en attente de paiement', st.status === 'pending'); check('Code à usage unique brûlé', st.burned === true); check('Panier vidé', st.cart === 0);
  await keep([acc('m:normal')]); check('Code brûlé refusé à la commande suivante', (await apply('MKT-UNIQUE')).startsWith('error'));
  await setup([acc('m:normal')]); await p.evaluate(() => { location.hash = '#/facturation'; }); await p.click('[data-act=fill-billing]'); await p.click('[data-act=billing-next]');
  await p.check('#cgv'); await p.fill('#cnum', '4242424242424242'); await p.fill('#ccv', '123'); await p.click('[data-act=pay]'); await p.waitForSelector('.done .big');
  check('Paiement par carte : commande payée', (await p.evaluate(() => S.lastOrder.status)) === 'paid');

  /* D. Création d'un code depuis l'administration puis application */
  await p.evaluate(() => { resetAll(); location.hash = '#/admin/nouveau'; }); await p.waitForSelector('.creator');
    await p.locator('label:has(input[data-cr=effect][value=reduction])').click();
  await p.locator('label:has(input[data-cr=mode][value=pct])').click();
  await p.fill('input[data-cr=value]', '10'); await p.selectOption('select[data-cr=target]', 'm:early-bird'); await p.fill('input[data-cr=quota]', '2'); await p.fill('input[data-cr=count]', '3');
  await p.click('[data-act=create-codes]'); await p.waitForSelector('.codesout');
  const made = await p.evaluate(() => S.codes.slice(-3).map(c => ({ code: c.code, effect: c.effect, mode: c.mode, value: c.value, target: c.target, quota: c.quota })));
  check('Création de 3 codes distincts', new Set(made.map(m => m.code)).size === 3 && made.every(m => m.effect === 'reduction' && m.mode === 'pct' && m.value === 10 && m.target === 'm:early-bird' && m.quota === 2), JSON.stringify(made));
  await keep([acc('m:early-bird'), acc('m:early-bird'), acc('m:early-bird')]); await apply(made[0].code);
  const ac = await totals(); check('Code créé en admin : 10 % sur 2 Early Bird', near(ac.ttc, 3 * 24 + (439 * .9 * 2 + 439) * 1.1), `${ac.ttc}`);

  /* E. Scénarios aléatoires contre l'oracle */
  const codesPool = await p.evaluate(() => (resetAll(), S.codes.map(c => c.code).filter(c => c !== 'MKT-UNIQUE')));
  const N = 150; let applied = 0, errors = 0;
  for (let s = 0; s < N; s++) {
    const cart = randomCart(); await setup(cart);
    const pick = [...codesPool].sort(() => rnd() - .5).slice(0, rint(1, 5));
    for (const code of pick) {
      const r = await apply(code); r.startsWith('error') ? errors++ : applied++;
      const st = await p.evaluate(() => ({ cart: S.cart, applied: S.applied, codes: S.codes }));
      const t = await totals(); const o = oracle(st.cart, st.applied, st.codes);
      const tag = `ALEA #${s} après ${code}`;
      check(tag + ' TTC', near(t.ttc, o.ttc), `page ${t.ttc} / oracle ${o.ttc}`);
      check(tag + ' HT', near(t.ht, o.ht), `page ${t.ht} / oracle ${o.ht}`);
      for (const r of Object.keys(o.vat)) check(tag + ' TVA ' + r, near(t.vat[r] || 0, o.vat[r]), `page ${t.vat[r]} / oracle ${o.vat[r]}`);
      check(tag + ' TTC = HT + TVA', near(t.ttc, t.ht + Object.values(t.vat).reduce((a, b) => a + b, 0)));
      /* invariants d'attribution */
      const L = oracleLines(st.cart); const byId = Object.fromEntries(L.map(l => [l.id, l])); const seen = new Set();
      for (const a of st.applied) {
        const c = st.codes.find(x => x.code === a.codeId); let units = 0;
        a.lineIds.forEach((id, i) => {
          const l = byId[id];
          check(tag + ' ligne existante', !!l);
          if (!l) return;
          check(tag + ' pas de contribution ciblée', l.kind !== 'c');
          check(tag + ' contexte/produit éligible', CTXOF(l.key) === c.ctx && tmatch(c.target, l.key), `${a.codeId} ↔ ${l.key}`);
          check(tag + ' ligne sans double code', !seen.has(id)); seen.add(id);
          if (i < a.lineIds.length - 1) units += l.qty;
        });
        check(tag + ' quota respecté', units < c.quota || a.lineIds.length === 1, `${a.codeId}`);
      }
      const tl = t.lines;
      tl.filter(l => l.id.endsWith(':c')).forEach(l => { const par = tl.find(x => x.id === l.id.replace(':c', ':t')); const parFree = par && par.codeId && st.codes.find(x => x.code === par.codeId).effect === 'free';
        check(tag + ' contribution : intacte ou exonérée', parFree ? l.net === 0 : l.net > 0); });
    }
  }
  check('Aucune erreur JavaScript pendant les tests', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`Scénarios aléatoires : ${N} paniers, ${applied} codes appliqués, ${errors} refus normaux (aucun produit éligible, etc.)`);
  console.log(`Vérifications : ${pass} réussies, ${fail} échouées`);
  failures.slice(0, 25).forEach(f => console.log('ÉCHEC', f));
  await b.close(); process.exit(fail ? 1 : 0);
})();
