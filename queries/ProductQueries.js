const pool = require('./DBPool');

const getImagePathForProductId = productId => `/products/${productId}/image`;
exports.getImagePathForProductId = getImagePathForProductId;

const addImagePathToProduct = product => {
    return {
        id: product.id,
        name: product.name,
        price: product.price,
        desc: product.desc,
        image: getImagePathForProductId(product.id),
        longDesc: product.longDesc
    };
};


const getAllProducts = async () => {
    const result = await pool.query(
        `SELECT product_id, name, price, description, long_desc 
        FROM product 
        ORDER BY product_id`
    );

    // Transforme le résultat de la requête pour avoir des objets de produits
    // tel que spécifié pour le REST API :
    return result.rows.map(row => {
        const product = {
            id: row.product_id,
            name: row.name,
            price: row.price,
            desc: row.description,
            longDesc: row.long_desc
        };

        const productWithImagePath = addImagePathToProduct(product);
        return productWithImagePath;
    });
};
exports.getAllProducts = getAllProducts;


const getProductById = async (productId) => {
    const result = await pool.query(
        `SELECT product_id, name, price, description, long_desc 
        FROM product
        WHERE product_id = $1`,
        [productId]
    );

    const row = result.rows[0];
    if (row) {
        const product = {
            id: row.product_id,
            name: row.name,
            price: row.price,
            desc: row.description,
            longDesc: row.long_desc
        };

        return addImagePathToProduct(product);
    }
    return undefined;
};
exports.getProductById = getProductById;


/**
 * Fonction permettant d'obtenir le contenu binaire de la colonne image_content et son type
 * (colonne image_content_type). Utilisé par un endpoint qui offre le téléchargement d'une image
 * de produit stockée dans la table product de la BD.
 * 
 * @param {string} productId 
 * @returns Promesse pour un objet avec deux propriétés :
 *          imageContent : un Buffer avec le contenu binaire de l'image
 *          imageContentType : une chaîne de caractères avec le Content-Type de l'image (p.ex. "image/jpeg")
 */
const getProductImageContent = async (productId) => {
    const result = await pool.query(
        `SELECT image_content, image_content_type FROM product WHERE product_id = $1`,
        [productId]
    );

    const row = result.rows[0];
    if (row) {
        return {
            imageContent: row.image_content,
            imageContentType: row.image_content_type
        };
    }

    return undefined;
};
exports.getProductImageContent = getProductImageContent;


const insertProduct = async (product) => {
    const result = await pool.query(
        `INSERT INTO product (product_id, name, price, description, long_desc) 
        VALUES ($1, $2, $3, $4, $5)`,
        [product.id, product.name, product.price, product.desc, product.longDesc]
    );

    return getProductById(product.id);
};
exports.insertProduct = insertProduct;


const updateProduct = async (product) => {
    const result = await pool.query(
        `UPDATE product SET name = $2, price = $3, description = $4, long_desc = $5 
        WHERE product_id = $1`,
        [product.id, product.name, product.price, product.desc, product.longDesc]
    );

    if (result.rowCount === 0) {
        // Aucune rangée modifiée, veut dire que l'id n'existe pas
        return undefined;
    }

    return getProductById(product.id);
};
exports.updateProduct = updateProduct;


const deleteProduct = async (productId) => {
    const result = await pool.query(
        `DELETE FROM product WHERE product_id = $1`,
        [productId]
    );

    if (result.rowCount === 0) {
        // Aucune rangée modifiée, veut dire que l'id n'existe pas
        return undefined;
    }

    return {};
};
exports.deleteProduct = deleteProduct;


const updateProductImage = async (productId, imageBuffer, imageContentType) => {
    const result = await pool.query(
        `UPDATE product SET image_content = $2, image_content_type = $3
        WHERE product_id = $1`,
        [productId, imageBuffer, imageContentType]
    );

    if (result.rowCount === 0) {
        throw new Error("Erreur lors de la mise-à-jour de l'image");
    }

    return getProductImageContent(productId);
};
exports.updateProductImage = updateProductImage;

  