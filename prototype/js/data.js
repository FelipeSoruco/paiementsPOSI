/* Catalogue, contextes et générateurs de données fictives. Tous les montants sont HT. */
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const pick = a => a[Math.floor(Math.random() * a.length)];

const CTX = {
  J: 'Jeunes (J)', C: 'Cinéphil (C)', P: 'Presse (P)', A: 'Presse audiovisuelle (A)', D: 'Département Film (D)',
  F: 'Festival (F)', M: 'Marché (M)', ONLINE: 'Marché Online', FILM: 'Film', STAND: 'Stand'
};
const CTX_ORDER = ['J', 'C', 'P', 'A', 'D', 'F', 'M', 'ONLINE', 'FILM', 'STAND'];
const ACC_CTX = ['J', 'C', 'P', 'A', 'D', 'F', 'M', 'ONLINE'];
const CONTRIB = { ht: 20, vat: 0.2 };

const P = {};
const addP = p => { P[p.key] = Object.assign({ kind: 'tarif', vat: 0.1, contrib: 0, pack: false, seats: 1 }, p); };
[['J', 'Jeunes (3 Huracán)'], ['C', 'Cinéphil'], ['P', 'Presse'], ['A', 'Presse audiovisuelle'], ['D', 'Département Film']]
  .forEach(([c, l]) => addP({ key: c.toLowerCase() + ':acc', ctx: c, label: 'Accréditation ' + l, ht: 0, vat: 0.2, contrib: 1 }));
addP({ key: 'f:normal', ctx: 'F', label: 'Accréditation Festival', ht: 0, vat: 0.2, contrib: 1 });
addP({ key: 'f:tardive', ctx: 'F', label: 'Accréditation Festival – tardive', ht: r2(200 / 1.1), vat: 0.1, contrib: 1 });
[['normal', 'Normal', 509], ['early-bird', 'Early Bird', 439], ['tardif', 'Tardif', 609]]
  .forEach(([k, l, ht]) => addP({ key: 'm:' + k, ctx: 'M', label: 'Marché – ' + l, ht, contrib: 1 }));
[['pc1-eb', 'PC 1 EB', 1480, 1], ['pc1-n', 'PC 1 N', 1680, 1], ['pc2-eb', 'PC 2 EB', 1910, 2], ['pc2-n', 'PC 2 N', 2060, 2],
 ['pc3-eb', 'PC 3 EB', 2690, 3], ['pc3-n', 'PC 3 N', 3040, 3], ['pc6-eb', 'PC 6 EB', 5580, 6], ['pc6-n', 'PC 6 N', 6080, 6]]
  .forEach(([k, l, ht, n]) => addP({ key: 'm:' + k, ctx: 'M', label: 'Marché – Package ' + l, ht, contrib: n, seats: n, pack: true }));
addP({ key: 'online:normal', ctx: 'ONLINE', label: 'Marché Online – Normal', ht: 219 });
addP({ key: 'online:early-bird', ctx: 'ONLINE', label: 'Marché Online – Early Bird', ht: 189 });
addP({ key: 'opt:pn', ctx: 'M', label: 'Option PN (Producers Network)', ht: 89, kind: 'option' });
addP({ key: 'opt:prio', ctx: 'M', label: 'Option PRIO', ht: 250, kind: 'option' });
addP({ key: 'film:fee', ctx: 'FILM', label: "Frais d'inscription film", ht: 50, vat: 0.2 });
addP({ key: 'film:upload-online', ctx: 'FILM', label: 'Upload en ligne', ht: 300, vat: 0.2 });
addP({ key: 'film:upload-dcp', ctx: 'FILM', label: 'Upload DCP', ht: 400, vat: 0.2 });
addP({ key: 'film:upload-physique', ctx: 'FILM', label: 'Livraison physique', ht: 450, vat: 0.2 });
[['table', 'Table', 40], ['chaise', 'Chaise', 15], ['installation', 'Installation du stand', 250], ['prise', 'Prise électrique', 60],
 ['spot', "Spot d'éclairage", 35], ['comptoir', 'Comptoir', 90], ['nettoyage', 'Nettoyage', 80]]
  .forEach(([k, l, ht]) => addP({ key: 'stand:' + k, ctx: 'STAND', label: l, ht, vat: 0.2 }));

const GROUPS = {
  'm:*': 'Marché – accréditation individuelle (tous tarifs)', 'online:*': 'Marché Online (tous tarifs)',
  'f:*': 'Festival (normale et tardive)', 'film:*': 'Tous les produits Film', 'stand:*': 'Tous les produits Stand'
};
const targetLabel = t => GROUPS[t] || (P[t] ? P[t].label : t);
const matches = (t, key) => {
  if (t === key) return true;
  if (!t.endsWith('*')) return false;
  const p = P[key];
  return key.startsWith(t.slice(0, -1)) && p.kind === 'tarif' && !p.pack;
};
function targetsFor(ctx) {
  const own = Object.values(P).filter(p => p.ctx === ctx).map(p => p.key);
  const grp = { M: 'm:*', ONLINE: 'online:*', F: 'f:*', FILM: 'film:*', STAND: 'stand:*' }[ctx];
  return grp ? [grp, ...own] : own;
}

const FIRST = ['Camille', 'Lucas', 'Inès', 'Mathis', 'Sofia', 'Hugo', 'Léa', 'Noah', 'Chloé', 'Ethan', 'Yasmine', 'Antoine', 'Marta', 'Omar', 'Elena', 'Julien', 'Aïcha', 'Thomas', 'Nora', 'Paul', 'Sven', 'Mei', 'Diego', 'Anaïs', 'Karim'];
const LAST = ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Lefèvre', 'Garcia', 'Roux', 'Fontaine', 'Rossi', 'Schmidt', 'Nakamura', 'Okafor', 'Silva', 'Haddad', 'Novak', 'Lindqvist', 'Moretti'];
const COMPANIES = ['Lumière Productions', 'Aurora Films', 'Studio Croisette', 'Nordlys Pictures', 'Cinéma Azur', 'Blue Hour Media', 'Maison Palmier', 'Golden Reel'];
const FILMS = ['La Nuit des Palmiers', 'Sous le Soleil de Minuit', 'Les Ombres Dorées', 'Le Dernier Projecteur', 'Mer Intérieure', 'Un Été à Cannes', 'La Route du Sud', 'Fragments de Lumière'];
const randName = () => pick(FIRST) + ' ' + pick(LAST).toUpperCase();
const randFilm = () => pick(FILMS);
