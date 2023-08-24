

// Fonction pour mettre à jour le statut d'une commande à "ENVOYEE" si le statut est "VALIDEE"
function envoyerCommande(commande) {
  if (commande.statut === 'VALIDEE') {
    commande.statut = 'ENVOYEE';
  }
}
exports.envoyerCommande = envoyerCommande;


// Fonction qui indique s’il reste suffisamment d’articles en stock pour commander la quantité passée en paramètre
function quantiteSuffisante(produits, produitCherche, quantity) {
  // Utilisation de la fonction find pour rechercher le produit dont l'ID correspond à celui recherché
  const produitTrouve = produits.find(produit => produit.id === produitCherche.id);

  if (produitTrouve && produitTrouve.stock >= quantity) {
    return true;
  } else {
    return false;
  }
}
exports.quantiteSuffisante = quantiteSuffisante;

// ’indiquer s’il faut recommander des articles (quantité en stock<quantité mini)
function approvisionner(produits, produitChercheId) {
  // Utilisation de la fonction find pour rechercher le produit dont l'ID correspond à celui recherché
  const produitTrouve = produits.find(produit => produit.id === produitChercheId);
  if (produitTrouve && produitTrouve.stock >= produitTrouve.minimum) {
    return false;
  } else {
    return true;
  }
}
exports.approvisionner = approvisionner;

function ajouterAuStock(produits, produitIDToUpdate, quantity) {
  // Utilisation de la fonction find pour rechercher le produit dont l'ID correspond à celui recherché
  /*for (const produit of produits) {
    if (produit.id === produitIDToUpdate) {
      produit.stock += quantity;
    }
    }
*/
  //avec un foreach
  produits.forEach(produit => {
    produit.id === produitIDToUpdate ? produit.stock += quantity : "";
  });
}
exports.ajouterAuStock = ajouterAuStock;

function enleverDuStock(produits, produitIDToUpdate, quantity) {
  //avec un foreach
  produits.forEach(produit => {
    produit.id === produitIDToUpdate && produit.stock >= quantity ? produit.stock -= quantity : "";
  });
}
exports.enleverDuStock = enleverDuStock;


function validerCommande(commande, produits) {
  let possible = true;
  //verif stocks
  commande.produits.forEach(produitCherche => {
    quantiteSuffisante(produits, produitCherche.produit, produitCherche.quantiteCommandee) ? "" : possible = false;
  });

  //vérifier l'état de la commande
  if (commande.statut == "PASSEE") {
    if (possible) {
      //remettre les stocks a jour
      commande.produits.forEach(produitCherche => {
        enleverDuStock(produits, produitCherche.produit.id, produitCherche.quantiteCommandee);
      });
      commande.statut = "VALIDEE";
    } else {
      commande.statut = "SUPPRIMEE";
    }
  }
}
exports.validerCommande = validerCommande;


function ajouterArticle(commande, produits, produitID, quantite) {
  let trouve = false;
  //on commence par chercher s'il est dans la commande
  commande.produits.forEach(produitCherche => {
    if (produitCherche.produit.id === produitID) {
      produitCherche.quantiteCommandee += quantite;
      trouve = true;
    }
  });
  if (!trouve) { //S'il n'est pas dans la cde ,l'ajouter 
    //Commencer par le chercher dans la liste des produits
    const produitTrouve = produits.find(produit => produit.id === produitID);
    //s'il est trouvé, l'ajouter
    if (produitTrouve) {
      commande.produits.push({
        produit: produitTrouve,
        quantiteCommandee: quantite
      });
    }
  }
}
exports.ajouterArticle = ajouterArticle;


function suprimerCommande(commande, produits) {
  //vérifier l'état de la commande
  if (commande.statut == "PASSEE") {
    commande.statut = "SUPPRIMEE"
  } else if (commande.statut == "VALIDEE") {
    //remettre les stocks a jour
    /* for (const produitCherche of commande.produits) {
       //chercher ce produit
       const produitTrouve = produits.find(produit => produit.id === produitCherche.produit.id);
       produitTrouve.stock +=produitCherche.quantityOrdered;
     }
 */
    //avec un foreach
    commande.produits.forEach(produitCherche => {
      const produitTrouve = produits.find(produit => produit.id === produitCherche.produit.id);
      produitTrouve.stock += produitCherche.quantityOrdered;
    });
    commande.statut = "SUPPRIMEE"
  } else {
    throw new Error("Impossible de supprimer une commande avec le statut " + commande.statut)
  }
}
exports.suprimerCommande = suprimerCommande;

