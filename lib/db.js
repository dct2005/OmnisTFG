// lib/db.js
const postgres = require('postgres');

let sql;

function getSql() {
    if (!sql) {
        if (!process.env.DATABASE_URL) {
            throw new Error('Error: Falta la variable DATABASE_URL');
        }
        sql = postgres(process.env.DATABASE_URL, {
            ssl: 'require'
        });
    }
    return sql;
}

module.exports = { getSql };