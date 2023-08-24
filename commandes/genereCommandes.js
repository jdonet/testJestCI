const produits = [
  { id: 'P1', nom: 'Produit A', prix: 10, stock: 10, minimum: 10 },
  { id: 'P2', nom: 'Produit B', prix: 20, stock: 50, minimum: 10 },
  { id: 'P3', nom: 'Produit C', prix: 30, stock: 100, minimum: 10 },
  { id: 'P4', nom: 'Produit D', prix: 40, stock: 150, minimum: 10 },
  { id: 'P5', nom: 'Produit E', prix: 50, stock: 0, minimum: 10 }
];

const statutCommande = ['PASSEE', 'VALIDEE', 'ENVOYEE', 'SUPPRIMEE'];

function genererQuantiteAleatoire(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genererProduitAleatoire() {
  return produits[Math.floor(Math.random() * produits.length)];
}

function genererCommande(i) {
  const commande = {
    id: Date.now().toString(),
    statut: statutCommande[i%4],
    produits: []
  };

  const nombreDeProduits = genererQuantiteAleatoire(1, 5);
  const produitsDejaAjoutes = new Set();

  for (let i = 0; i < nombreDeProduits; i++) {
    const produit = genererProduitAleatoire();

    if (produit && !produitsDejaAjoutes.has(produit.id)) {
      produitsDejaAjoutes.add(produit.id);
      const quantiteCommandee = genererQuantiteAleatoire(1, produit.stock);
      commande.produits.push({
        produit: produit,
        quantiteCommandee: quantiteCommandee
      });
    }
  }

  return commande;
}

function genererCommandes(nombreDeCommandes) {
  const commandes = [];
  for (let i = 0; i < nombreDeCommandes; i++) {
    commandes.push(genererCommande(i));
  }
  return commandes;
}

const commandesGenerees = genererCommandes(8);


exports.commandes = commandesGenerees;
exports.produits = produits;