/* Administration : codes promotionnels (création, liste), services, catalogue. */
const EFFECTS = [['reduction', 'Réduction', '€ HT ou % par produit'], ['fixed', 'Montant fixe', 'Prix imposé par produit'], ['free', 'Produit gratuit', 'Tarif à 0 € et contribution exonérée'],
  ['contrib', 'Contribution seule', 'Ne paie que les 24 €'], ['none', 'Aucun effet', 'Services ou paiement différé seuls']];
const defaultCreator = () => ({ name: '', ctx: 'M', effect: 'reduction', mode: 'eur', value: 100, target: 'm:*', quota: 1, services: [], deferred: false,
  start: new Date().toISOString().slice(0, 10), end: '2027-12-31', single: true, person: '', company: '', count: 1, saveTpl: false, tplName: '' });

function adminTabs(cur) {
  return `<div class="tabs">${[['codes', 'Codes promo'], ['services', 'Services'], ['catalogue', 'Catalogue'], ['donnees', 'Données']]
    .map(([k, l]) => `<a class="tab ${cur === k ? 'on' : ''}" href="#/admin${k === 'codes' ? '' : '/' + k}">${l}</a>`).join('')}</div>`;
}

function viewCodes() {
  const rows = S.codes.map(c => `<tr><td><code>${esc(c.code)}</code></td><td>${esc(c.name)}</td><td>${CTX[c.ctx]}</td><td>${esc(describeCode(c))}</td>
    <td>${fdate(c.start)} → ${fdate(c.end)}</td><td>${c.single ? 'Usage unique' : 'Multiple'}${c.person ? '<br><small>' + esc(c.person) + '</small>' : ''}${c.company ? '<br><small>' + esc(c.company) + '</small>' : ''}</td>
    <td>${c.used ? '<span class="tag ko">Utilisé</span>' : '<span class="tag ok">Disponible</span>'}</td>
    <td class="r">${c.used ? `<button class="link" data-act="unburn" data-code="${esc(c.code)}">Réactiver</button>` : ''}<button class="link red" data-act="del-code" data-code="${esc(c.code)}">Supprimer</button></td></tr>`).join('');
  return `<h1>Administration</h1>${adminTabs('codes')}
    <div class="bar"><span>${S.codes.length} code(s)</span><a class="btn" href="#/admin/nouveau">＋ Nouveau code</a></div>
    <table class="lines adm"><thead><tr><th>Code</th><th>Nom</th><th>Contexte</th><th>Effet</th><th>Validité</th><th>Usage</th><th>Statut</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function viewServices() {
  const rows = S.services.map(s => `<li data-l="${esc(s.label.toLowerCase())}"><input data-chg="svc-edit" data-id="${s.id}" value="${esc(s.label)}"><button class="ic" data-act="svc-rm" data-id="${s.id}">✕</button></li>`).join('');
  return `<h1>Administration</h1>${adminTabs('services')}
    <p class="hint">Un service s'ajoute aux accréditations ciblées par un code et n'a aucun effet sur le prix. Un seul exemplaire de chaque service par accréditation.</p>
    <div class="bar"><input id="svcnew" placeholder="Nouveau service…"><button class="btn" data-act="svc-add">Ajouter</button><input data-svcfilter placeholder="Filtrer…" style="margin-left:auto"></div>
    <ul class="svclist">${rows}</ul>`;
}

function viewCatalogue() {
  const rows = Object.values(P).map(p => `<tr><td>${CTX[p.ctx]}</td><td>${esc(p.label)}</td><td class="r">${eur(p.ht)}</td><td class="c">${Math.round(p.vat * 100)} %</td><td class="r">${eur(r2(p.ht * (1 + p.vat)))}</td><td>${p.contrib ? p.contrib + ' × 24 € TTC' : '–'}</td></tr>`).join('');
  return `<h1>Administration</h1>${adminTabs('catalogue')}
    <p class="hint">Prix de démonstration (lecture seule). La contribution environnementale est toujours une ligne séparée de 20 € HT + 20 % de TVA, non réductible et exonérable.</p>
    <table class="lines adm"><thead><tr><th>Contexte</th><th>Produit</th><th class="r">Prix HT</th><th class="c">TVA</th><th class="r">Prix TTC</th><th>Contribution</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function viewData() {
  return `<h1>Administration</h1>${adminTabs('donnees')}
    <p>Commandes enregistrées : <b>${S.orders.length}</b>. Codes : <b>${S.codes.length}</b>. Services : <b>${S.services.length}</b>.</p>
    <button class="btn" data-act="reset">Réinitialiser toutes les données de démonstration</button>`;
}

/* ---------- Création de codes ---------- */
function creatorPreview() {
  const c = ui.creator;
  const eff = c.effect;
  const lines = [];
  if (eff !== 'none') lines.push(esc(describeCode({ ...c, services: [], deferred: false })));
  if (c.services.length && ACC_CTX.includes(c.ctx)) lines.push('Services ajoutés aux accréditations ciblées : ' + esc(c.services.join(', ')));
  if (ACC_CTX.includes(c.ctx) && ['reduction', 'fixed'].includes(eff) && c.ctx !== 'ONLINE') lines.push('La contribution de 24 € <b>n\'est pas</b> réduite');
  if (ACC_CTX.includes(c.ctx) && ['free'].includes(eff) && c.ctx !== 'ONLINE') lines.push('La contribution est <b>exonérée</b> sur les produits gratuits');
  if (eff === 'contrib') lines.push('La personne ne paie que la contribution (24 €)');
  if (c.deferred) lines.push('Paiement différé : facture créée, paiement en attente');
  lines.push(`Valable du ${fdate(c.start)} au ${fdate(c.end)}`);
  lines.push(c.single ? "Usage unique : brûlé dès la première utilisation" : 'Utilisable plusieurs fois');
  if (c.person) lines.push('Réservé à ' + esc(c.person));
  if (c.company) lines.push('Réservé à ' + esc(c.company));
  const fact = describeCode({ ...c, services: c.services, deferred: c.deferred });
  return `<h2>Aperçu en direct</h2><div class="sum"><b>Ligne de facture (auto)</b><br>${esc(fact)}</div>
    <p class="ph">Ce que fera le code</p><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>
    <p class="ph">${c.count} code${c.count > 1 ? 's' : ''} à générer</p>`;
}

function viewCreator() {
  if (!ui.creator) ui.creator = defaultCreator();
  const c = ui.creator;
  if (ui.result) {
    return `<h1>Administration</h1>${adminTabs('codes')}<div class="card"><h2>${ui.result.length} code(s) créé(s)</h2>
      <div class="codesout">${ui.result.map(x => `<code>${x}</code>`).join('')}</div>
      <div class="nav"><button class="btn ghost" data-act="cr-again">Créer d'autres codes</button><a class="btn" href="#/admin">Voir la liste</a></div></div>`;
  }
  const targets = targetsFor(c.ctx).map(t => `<option value="${t}" ${c.target === t ? 'selected' : ''}>${esc(targetLabel(t))}</option>`).join('');
  const ctxChips = (list) => list.map(k => `<label class="chip ${c.ctx === k ? 'on' : ''}"><input type="radio" name="ctx" data-cr="ctx" value="${k}" ${c.ctx === k ? 'checked' : ''}>${CTX[k]}</label>`).join('');
  const eff = EFFECTS.filter(([k]) => !(k === 'contrib' && !ACC_CTX.includes(c.ctx)))
    .map(([k, l, d]) => `<label class="opt ${c.effect === k ? 'on' : ''}"><input type="radio" name="eff" data-cr="effect" value="${k}" ${c.effect === k ? 'checked' : ''}><b>${l}</b><small>${d}</small></label>`).join('');
  const showTarget = c.effect !== 'none' || (c.services.length > 0);
  const params = c.effect === 'none' ? '<p class="hint">Ce code n\'a pas d\'effet tarifaire. Utilisez-le pour du paiement différé ou pour ajouter des services.</p>' : `<div class="grid4">
    ${c.effect === 'reduction' ? `<div><label>Type</label><div class="seg"><label class="${c.mode === 'eur' ? 'on' : ''}"><input type="radio" name="mode" data-cr="mode" value="eur" ${c.mode === 'eur' ? 'checked' : ''}>€ HT</label><label class="${c.mode === 'pct' ? 'on' : ''}"><input type="radio" name="mode" data-cr="mode" value="pct" ${c.mode === 'pct' ? 'checked' : ''}>%</label></div></div>` : ''}
    ${['reduction', 'fixed'].includes(c.effect) ? `<div><label>${c.effect === 'fixed' ? 'Montant fixe par produit (€ HT)' : 'Valeur par produit'}</label><input type="number" min="0" step="0.01" data-cr="value" value="${c.value}"></div>` : ''}</div>`;
  const tgt = showTarget ? `<div class="grid4"><div class="span2"><label>Produit visé</label><select data-cr="target">${targets}</select></div>
    <div><label>Nombre de produits (quota)</label><input type="number" min="1" max="999" data-cr="quota" value="${c.quota}"></div></div>` : '';
  const svcList = S.services.map(s => `<li data-l="${esc(s.label.toLowerCase())}"><label><input type="checkbox" data-cr-svc value="${esc(s.label)}" ${c.services.includes(s.label) ? 'checked' : ''}> ${esc(s.label)}</label></li>`).join('');
  const svc = ACC_CTX.includes(c.ctx) ? `<div class="fld"><label>Services associés (optionnel · accréditations uniquement · sans effet sur le prix)</label>
    <div class="chosen" id="chosen">${chosenChips()}</div><input data-svcfilter placeholder="Rechercher un service…"><ul class="svcpick">${svcList}</ul></div>` : '';
  const opts = (arr, cur) => `<option value="">Aucune restriction</option>${arr.map(x => `<option ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
  const tpl = `<option value="">— Aucun modèle —</option>${S.templates.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('')}`;
  return `<h1>Créer des codes promo</h1>${adminTabs('codes')}<p class="hint">Un code = un seul effet. Le paiement différé et les services sont les seuls compléments possibles.</p>
  <div class="creator"><main>
    <section class="card"><h2>1 · Modèle <em>pré-remplit le formulaire</em></h2><div class="grid2"><div><label>Modèle de code</label><select data-act-change="tpl">${tpl}</select></div>
      <div><label>Nom interne</label><input data-cr="name" value="${esc(c.name)}" placeholder="Ex. Invités Marché 2027"></div></div></section>
    <section class="card"><h2>2 · Contexte <em>un seul choix</em></h2><div class="chips2"><span class="lab">Accréditations :</span>${ctxChips(['J', 'C', 'P', 'A', 'D', 'F', 'M', 'ONLINE'])}<span class="lab">Autres :</span>${ctxChips(['FILM', 'STAND'])}</div></section>
    <section class="card"><h2>3 · Effet du code <em>un seul</em></h2><div class="effs">${eff}</div><div class="panel">${params}${tgt}</div>${svc}
      <label class="tog"><input type="checkbox" data-cr="deferred" ${c.deferred ? 'checked' : ''}><span class="sw"></span><span>Paiement différé<small>La facture est créée mais reste impayée.</small></span></label></section>
    <section class="card"><h2>4 · Conditions</h2><div class="grid3"><div><label>Date de début</label><input type="date" data-cr="start" value="${c.start}"></div>
      <div><label>Date de fin</label><input type="date" data-cr="end" value="${c.end}"></div><div><label>Nombre de codes à générer</label><input type="number" min="1" max="50" data-cr="count" value="${c.count}"></div></div>
      <div class="grid2" style="margin-top:12px"><div><label>Réservé à la personne (optionnel)</label><select data-cr="person">${opts(ui.people, c.person)}</select></div>
      <div><label>Réservé à la société (optionnel)</label><select data-cr="company">${opts(ui.firms, c.company)}</select></div></div>
      <label class="tog"><input type="checkbox" data-cr="single" ${c.single ? 'checked' : ''}><span class="sw"></span><span>Utilisation unique<small>Le code est brûlé dès la première utilisation, même partielle.</small></span></label>
      <label class="tog"><input type="checkbox" data-cr="saveTpl" ${c.saveTpl ? 'checked' : ''}><span class="sw"></span><span>Enregistrer comme modèle<small>Réutilisable dans « Modèle de code ».</small></span></label>
      ${c.saveTpl ? `<div class="fld"><label>Nom du modèle</label><input data-cr="tplName" value="${esc(c.tplName)}"></div>` : ''}</section>
    <div class="nav"><a class="btn ghost" href="#/admin">Annuler</a><button class="btn" data-act="create-codes">Générer les codes</button></div></main>
    <aside><section class="card sticky" id="preview">${creatorPreview()}</section></aside></div>`;
}
function chosenChips() {
  const s = ui.creator.services;
  return s.length ? s.map(l => `<span class="chip on">${esc(l)} <button class="x" data-act="svc-del" data-l="${esc(l)}">✕</button></span>`).join('') : '<span class="hint">Aucun service sélectionné</span>';
}
function createCodes() {
  const c = ui.creator;
  if (c.effect === 'none' && !c.deferred && !c.services.length) return toast('Choisissez un effet, un service ou le paiement différé.');
  if (['reduction', 'fixed'].includes(c.effect) && !(c.value >= 0) ) return toast('Valeur invalide.');
  if (c.effect === 'reduction' && !(c.value > 0)) return toast('La réduction doit être supérieure à 0.');
  if (c.start > c.end) return toast('La date de fin précède la date de début.');
  const n = Math.max(1, Math.min(50, parseInt(c.count) || 1));
  const target = c.effect !== 'none' || c.services.length ? (c.target || targetsFor(c.ctx)[0]) : '';
  const out = [];
  for (let i = 0; i < n; i++) {
    let code; do { code = genCodeString(c.ctx); } while (S.codes.some(x => x.code === code));
    S.codes.push({ code, used: false, created: new Date().toISOString().slice(0, 10), name: c.name || 'Code ' + CTX[c.ctx], ctx: c.ctx, effect: c.effect, mode: c.mode,
      value: Number(c.value) || 0, target, quota: Math.max(1, parseInt(c.quota) || 1), services: ACC_CTX.includes(c.ctx) ? [...c.services] : [], deferred: c.deferred,
      start: c.start, end: c.end, single: c.single, person: c.person, company: c.company });
    out.push(code);
  }
  if (c.saveTpl) S.templates.push({ name: c.tplName || c.name || 'Modèle', cfg: { ...c, count: 1, saveTpl: false, tplName: '' } });
  save(); ui.result = out; render();
}
