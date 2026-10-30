# Maquette fonctionnelle – page de paiement

Ouvrir `index.html` dans un navigateur (aucune installation, aucun serveur). Les données sont fictives et se conservent dans le `localStorage` du navigateur.

Parcours client : Sélection des produits → Récapitulatif (code promo, choix des produits visés) → Facturation → Paiement → Confirmation.
Administration : création/gestion des codes promo, liste de services, catalogue (lecture seule), réinitialisation.

Règles principales
- Un code = un seul effet (réduction, montant fixe, produit gratuit, contribution seule, aucun) + services optionnels + paiement différé.
- La contribution environnementale (20 € HT, TVA 20 %) est une ligne séparée : jamais réductible, exonérée uniquement par un produit gratuit.
- À l'application d'un code, l'utilisateur choisit les produits (personnes) concernés, dans la limite du quota du code.
- Un code à usage unique est « brûlé » à la validation de la commande.
- Codes de test : voir « Codes de test disponibles » dans le récapitulatif.
