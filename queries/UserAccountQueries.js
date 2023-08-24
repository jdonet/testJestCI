const pool = require('./DBPool');

const getLoginByUserAccountId = async (userAccountId) => {
    const result = await pool.query(
        `SELECT user_account_id, password_hash, password_salt, user_full_name, is_active, is_admin
         FROM user_account
         WHERE user_account_id = $1`,
        [userAccountId]
    );

    const row = result.rows[0];
    if (row) {
        return {
            userAccountId: row.user_account_id,
            passwordHash: row.password_hash,
            passwordSalt: row.password_salt,
            userFullName: row.user_full_name,
            isActive: row.is_active,
            isAdmin: row.is_admin
        };
    }
    return undefined;
};
exports.getLoginByUserAccountId = getLoginByUserAccountId;


const getUserAccount = async (userId, client) => {
    const result = await (client || pool).query(
        `SELECT user_account_id, user_full_name, is_active, is_admin 
        FROM user_account
        WHERE
            user_account_id = $1`,
        [userId]
    );

    const row = result.rows[0];

    if (row) {
        return {
            userId: row.user_account_id,
            name: row.user_full_name,
            isActive: row.is_active,
            isAdmin: row.is_admin
        };
    }

    return undefined;
};
exports.getUserAccount = getUserAccount;

const createUserAccount = async (userId, name, client) => {
    const result = await (client || pool).query(
        `INSERT INTO user_account (user_account_id, user_full_name) 
        VALUES ($1, $2)`,
        [userId, name]
    );

    return getUserAccount(userId);
};
exports.createUserAccount = createUserAccount;
