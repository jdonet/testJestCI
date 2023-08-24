const pool = require('./DBPool');

const { DateTime } = require('luxon');
const { Client } = require('pg');
const HttpError = require("../HttpError");
const cartQueries = require("./CartQueries");

/**
 * Construit un objet contenant toutes les informations d'une commande, y compris
 * les items du panier de la commande. Utilisé par les méthodes getAllOrders(...)
 * et getOrderByPurchaseOrderKey(...).
 * 
 * @param {object} orderRow Objet représentant une rangée dans la table purchase_order
 * @param {Client} client (optionnel) client node-postgres à utiliser pour une transaction
 * @returns 
 */
const buildOrderResponseObject = async (orderRow, client) => {
    // Récupère le cart associé à la commande
    const orderKey = orderRow.purchase_order_key;

    const cartResult = await (client || pool).query(
        `SELECT product_id, quantity, sale_price
         FROM
             cart_product cp
             JOIN cart c ON c.cart_key = cp.cart_key
         WHERE
             c.purchase_order_key = $1`,
        [orderKey]
    );

    // Transforme les rangées du résultat de la requête en objets pour
    // les items du panier (tel qu'on s'attend à retrouver dans la réponse à
    // l'appel du REST API).
    const cart = cartResult.rows.map(cartRow => {
        return {
            productId: cartRow.product_id,
            quantity: cartRow.quantity,
            salePrice: cartRow.sale_price
        };
    });

    const order = {
        id: orderRow.purchase_order_key,
        userId: orderRow.user_account_id,
        cart: cart,
        paiement: {
            nomCarteCredit: orderRow.payment_name,
            noCarteCredit: orderRow.payment_credit_card_number,
            expCarteCredit: orderRow.payment_credit_card_exp
        },
        modeExp: orderRow.exp_method,
        adresse: {
            nom: orderRow.address_name,
            adresse: orderRow.address,
            ville: orderRow.address_city,
            province: orderRow.address_province,
            codePostal: orderRow.address_postal_code
        },
        orderDateTime: orderRow.order_date_time
    };

    return order;
};


const getAllOrders = async () => {
    // Cette requête est effectuée dans une seule transaction
    const client = await pool.connect();

    try {
        // Initie la transaction
        await client.query('BEGIN');
        const ordersResult = await client.query(
            `SELECT
                purchase_order_key, user_account_id,
                payment_name, payment_credit_card_number, payment_credit_card_exp, exp_method,
                address_name, address, address_city, address_province, address_postal_code, order_date_time
            FROM purchase_order
            ORDER BY purchase_order_key`
        );

        // On doit récupérer les items de panier pour chaque commande dans le résultat de la requête ci-haut.
        // La fonction buildOrderResponseObject() permet de récupérer ces items de panier dans une autre requête, selon
        // la clé primaire (purchase_order_key) de la rangée d'une commande.
        // Or, chacun de ces appels à buildOrderResponseObject() est asynchrone et résulte donc en une promesse.
        // On obtient donc, avec l'expression suivante, un tableau de promesses en valeur de retour de la fonction map(...) :
        const orderResponsePromises = ordersResult.rows.map(orderRow => buildOrderResponseObject(orderRow, client));

        // Ce qu'on veut retourner est plutôt une promesse pour un tableau. On utilise la méthode Promise.all() afin de
        // convertir le tableau de promesse en promesse pour un tableau. La promesse en sortie sera résolue lorsque toutes les promesses
        // du tableau en entrée seront résolues.
        const orders = await Promise.all(orderResponsePromises);

        // Termine la transaction en l'appliquant (commit)
        await client.query("COMMIT");

        return orders;

    } catch (err) {
        // Annule la transaction en cas d'échec
        await client.query("ROLLBACK");
        throw err;
    } finally {
        // IMPORTANT : retourne le client au pool de connexions.
        // Si on ne fait pas ça dans la section finally, il y a un risque de "fuite"
        // de connexions à la BD et l'application finira par planter à cause d'épuisement
        // des connexions du pool.
        client.release();
    }
};
exports.getAllOrders = getAllOrders;

/**
 * Obtient un objet représentant une commande qui a déjà été passée.
 * 
 * @param {number} purchaseOrderKey La valeur de clé primaire de la commande dans la table purchase_order
 * @param {Client} client (optionnel) client node-postgres à utiliser pour une transaction
 * @returns 
 */
const getOrderByPurchaseOrderKey = async (purchaseOrderKey, clientParam) => {
    // Cette requête est effectuée dans une seule transaction
    // OU bien si le paramètre clientParam est spécifié, la requête participera à une transaction
    // existante.
    const client = clientParam || await pool.connect();

    try {
        // Initie la transaction (si requis)
        if (!clientParam) {
            await client.query('BEGIN');
        }

        const ordersResult = await client.query(
            `SELECT
                 purchase_order_key, user_account_id,
                 payment_name, payment_credit_card_number, payment_credit_card_exp, exp_method,
                 address_name, address, address_city, address_province, address_postal_code, order_date_time
             FROM purchase_order
             WHERE purchase_order_key = $1`,
            [purchaseOrderKey]
        );

        const orderRow = ordersResult.rows[0];
        if (!orderRow) {
            throw new Error(`Impossible de trouver la commande avec purchaseOrderKey ${purchaseOrderKey}`);
        }
        const order = await buildOrderResponseObject(orderRow, client);

        // Termine la transaction en l'appliquant (commit), si requis
        if (!clientParam) {
            await client.query("COMMIT");
        }

        return order;
    } catch (err) {
        if (!clientParam) {
            // Annule la transaction en cas d'échec (si requis)
            await client.query("ROLLBACK");
        }
        throw err;
    } finally {
        // IMPORTANT : retourne le client au pool de connexions (s'il s'agit d'une nouvelle transaction).
        // Si on ne fait pas ça dans la section finally, il y a un risque de "fuite"
        // de connexions à la BD et l'application finira par planter à cause d'épuisement
        // des connexions du pool.
        if (!clientParam) {
            client.release();
        }
    }
};

/**
 * Place une commande pour un utilisateur. Le panier actuel de l'utilisateur sera mis dans la commande.
 * 
 * @param {object} order Objet contenant les informations pour la commande, selon la structure suivante:
 * 
 * {
 *   userId: "josbleau",
 *   paiement: {
 *     nomCarteCredit: "Jos Bleau",
 *     noCarteCredit: "4555 5555 5555 5555",
 *     expCarteCredit: "2025/02"
 *   },
 *   modeExp: "purolator",
 *   adresse: {
 *     nom: "M. Joseph Bleau",
 *     adresse: "123 rue Générique",
 *     ville: "Sherbrooke",
 *     province: "QC",
 *     codePostal: "J1J 1J1"
 *   }
 * }
 * 
 * @returns 
 */
const placeOrder = async (order) => {
    if (!order.userId) {
        throw new HttpError(400, 'Le champ userId est requis');
    }

    // Ici on s'assure que la propriété userId sera convertie en chaîne de caractères:
    const userId = "" + order.userId;

    if (!order.paiement) {
        throw new HttpError(400, 'Le champ paiement est requis');
    }
    if (!order.paiement.nomCarteCredit) {
        throw new HttpError(400, 'Le champ paiement.nomCarteCredit est requis');
    }
    if (!order.paiement.noCarteCredit) {
        throw new HttpError(400, 'Le champ paiement.noCarteCredit est requis');
    }
    if (!order.paiement.noCarteCredit) {
        throw new HttpError(400, 'Le champ paiement.expCarteCredit est requis');
    }
    const paiement = {
        nomCarteCredit: "" + order.paiement.nomCarteCredit,
        noCarteCredit: "" + order.paiement.noCarteCredit,
        expCarteCredit: "" + order.paiement.expCarteCredit
    };

    if (!order.modeExp) {
        throw new HttpError(400, 'Le champ modeExp est requis');
    }
    const modesExpPermis = ['postescanada', 'purolator', 'fedex'];
    if (!modesExpPermis.includes(order.modeExp)) {
        throw new HttpError(400, 'Le champ modeExp doit avoir une des valeurs suivantes: ' + modesExpPermis);
    }

    const modeExp = "" + order.modeExp;

    if (!order.adresse) {
        throw new HttpError(400, 'Le champ adresse est requis');
    }
    if (!order.adresse.nom) {
        throw new HttpError(400, 'Le champ adresse.nom est requis');
    }
    if (!order.adresse.adresse) {
        throw new HttpError(400, 'Le champ adresse.adresse est requis');
    }
    if (!order.adresse.ville) {
        throw new HttpError(400, 'Le champ adresse.ville est requis');
    }
    if (!order.adresse.province) {
        throw new HttpError(400, 'Le champ adresse.province est requis');
    }
    if (!order.adresse.codePostal) {
        throw new HttpError(400, 'Le champ adresse.codePostal est requis');
    }

    const adresse = {
        nom: "" + order.adresse.nom,
        adresse: "" + order.adresse.adresse,
        ville: "" + order.adresse.ville,
        province: "" + order.adresse.province,
        codePostal: "" + order.adresse.codePostal
    };

    // Étape 2 : initier une transaction.
    // Avant d'effectuer des requêtes à la BD, on doit obtenir un objet Client et initier une transaction.
    // La gestion d'erreur doit être faite correctement et l'objet Client retourné au pool de connexions
    // avant de sortir de la fonction.
    // Inspirez-vous des autres fonctions qui font des transactions, par exemple updateCurrentCartEntry()
    // dans le module CartQueries.

    const client = await pool.connect();

    try {
        // Initie la transaction
        await client.query('BEGIN');

        // Étape 3.1 : faire une requête pour obtenir le panier actuel de l'utilisateur.
        //
        // Vous pouvez pour ce faire employer la fonction getCurrentCartByUserId() du module CartQueries.
        // Si vous faites cela, il faut vous assurer de modifier la fonction afin d'accepter un
        // paramètre optionel pour l'objet Client, qui sera utilisé seulement si passé, afin que
        // la requête dans cette fonction puisse participer à la transaction en cours. On devra
        // donc passer l'objet Client à la fonction. Inspirez-vous de la fonction getCurrentCartKey() dans
        // le module CartQueries pour savoir comment faire.
        //
        // Une autre alternative serait de faire une requête SQL ici-même, mais cela est moins propre
        // car on duplique la même logique à deux endroits.
        const userCart = await cartQueries.getCurrentCartByUserId(userId, client);

        // Étape 3.2 : si le panier trouvé à l'étape précédente n'existe pas ou est vide, c'est une erreur.
        // On doit donc lancer une exception HttpError avec le statut HTTP 400 et un message d'erreur
        // indiquant que le panier du client est vide.
        if (!userCart || userCart.length < 1) {
            throw new HttpError(400, `Le cart de l'usager ${userId} est vide`);
        }

        // Étape 4 : obtenir la date et heure actuelle pour pouvoir insérer cette valeur pour la colonne
        // order_date_time dans la table purchase_order.
        // Ici on vous donne la solution :) .
        // const orderDateTime = DateTime.now().toString() // fournit la date et heure actuelle en format ISO 8601 (p.ex. "2023-05-11T14:15:30.012-04:00");
        const orderDateTime = DateTime.now().toString() // fournit la date et heure actuelle en format ISO 8601 (p.ex. "2023-05-11T14:15:30.012-04:00");

        // Étape 5.1 : insérer les informations de la commande dans la table purchase_order.
        // À ce stade vous devriez avoir toutes les valeurs pour insérer une nouvelle rangée dans
        // cette table. Écrivez une requête INSERT pour ce faire. Utilisez une clause RETURNING
        // afin de retourner dans le résultat la nouvelle valeur de clé primaire générée automatiquement
        // (elle servira plus loin).
        const orderResult = await client.query(
            `INSERT INTO purchase_order
                (user_account_id, payment_name, payment_credit_card_number, payment_credit_card_exp,
                exp_method, address_name, address, address_city, address_province, address_postal_code,
                order_date_time)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING purchase_order_key`,
            [userId, paiement.nomCarteCredit, paiement.noCarteCredit, paiement.expCarteCredit,
                modeExp, adresse.nom, adresse.adresse, adresse.ville, adresse.province, adresse.codePostal,
                orderDateTime]
        );

        // Étape 5.2 : avec le résultat de la requête précédente (ça devrait être une seule rangée
        // avec la valeur générée pour purchase_order_key), récupérer la valeur de clé primaire
        // de la nouvelle commande.
        const orderRow = orderResult.rows[0];
        if (orderRow) {
            const purchaseOrderKey = orderRow.purchase_order_key;

            // Étape 6 : mettre à jour les enregistrements du panier actuel avec les prix actuels
            // des articles achetés. Pour ce faire, vous pouvez utiliser la requête UPDATE qui vous est
            // gracieusement fournie. Il vous reste seulement à passer la bonne valeur dans le tableau
            // des paramètres !
            // UPDATE cart_product cp SET sale_price = p.price
            // FROM product p, cart c
            // WHERE
            //    p.product_id = cp.product_id
            //    AND c.cart_key = cp.cart_key
            //    AND c.user_account_id = $1
            //    AND c.purchase_order_key IS NULL
            await client.query(
                `UPDATE cart_product cp SET sale_price = p.price
                FROM product p, cart c
                WHERE
                    p.product_id = cp.product_id
                    AND c.cart_key = cp.cart_key
                    AND c.user_account_id = $1
                    AND c.purchase_order_key IS NULL`,
                [userId]
            );

            // Étape 7 : mettre à jour l'enregistrement du panier actuel de l'utilisateur (dans la table cart)
            // afin que sa colonne de clé étrangère purchase_order_key pointe vers la rangée de la nouvelle
            // commande qui a été insérée à l'étape 5.1.
            // Écrivez une requête UPDATE pour ce faire.
            // Indice: on doit appliquer deux critères de filtres pour mettre à jour la bonne rangée dans la
            //         table cart:
            //          - Choisir le panier *actuel* de l'utilisateur (purchase_order_key doit être NULL)
            //          - Choisir le bon utilisateur selon son user_account_id.
            // On met à jour le cart actuel de l'usager afin de le rattacher à la commande
            await client.query(
                `UPDATE cart SET purchase_order_key = $1
                 WHERE purchase_order_key IS NULL and user_account_id = $2`,
                [purchaseOrderKey, userId]
            );

            // Étape 8 : obtenir un objet qui représente la nouvelle commande qui vient d'être passée, afin
            // de pouvoir le fournir en réponse à l'appel au REST API. Vous pouvez utiliser la
            // fonction getOrderByPurchaseOrderKey() pour ce faire. N'oubliez pas de passer l'objet client
            // afin que les requêtes faites par cette fonction participent à la transaction courante !
            const newOrder = await getOrderByPurchaseOrderKey(purchaseOrderKey, client);

            // Étape 9 : faire le commit de la transaction en cours
            await client.query("COMMIT");

            // Étape 10 : retourner l'objet de commande qui a été obtenu à l'étape 8.
            return newOrder;
        } else {
            throw new Error("Impossible d'insérer l'entrée dans purchase_order");
        }

        // Ne pas oublier de gérer les erreurs (clause catch qui annule la transaction) et de
        // retourner l'objet client au pool de connexions dans la clause finally !
    } catch (err) {
        // Annule la transaction en cas d'échec
        await client.query("ROLLBACK");
        throw err;
    } finally {
        // IMPORTANT : retourne le client au pool de connexions.
        // Si on ne fait pas ça dans la section finally, il y a un risque de "fuite"
        // de connexions à la BD et l'application finira par planter à cause d'épuisement
        // des connexions du pool.
        client.release();
    }
};
exports.placeOrder = placeOrder;
