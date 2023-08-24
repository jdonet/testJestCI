const pool = require('./DBPool');

const HttpError = require("../HttpError");
const { Client } = require('pg');

const userAccountQueries = require("./UserAccountQueries");
const getImagePathForProductId = require("./ProductQueries").getImagePathForProductId;

/**
 * Obtient le panier actuel d'un utilisateur. Le panier actuel d'un utilisateur est celui
 * qui ne fait pas encore partie d'une commande, soit qui a une valeur NULL pour la colonne
 * purchase_order_key.
 * 
 * @param {string} userId Identifiant de l'utilisateur
 * @returns Promesse pour un tableau avec des objets représentant les items dans le panier,
 *          ou encore un tableau vide si le panier n'existe pas. Les éléments du tableau ont
 *          les propriétés suivantes:
 *          product : objet d'informations du produit avec les propriétés id, name, price,
 *                    description et image
 *          quantity : quantité du produit dans le panier
 * 
 */
const getCurrentCartByUserId = async (userId, client) => {
    const result = await (pool || client).query(
        `SELECT
            c.cart_key, p.product_id, p.name, p.price, p.description, cp.quantity
        FROM
            cart c
            JOIN cart_product cp ON cp.cart_key = c.cart_key
            JOIN product p ON p.product_id = cp.product_id
        WHERE
            c.user_account_id = $1
            AND c.purchase_order_key IS NULL
        ORDER BY p.product_id`,
        [userId]
    );

    return result.rows.map(row => {
        return {
            product: {
                id: row.product_id,
                name: row.name,
                price: row.price,
                desc: row.description,
                image: getImagePathForProductId(row.product_id)
            },
            quantity: row.quantity
        };
    });
};
exports.getCurrentCartByUserId = getCurrentCartByUserId;


/**
 * Obtient la valeur de clé primaire (cart_key) du panier actuel d'un utilisateur,
 * s'il existe. Le panier actuel d'un utilisateur est celui qui ne fait pas encore
 * partie d'une commande, soit qui a une valeur NULL pour la colonne purchase_order_key.
 * Si l'utilisateur n'a pas de panier actuel, la valeur undefined est retournée.
 * 
 * @param {string} userId Identifiant de l'utilisateur
 * @param {Client} client (optionnel) client node-postgres à utiliser pour une transaction
 * @returns Promesse pour la valeur de cart_key ou undefined.
 */
const getCurrentCartKey = async (userId, client) => {
    const result = await (client || pool).query(
        `SELECT
            cart_key
        FROM
            cart
        WHERE
            user_account_id = $1
            AND purchase_order_key IS NULL`,
        [userId]
    );

    const row = result.rows[0];
    if (row) {
        return row.cart_key;
    }

    return undefined;
};


/**
 * Créé une nouvelle entrée de panier actuel (c'est-à-dire non lié à une commande, donc
 * purchase_order_key est NULL) pour l'identifiant de l'utilisateur spécifié. La valeur
 * de clé primaire (cart_key) de la nouvelle rangée est retournée.
 * 
 * @param {string} userId Identifiant de l'utilisateur
 * @param {Client} client (optionnel) client node-postgres à utiliser pour une transaction
 * @returns Promesse pour la nouvelle valeur de cart_key
 */
const createCurrCart = async (userId, client) => {
    const result = await (client || pool).query(
        `INSERT INTO cart (user_account_id) 
         VALUES ($1)
         RETURNING cart_key
        `,
        [userId]
    );

    const row = result.rows[0];
    if (row) {
        return row.cart_key;
    }

    // Cela ne devrait jamais arriver
    throw new Error("L'insertion a échoué pour une raison inconnue");
};


/**
 * Met à jour une entrée de panier, afin de l'ajouter ou de modifier sa quantité.
 * 
 * @param {string} userId Identifiant de l'utilisateur
 * @param {string} productId Identifiant du produit
 * @param {number} quantity Quantité du produit. Si null ou undefined, on aura comme
 *                          comportement d'incrémenter la quantité actuelle du produit
 *                          ou de l'ajouter (avec la quantité 1) s'il n'est pas encore
 *                          dans le panier. Si la quantité est spécifiée, la quantité
 *                          pour l'item dans le panier prendra la nouvelle valeur.
 * @returns Promesse pour objet représentant l'entrée dans le panier modifiée ou ajoutée,
 *          avec les propriétés productId et quantity.
 */
const updateCurrentCartEntry = async (userId, productId, quantity) => {
    // Cette requête est effectuée dans une seule transaction
    const client = await pool.connect();

    // Il est important de toujours exécuter une transaction de BD dans une structure try .. catch .. finally
    // car il faut avoir un moyen d'annuler la transaction si une erreur survient (dans le bloc catch) et
    // on doit *obligatoirement* retourner l'objet Client au pool de connexion avec la fonction release() dans
    // le bloc finally.
    try {
        // Initie la transaction
        await client.query('BEGIN');

        // L'objet client est passé à la fonction getUserAccount(), les requêtes dans
        // celle-ci seront exécutées dans la même transaction :
        const user = await userAccountQueries.getUserAccount(userId, client);

        if (!user) {
            // Créé le compte s'il n'existe pas déjà
            await userAccountQueries.createUserAccount(userId, null, client);
        }

        // Récupère la clé du panier actuel de l'usager. La valeur retournée sera undefined
        // si le panier actuel est inexistant.
        let currCartKey = await getCurrentCartKey(userId, client);

        if (!currCartKey) {
            // Il n'existe pas déjà un panier actuel pour l'usager, on en créé un
            currCartKey = await createCurrCart(userId, client);
            if (!currCartKey) {
                // Quelque chose ne tourne pas rond, on n'a pas pu créer le panier
                throw new Error(`Impossible de créer un cart pour l'usager ${userId}`);
            }
        }

        // À ce stade-ci, on est sûr qu'un panier actuel existe pour l'usager et on aura
        // la valeur de clé primaire de celui-ci dans la variable currCartKey.

        // Récupère la quantité de l'article dans le panier actuel de l'usager (si l'article
        // est présent).
        // Noter qu'on utilise l'objet client (plutôt que pool) pour appeller la fonction query(),
        // c'est nécessaire pour que la requête soit exécutée à l'intérieur de la transaction en cours.
        // Si on appelait pool.query(...), la requête aurait lieu à l'extérieur de la transaction et
        // le résultat des requêtes précédents (p.ex. création du cart) ne seraient pas visibles pour
        // cette requête.
        const currQuantityResult = await client.query(
            `SELECT quantity
             FROM
                 cart_product cp
                 JOIN cart c ON c.cart_key = cp.cart_key
             WHERE
                 c.cart_key = $1
                 AND cp.product_id = $2 
                 AND c.purchase_order_key IS NULL`,
            [currCartKey, productId]
        );

        let currCartItem;
        if (currQuantityResult.rowCount == 0) {
            // Aucune entrée n'existe avec la quantité, il faut l'ajouter
            const insertResult = await client.query(
                `INSERT INTO cart_product (cart_key, product_id, quantity) 
                 VALUES ($1, $2, $3) 
                 RETURNING product_id, quantity`,
                [currCartKey, productId, quantity || 1]
            );

            // La clause RETURNING va nous donner le productId et la quantité insérée,
            // on se sert de ce résultat pour construire l'objet currCartItem qui
            // sera utilisé comme réponse à l'appel au REST API.
            const row = insertResult.rows[0];
            currCartItem = {
                productId: row.product_id,
                quantity: row.quantity
            };
        } else {
            // La requête devrait retourner une seule rangée si l'article est présent
            // dans le panier.
            const currQuantity = currQuantityResult.rows[0].quantity;

            let newQuantity;
            if (quantity == null) {
                // La quantité n'est pas spécifiée dans l'appel au REST API, on incrémente donc
                // la quantité de 1.
                newQuantity = currQuantity + 1;
            } else {
                // La quantité est spécifiée, on remplace donc la quantité actuelle par celle fournie.
                newQuantity = quantity;
            }

            const updateResult = await client.query(
                `UPDATE cart_product SET quantity = $1 
                 WHERE cart_key = $2 AND product_id = $3 
                 RETURNING product_id, quantity`,
                [newQuantity, currCartKey, productId]
            );

            const row = updateResult.rows[0];
            currCartItem = {
                productId: row.product_id,
                quantity: row.quantity
            };
        }

        // Termine la transaction en l'appliquant (commit)
        await client.query("COMMIT");

        return currCartItem;
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
exports.updateCurrentCartEntry = updateCurrentCartEntry;


const deleteCurrentCartEntry = async (userId, productId) => {
    const user = await userAccountQueries.getUserAccount(userId);

    if (!user) {
        throw new HttpError(404, `L'usager ${userId} est introuvable`);
    }

    let currCartKey = await getCurrentCartKey(userId);
    if (!currCartKey) {
        // Rien à faire si le panier n'existe pas
        return;
    }

    await pool.query(
        `DELETE FROM cart_product 
             WHERE cart_key = $1 AND product_id = $2`,
        [currCartKey, productId]
    );
};
exports.deleteCurrentCartEntry = deleteCurrentCartEntry;


const deleteCurrentCart = async (userId) => {
    const user = await userAccountQueries.getUserAccount(userId);

    if (!user) {
        throw new HttpError(404, `L'usager ${userId} est introuvable`);
    }

    let currCartKey = await getCurrentCartKey(userId);
    if (!currCartKey) {
        // Rien à faire si le panier n'existe pas
        return;
    }

    await pool.query(
        "DELETE FROM cart WHERE cart_key = $1",
        [currCartKey]
    );
};
exports.deleteCurrentCart = deleteCurrentCart;
