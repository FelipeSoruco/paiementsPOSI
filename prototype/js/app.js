/* Interface : parcours client (produits → récapitulatif → facturation → paiement → confirmation) et administration. */
const app = document.getElementById('app');
const ui = { tab: 'acc', assign: null, promoMsg: null, creator: null, result: null, adminTab: 'codes',
  people: Array.from({ length: 8 }, randName), firms: COMPANIES.slice(0, 6) };
const STEPS = [['produits', 'Sélection des produits'], ['recap', 'Récapitulatif'], ['facturation', 'Facturation'], ['paiement', 'Paiement'], ['confirmation', 'Confirmation']];
const fdate = d => d ? d.split('-').reverse().join('/') : '';

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---------- Gabarit ---------- */
function header(a) {
  const admin = a === 'admin';
  return `<header class="top"><div class="brand"><b>MARCHÉ</b> · PAIEMENTS<small>PROTOTYPE</small></div>
    <nav><a href="#/produits" class="${admin ? '' : 'on'}">Ma commande</a><a href="#/admin" class="${admin ? 'on' : ''}">Administration</a></nav>
    <div class="user">Hospitality FSN_FRANCAIS · FSS0006</div></header>
    <div class="proto-note">Maquette fonctionnelle : données fictives conservées dans votre navigateur, aucun paiement réel.</div>`;
}
function stepper(i) {
  return `<div class="stepper">${STEPS.map(([r, l], n) => {
    const cls = n === i ? 'on' : n < i ? 'done' : '';
    return n < i ? `<a class="${cls}" href="#/${r}">${n + 1}. ${l}</a>` : `<span class="${cls}">${n + 1}. ${l}</span>`;
  }).join('')}</div>`;
}

/* ---------- Tableaux et totaux ---------- */
function linesTable(t) {
  const rows = t.lines.map(l => {
    if (l.kind === 'contrib') {
      return `<tr class="contrib"><td><span class="ind">↳</span> Contribution environnementale <small>non réductible · exonérable</small> ${l.exo ? '<span class="tag ok">Exonérée</span>' : ''}</td>
        <td class="r">${eur(l.ht)}</td><td class="c">${l.qty}</td><td class="r">${l.disc ? '−' + eur(l.disc) : ''}</td><td class="r">${eur(l.net)}</td></tr>`;
    }
    return `<tr><td><b>${esc(l.label)}</b>${l.owner ? `<br><small>${esc(l.owner)}</small>` : ''}
      ${l.codeId ? `<span class="tag">${esc(l.codeId)}</span>` : ''}${l.free ? '<span class="tag ok">Gratuit</span>' : ''}
      ${(l.services || []).map(s => `<span class="svc">${esc(s)}</span>`).join('')}</td>
      <td class="r">${eur(l.ht)}</td><td class="c">${l.qty}</td><td class="r">${l.disc ? '−' + eur(l.disc) : ''}</td><td class="r">${eur(l.net)}</td></tr>`;
  }).join('');
  return `<table class="lines"><thead><tr><th>Désignation</th><th class="r">Prix unitaire HT</th><th class="c">Qté</th><th class="r">Remise HT</th><th class="r">Prix HT</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function totalsBox(t) {
  const vat = Object.keys(t.vat).sort().map(r => `<tr><td>TVA ${Math.round(r * 100)} %</td><td>${eur(t.vat[r])}</td></tr>`).join('');
  return `<table class="tot"><tr><td>Total HT</td><td>${eur(t.ht)}</td></tr>${vat}<tr class="grand"><td>Total TTC</td><td>${eur(t.ttc)}</td></tr></table>`;
}

/* ---------- 1. Produits ---------- */
const stepper2 = `<div class="qty"><button type="button" data-act="step" data-d="-1">−</button><input name="qty" type="number" min="1" max="50" value="1"><button type="button" data-act="step" data-d="1">+</button></div>`;
const optSel = `<label>Option (par accréditation)</label><select name="opt"><option value="">Aucune</option><option value="pn">PN – 89,00 € HT</option><option value="prio">PRIO – 250,00 € HT</option></select>`;
function pcard(title, cls, note, body, act, extra = '') {
  return `<div class="pcard" ${extra}><div class="pimg ${cls}"><span>${title}</span></div><div class="pbody"><p class="note">${note}</p>${body}${stepper2}<button class="btn" data-act="${act}">Ajouter</button></div></div>`;
}
function accCards() {
  const simple = [['j:acc', 'Jeunes (J)', 'c1'], ['c:acc', 'Cinéphil (C)', 'c2'], ['p:acc', 'Presse (P)', 'c3'], ['a:acc', 'Presse audiovisuelle (A)', 'c4'], ['d:acc', 'Département Film (D)', 'c5']]
    .map(([k, l, c]) => pcard(l, c, 'Contribution environnementale 24 € TTC', '', 'add-acc', `data-key="${k}"`)).join('');
  const f = pcard('Festival (F)', 'c6', 'Contribution 24 € TTC. Tardive : + 200 € TTC',
    `<label>Variante</label><select name="key"><option value="f:normal">Normale</option><option value="f:tardive">Tardive (+ 200,00 € TTC)</option></select>`, 'add-acc');
  const mOpts = Object.values(P).filter(p => p.ctx === 'M' && p.kind === 'tarif').map(p => `<option value="${p.key}">${esc(p.label.replace('Marché – ', ''))} – ${eur(p.ht)} HT${p.pack ? ` (${p.seats} accréd.)` : ''}</option>`).join('');
  const m = pcard('Marché (M)', 'c7', 'Tarif + contribution de 24 € TTC par accréditation', `<label>Tarif</label><select name="key">${mOpts}</select>${optSel}`, 'add-acc');
  const oOpts = Object.values(P).filter(p => p.ctx === 'ONLINE').map(p => `<option value="${p.key}">${esc(p.label.replace('Marché Online – ', ''))} – ${eur(p.ht)} HT</option>`).join('');
  const o = pcard('Marché Online', 'c8', 'Sans contribution environnementale', `<label>Tarif</label><select name="key">${oOpts}</select>`, 'add-acc');
  return `<div class="pgrid">${m}${o}${f}${simple}</div>`;
}
function filmCards() {
  const ups = ['film:upload-online', 'film:upload-dcp', 'film:upload-physique'].map(k => `<option value="${k}">${esc(P[k].label)} – ${eur(P[k].ht)} HT</option>`).join('');
  return `<div class="pgrid">${pcard('Inscription de film', 'c9', "Frais d'inscription 50,00 € HT (TVA 20 %)", `<label>Upload (optionnel)</label><select name="upload"><option value="">Sans upload</option>${ups}</select>`, 'add-film')}</div>`;
}
function standCards() {
  const rows = Object.values(P).filter(p => p.ctx === 'STAND').map(p => `<div class="srow"><span>${esc(p.label)}<small>${eur(p.ht)} HT</small></span>
    <div class="qty sm"><button type="button" data-act="step" data-d="-1">−</button><input name="qty" type="number" min="0" max="99" value="0" data-key="${p.key}"><button type="button" data-act="step" data-d="1">+</button></div></div>`).join('');
  return `<div class="pcard wide" data-card="stand"><div class="pimg c10"><span>Stand</span></div><div class="pbody">${rows}<button class="btn" data-act="add-stand">Ajouter au panier</button></div></div>`;
}
function cartPanel() {
  const t = priceCart();
  const items = S.cart.map(it => {
    if (it.type === 'acc') {
      const p = P[it.key];
      const seats = it.seats.map((s, i) => `<div class="seat"><input data-chg="seatname" data-id="${it.id}" data-i="${i}" value="${esc(s.name)}">
        <button class="ic" data-act="dice" data-id="${it.id}" data-i="${i}" title="Nouveau nom">⟳</button>
        ${p.ctx === 'M' ? `<select data-chg="seatopt" data-id="${it.id}" data-i="${i}"><option value="">–</option><option value="pn" ${s.opt === 'pn' ? 'selected' : ''}>PN</option><option value="prio" ${s.opt === 'prio' ? 'selected' : ''}>PRIO</option></select>` : ''}</div>`).join('');
      return `<div class="citem"><div class="ct"><b>${esc(p.label)}</b><button class="ic" data-act="rm" data-id="${it.id}">✕</button></div>${seats}</div>`;
    }
    if (it.type === 'film') {
      return `<div class="citem"><div class="ct"><b>Film</b><button class="ic" data-act="rm" data-id="${it.id}">✕</button></div>
        <div class="seat"><input data-chg="filmtitle" data-id="${it.id}" value="${esc(it.title)}"></div>
        <div class="seat"><select data-chg="filmupload" data-id="${it.id}"><option value="">Sans upload</option>${['film:upload-online', 'film:upload-dcp', 'film:upload-physique'].map(k => `<option value="${k}" ${it.upload === k ? 'selected' : ''}>${esc(P[k].label)}</option>`).join('')}</select></div></div>`;
    }
    return `<div class="citem"><div class="ct"><b>${esc(P[it.key].label)}</b><button class="ic" data-act="rm" data-id="${it.id}">✕</button></div>
      <div class="seat">Quantité <input type="number" min="1" max="99" data-chg="standqty" data-id="${it.id}" value="${it.qty}" style="width:70px"></div></div>`;
  }).join('');
  return `<aside class="side"><h3>Mon panier <small>${S.cart.length} élément(s)</small></h3>
    ${items || '<p class="empty">Ajoutez des produits à gauche. Chaque accréditation reçoit automatiquement un nom fictif.</p>'}
    <div class="sumline"><span>Total estimé TTC</span><b>${eur(t.ttc)}</b></div>
    <a class="btn full ${S.cart.length ? '' : 'off'}" href="${S.cart.length ? '#/recap' : '#/produits'}">Suivant ›</a>
    ${S.cart.length ? '<button class="link" data-act="clear-cart">Vider le panier</button>' : ''}</aside>`;
}
function viewProducts() {
  const tabs = [['acc', 'Accréditations'], ['film', 'Films'], ['stand', 'Stand']].map(([k, l]) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}">${l}</button>`).join('');
  return `<div class="two"><section><h1>Sélection des produits</h1><div class="tabs">${tabs}</div>
    ${ui.tab === 'acc' ? accCards() : ui.tab === 'film' ? filmCards() : standCards()}</section>${cartPanel()}</div>`;
}

/* ---------- 2. Récapitulatif ---------- */
function viewRecap() {
  const t = priceCart();
  const unused = S.codes.filter(c => !c.used && !S.applied.some(a => a.codeId === c.code));
  const applied = S.applied.map(a => {
    const c = codeBy(a.codeId);
    const who = a.lineIds.map(id => t.lines.find(l => l.id === id)).filter(Boolean).map(l => (l.owner || l.label) + (l.kind === 'option' ? ' (' + l.label.replace('Option ', '') + ')' : ''));
    return `<div class="acode"><div><b>${esc(c.code)}</b> <span>${esc(describeCode(c))}</span>
      <small>${needsTargets(c) ? 'Appliqué à : ' + esc(who.join(' ; ')) : 'Appliqué à toute la commande'}</small></div>
      <div>${needsTargets(c) ? `<button class="link" data-act="reassign" data-code="${esc(c.code)}">Modifier</button>` : ''}<button class="link red" data-act="rmcode" data-code="${esc(c.code)}">Retirer</button></div></div>`;
  }).join('');
  return `<h1>Récapitulatif</h1>
    <div class="band"><div class="l">${t.persons ? `ACCRÉDITATIONS POUR ${t.persons} PERSONNE${t.persons > 1 ? 'S' : ''}` : 'VOTRE COMMANDE'}</div><div class="r">TOTAL : ${eur(t.ttc)}</div></div>
    <div class="promo"><label class="chk"><input type="checkbox" checked disabled> Je dispose d'un code promotionnel</label>
      <div class="prow"><input id="promo" placeholder="Je saisis mon code" autocomplete="off"><button class="btn ghost" data-act="apply-code">J'applique</button></div>
      ${ui.promoMsg ? `<p class="msg ${ui.promoMsg.ok ? 'ok' : 'ko'}">${esc(ui.promoMsg.text)}</p>` : ''}
      <details><summary>Codes de test disponibles (démo)</summary><div class="chips">${unused.map(c => `<button class="chip" data-act="fill-code" data-code="${esc(c.code)}" title="${esc(describeCode(c))}">${esc(c.code)}</button>`).join('') || 'Aucun'}</div></details>
      ${applied ? `<div class="alist">${applied}</div>` : ''}</div>
    ${linesTable(t)}${totalsBox(t)}
    <p class="hint">Les remises ne s'appliquent jamais à la contribution environnementale ; seule une exonération (produit gratuit) l'annule.</p>
    <div class="nav"><a class="btn ghost" href="#/produits">‹ Retour</a><a class="btn" href="#/facturation">Suivant ›</a></div>`;
}
function assignModal() {
  const a = ui.assign, c = codeBy(a.codeId), t = priceCart();
  const elig = eligibleLines(c, t.lines);
  const q = c.quota || 1;
  const selUnits = [...a.sel].reduce((n, id) => n + (t.lines.find(l => l.id === id)?.qty || 0), 0);
  const li = elig.map(l => {
    const other = S.applied.find(x => x.codeId !== c.code && x.lineIds.includes(l.id));
    return `<li class="${other ? 'dis' : ''}"><label><input type="checkbox" data-chg="assign" data-id="${l.id}" ${a.sel.has(l.id) ? 'checked' : ''} ${other ? 'disabled' : ''}>
      <span><b>${esc(l.owner || '—')}</b><small>${esc(l.label)}${l.qty > 1 ? ' × ' + l.qty : ''}</small></span><em>${eur(l.base)} HT${other ? ' · déjà : ' + esc(other.codeId) : ''}</em></label></li>`;
  }).join('');
  return `<div class="overlay"><div class="modal"><h2>À quels produits appliquer le code ${esc(c.code)} ?</h2>
    <p>${esc(describeCode(c))}</p>
    <p class="count"><b>${selUnits} / ${q}</b> sélectionné(s). Vous pouvez décocher un produit et en cocher un autre.</p>
    <ul class="elig">${li}</ul>
    <div class="nav"><button class="btn ghost" data-act="assign-cancel">Annuler</button><button class="btn" data-act="assign-ok">Valider l'application</button></div></div></div>`;
}
function openAssign(code) {
  const c = codeBy(code), t = priceCart();
  const cur = S.applied.find(a => a.codeId === code);
  let sel = new Set(cur ? cur.lineIds : []);
  if (!cur) {
    let n = 0;
    eligibleLines(c, t.lines).filter(l => !S.applied.some(x => x.lineIds.includes(l.id))).forEach(l => { if (n < (c.quota || 1)) { sel.add(l.id); n += l.qty; } });
  }
  ui.assign = { codeId: code, sel };
  render();
}
function applyCode() {
  const v = (document.getElementById('promo').value || '').trim().toUpperCase();
  const fail = text => { ui.promoMsg = { ok: false, text }; render(); };
  if (!v) return fail('Saisissez un code.');
  const c = S.codes.find(x => x.code === v);
  if (!c) return fail('Code inconnu.');
  if (S.applied.some(a => a.codeId === v)) return fail('Ce code est déjà appliqué à la commande.');
  if (c.used) return fail("Ce code a déjà été utilisé : il n'est plus valable.");
  const today = new Date().toISOString().slice(0, 10);
  if (c.start && today < c.start) return fail(`Ce code sera valable à partir du ${fdate(c.start)}.`);
  if (c.end && today > c.end) return fail(`Ce code a expiré le ${fdate(c.end)}.`);
  const t = priceCart();
  if (!needsTargets(c)) { S.applied.push({ codeId: v, lineIds: [] }); save(); ui.promoMsg = { ok: true, text: `Code ${v} appliqué à la commande.` }; return render(); }
  const elig = eligibleLines(c, t.lines);
  if (!elig.length) return fail(`Ce code est réservé à « ${CTX[c.ctx]} » : aucun produit éligible dans votre panier.`);
  if (elig.every(l => S.applied.some(a => a.lineIds.includes(l.id)))) return fail('Tous les produits éligibles ont déjà un code appliqué.');
  ui.promoMsg = null;
  openAssign(v);
}

/* ---------- 3. Facturation ---------- */
const BF = [['civ', 'Civilité', 'select', ['Madame', 'Monsieur']], ['prenom', 'Prénom', 'text'], ['nom', 'Nom', 'text'], ['societe', 'Société', 'text'], ['tva', 'N° de TVA intracommunautaire (optionnel)', 'text', null, true],
  ['pays', 'Pays', 'select', ['France', 'Allemagne', 'Belgique', 'Espagne', 'Italie', 'Royaume-Uni', 'États-Unis', 'Autre']], ['adresse', 'Adresse', 'text'], ['adresse2', "Complément d'adresse", 'text', null, true],
  ['cp', 'Code postal', 'text'], ['ville', 'Ville', 'text'], ['email', 'E-mail de facturation', 'email'], ['tel', 'Téléphone (optionnel)', 'text', null, true]];
function viewBilling() {
  const b = S.billing, t = priceCart();
  const f = BF.map(([k, l, type, opts, optional]) => `<div class="fld ${['adresse', 'adresse2', 'societe'].includes(k) ? 'span2' : ''}"><label>${l}${optional ? '' : ' <i>*</i>'}</label>${type === 'select'
    ? `<select data-b="${k}">${opts.map(o => `<option ${b[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input data-b="${k}" data-req="${optional ? '' : '1'}" type="${type}" value="${esc(b[k] || '')}">`}</div>`).join('');
  return `<h1>Adresse de facturation</h1><div class="two"><section class="card"><p class="hint">Les champs marqués d'un * sont obligatoires.</p>
    <div class="form">${f}</div><button class="link" data-act="fill-billing">Remplir avec des données de test</button>
    <div class="nav"><a class="btn ghost" href="#/recap">‹ Retour</a><button class="btn" data-act="billing-next">Suivant ›</button></div></section>
    <aside class="side"><h3>Votre commande</h3><div class="sumline"><span>Total HT</span><b>${eur(t.ht)}</b></div>
    ${Object.keys(t.vat).sort().map(r => `<div class="sumline"><span>TVA ${Math.round(r * 100)} %</span><b>${eur(t.vat[r])}</b></div>`).join('')}
    <div class="sumline big"><span>Total TTC</span><b>${eur(t.ttc)}</b></div>
    ${S.applied.length ? `<p class="hint">Codes : ${S.applied.map(a => esc(a.codeId)).join(', ')}</p>` : ''}</aside></div>`;
}

/* ---------- 4. Paiement ---------- */
function viewPay() {
  const t = priceCart(), b = S.billing;
  const months = Array.from({ length: 12 }, (_, i) => `<option>${String(i + 1).padStart(2, '0')}</option>`).join('');
  const yrs = Array.from({ length: 8 }, (_, i) => `<option>${2026 + i}</option>`).join('');
  let pay;
  if (t.deferred) pay = `<div class="info">Un code de paiement différé est appliqué : la facture sera créée, mais le paiement restera <b>en attente</b>. Aucune carte n'est demandée.</div>`;
  else if (t.ttc === 0) pay = `<div class="info">Le montant à payer est de 0,00 € : aucun paiement n'est nécessaire.</div>`;
  else pay = `<div class="cards"><span class="cb mc">MC</span><span class="cb am">AMEX</span><span class="cb vi">VISA</span></div>
    <div class="paygrid"><div class="payform"><div class="fld"><label>Numéro de la carte <i>*</i></label><input id="cnum" placeholder="4242 4242 4242 4242" inputmode="numeric"></div>
      <div class="fld"><label>Date d'expiration <i>*</i></label><div class="two2"><select id="cm">${months}</select><select id="cy">${yrs}</select></div></div>
      <div class="fld"><label>Cryptogramme <i>*</i></label><input id="ccv" placeholder="123" maxlength="4" style="width:90px"></div>
      <p class="hint">Carte de test : 4242 4242 4242 4242, toute date future, tout cryptogramme.</p></div>
      <div class="info">Si votre demande d'accréditation est refusée, le montant payé vous sera automatiquement remboursé.</div></div>`;
  const label = t.deferred ? 'Valider (paiement en attente)' : t.ttc === 0 ? 'Valider la commande' : `Payer ${eur(t.ttc)}`;
  return `<h1>Récapitulatif final et paiement</h1>
    <div class="band"><div class="l">VOTRE COMMANDE${t.persons ? ` · ${t.persons} PERSONNE${t.persons > 1 ? 'S' : ''}` : ''}</div><div class="r">TOTAL : ${eur(t.ttc)}</div></div>
    ${linesTable(t)}${totalsBox(t)}
    <div class="addr"><b>Facturé à</b><br>${esc(b.civ)} ${esc(b.prenom)} ${esc(b.nom)} · ${esc(b.societe)}<br>${esc(b.adresse)} ${esc(b.adresse2)}, ${esc(b.cp)} ${esc(b.ville)}, ${esc(b.pays)}<br>${esc(b.email)} <a href="#/facturation">Modifier</a></div>
    <h2 class="sec">Conditions générales</h2>
    <label class="chk"><input type="checkbox" id="cgv"> J'ai pris connaissance des conditions générales d'inscription, de la politique de confidentialité, et je les accepte.</label>
    <p class="hint">Concernant les accréditations présentielles, la facture est soumise à une TVA au taux de 10 % (art. 279 b nonies du CGI).</p>
    <h2 class="sec">Informations de paiement</h2>${pay}
    <div class="nav"><a class="btn ghost" href="#/facturation">‹ Retour</a><button class="btn" data-act="pay">${label}</button></div>`;
}
function doPay() {
  const t = priceCart();
  if (!document.getElementById('cgv').checked) return toast("Veuillez accepter les conditions générales.");
  if (!t.deferred && t.ttc > 0) {
    const n = document.getElementById('cnum').value.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(n)) return toast('Numéro de carte invalide.');
    if (!/^\d{3,4}$/.test(document.getElementById('ccv').value)) return toast('Cryptogramme invalide.');
  }
  const btn = document.querySelector('[data-act=pay]'); btn.disabled = true; btn.textContent = 'Traitement en cours…';
  setTimeout(() => {
    const t2 = priceCart();
    const order = { id: 'CMD-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 89999), date: new Date().toISOString(),
      status: t2.deferred ? 'pending' : 'paid', totals: { ht: t2.ht, ttc: t2.ttc, vat: t2.vat, persons: t2.persons }, lines: t2.lines,
      billing: { ...S.billing }, codes: S.applied.map(a => a.codeId) };
    S.applied.forEach(a => { const c = codeBy(a.codeId); if (c.single) c.used = true; });
    S.orders.unshift(order); S.lastOrder = order; S.cart = []; S.applied = []; ui.promoMsg = null;
    save(); location.hash = '#/confirmation';
  }, 900);
}
function viewDone() {
  const o = S.lastOrder, pending = o.status === 'pending';
  const t = { lines: o.lines, ht: o.totals.ht, ttc: o.totals.ttc, vat: o.totals.vat };
  return `<div class="done ${pending ? 'pend' : ''}"><div class="big">${pending ? '⏳' : '✓'}</div><h1>${pending ? 'Commande enregistrée : paiement en attente' : 'Paiement confirmé'}</h1>
    <p>Commande <b>${o.id}</b> · ${new Date(o.date).toLocaleDateString('fr-FR')}</p>
    <p>${pending ? "La facture a été créée et reste impayée. Le paiement a été autorisé en différé." : 'Merci, votre paiement a bien été reçu.'}</p></div>
    ${linesTable(t)}${totalsBox(t)}
    <div class="addr"><b>Facturé à</b><br>${esc(o.billing.prenom)} ${esc(o.billing.nom)} · ${esc(o.billing.societe)}<br>${esc(o.billing.adresse)}, ${esc(o.billing.cp)} ${esc(o.billing.ville)}</div>
    <div class="nav"><button class="btn ghost" onclick="print()">Imprimer la facture</button><a class="btn" href="#/produits">Nouvelle commande</a></div>`;
}
