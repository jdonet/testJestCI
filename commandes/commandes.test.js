const { commandes, produits } = require('./genereCommandes.js');
//const commandesData = JSON.parse(CommandesJSON);
const { envoyerCommande, approvisionner, ajouterAuStock, quantiteSuffisante, suprimerCommande, enleverDuStock, validerCommande, ajouterArticle } = require('./fonctionsCommandes.js');

/**
 * Test du nombre de commandes initial
 */
describe('Test nb commandes', () => {
  test('On doit avoir 8 commandes générées', () => {
    // console.log(JSON.stringify(produits))
    // console.log(JSON.stringify(commandes))
    expect(commandes.length).toBe(8);
  });
});

/**
 * Test de la methode envoyerCommande
 */
describe('Test envoyer commandes', () => {
  test('La commande est mise à jour en statut "ENVOYEE" si le statut est "VALIDEE"', () => {
    const commandeValidee = commandes[1];
    envoyerCommande(commandeValidee);
    expect(commandeValidee.statut).toBe('ENVOYEE');
  });

  test('La commande n\'est pas mise à jour si le statut n\'est pas "VALIDEE"', () => {
    const commandePassee = commandes[0];;

    envoyerCommande(commandePassee);
    expect(commandePassee.statut).toBe('PASSEE');
  });
});

/**
 * Test de la methode ajouterAuStock
 */
describe('Test ajouter au stock', () => {
  test('Vérification des quantites apres ajoutAuStock', () => {
    const prodq = produits[4].stock;
    const autreq = produits[1].stock;
    ajouterAuStock(produits, produits[4].id, 20);
    expect(produits[4].stock).toBe(prodq + 20);
    expect(produits[1].stock).toBe(autreq);
  });
});
/**
 * Test de la fonction quantiteSuffisante
 */
describe('Test qte suffisante', () => {

  test('Il doit rester suffisamment d\'articles pour les commander', () => {
    const produitToFind = produits[0];;
    expect(quantiteSuffisante(produits, produitToFind, 5)).toBe(true);
  });
  test('Il ne doit pas rester suffisamment d\'articles pour les commander', () => {
    const produitToFind = produits[0];;
    expect(quantiteSuffisante(produits, produitToFind, 15)).toBe(false);
  });
  test('Avec une quantite fausse', () => {
    const produitToFind = produits[0];
    expect(quantiteSuffisante(produits, produitToFind, "ddd")).toBe(false);
  });
  test('Avec une quantite négative', () => {
    const produitToFind = produits[0];
    expect(quantiteSuffisante(produits, produitToFind, -10)).toBe(true);
  });
});
/**
 * Test de la fonction approvisionner
 */
describe('Test approvisionner', () => {

  test('Il ne faut pas réapprovisionner ce produit', () => {
    const produitToFind = produits[3];
    expect(approvisionner(produits, produitToFind.id)).toBe(false);
  });
  test('Il ne faut pas réapprovisionner ce produit', () => {
    const produitToFind = produits[4];
    produitToFind.stock = 0;
    expect(approvisionner(produits, produitToFind.id)).toBe(true);
  });
});


/**
 * Test de la fonction ajouterAuStock
 */
describe('Test ajouter au stock', () => {

  test('ajouterAuStock', () => {
    const produitToFind = produits[0];
    ajouterAuStock(produits, produitToFind.id, 10)
    expect(produits[0].stock).toBe(20);
  });
});

/**
 * Test de la fonction enleverDuStock
 */
describe('Test enlever du stock', () => {

  test('enleverDuStock une quantité ok', () => {
    const produitToFind = produits[0];
    produitToFind.stock = 50;
    enleverDuStock(produits, produitToFind.id, 10);
    expect(produitToFind.stock).toBe(40);
  });
  test('enleverDuStock une quantité tp gde', () => {
    const produitToFind = produits[0];
    produitToFind.stock = 20;
    enleverDuStock(produits, produitToFind.id, 30)
    expect(produits[0].stock).toBe(20);
  });
  test('enleverDuStock on arrive a 0', () => {
    const produitToFind = produits[0];
    produitToFind.stock = 20;
    enleverDuStock(produits, produitToFind.id, 20)
    expect(produits[0].stock).toBe(0);
  });
});

/**
 * Test de la fonction supprimercommandes
 */
describe('Test valider commande', () => {

  test('validerCommande', () => {
    const commandeValide = {
      "id": "1692837786262",
      "statut": "PASSEE",
      "produits": [
        {
          "produit": {
            "id": "P1",
            "nom": "Produit A",
            "prix": 40,
            "stock": 150,
            "minimum": 10
          },
          "quantiteCommandee": 20
        },
        {
          "produit": {
            "id": "P2",
            "nom": "Produit B",
            "prix": 30,
            "stock": 100,
            "minimum": 10
          },
          "quantiteCommandee": 30
        }
      ]
    };
    //maj des stocks produits pour eviter les soucis
    produits[0].stock = 100;
    produits[1].stock = 100;
    validerCommande(commandeValide, produits);
    expect(commandeValide.statut).toBe("VALIDEE");
    expect(produits[0].stock).toBe(80);
    expect(produits[1].stock).toBe(70);
    //avec une quantite insuffisante pour un produit
    commandeValide.statut = "PASSEE";
    produits[1].stock = 10;
    validerCommande(commandeValide, produits);
    expect(commandeValide.statut).toBe("SUPPRIMEE");
    expect(produits[0].stock).toBe(80);
    expect(produits[1].stock).toBe(10);
    //on ne revalide pas une cde validee
    commandeValide.statut = "VALIDEE";
    produits[1].stock = 100;
    validerCommande(commandeValide, produits);
    expect(commandeValide.statut).toBe("VALIDEE");
    expect(produits[0].stock).toBe(80);
    expect(produits[1].stock).toBe(100);
  });

});

/**
 * Test de la fonction ajouterArticle
 */
describe('Ajout d\'articles à une cde', () => {

  test('ajoutArticle', () => {
    const commandeValide = {
      "id": "1692837786262",
      "statut": "PASSEE",
      "produits": [
        {
          "produit": {
            "id": "P1",
            "nom": "Produit A",
            "prix": 40,
            "stock": 150,
            "minimum": 10
          },
          "quantiteCommandee": 20
        },
        {
          "produit": {
            "id": "P2",
            "nom": "Produit B",
            "prix": 30,
            "stock": 100,
            "minimum": 10
          },
          "quantiteCommandee": 30
        }
      ]
    };
    //on ajoute une qte a un produit deja present
    ajouterArticle(commandeValide, produits, "P1", 10)
    expect(commandeValide.produits[0].quantiteCommandee).toBe(30);
    expect(commandeValide.produits[1].quantiteCommandee).toBe(30);
    //on ajoute un nouveau produit
    ajouterArticle(commandeValide, produits, "P3", 10)
    expect(commandeValide.produits[2].quantiteCommandee).toBe(10);
    //on ajoute un produit qui n'existe pas
    ajouterArticle(commandeValide, produits, "jdhfjdf", 10)
    expect(commandeValide.produits.length).toBe(3);
  });
});

/**
 * Test de la fonction supprimercommandes
 */
describe('Test supprimer commandes', () => {

  test('suprimerCommande', () => {
    let commandeToBeDeleted = commandes[5]
    //le premier produit de cette cde
    let p = commandeToBeDeleted.produits[0].produit
    let q = commandeToBeDeleted.produits[0].quantityOrdered
    // Appeler la fonction de suppression
    suprimerCommande(commandeToBeDeleted, produits);

    //chercher ce produit dans tous les produits
    const produitFound = produits.find(prod => p.id === prod.id);
    expect(produitFound.stock).toBe(p.stock + q);

    // Essayer de supprimer une commande déjà supprimée
    expect(() => suprimerCommande(commandeToBeDeleted)).toThrow("Impossible de supprimer une commande");
  });
});