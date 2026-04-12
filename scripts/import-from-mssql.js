const sql = require('mssql');
const { Pool } = require('pg');
require('dotenv').config();

const sourceConfig = {
    server: process.env.SOURCE_SQL_SERVER,
    database: process.env.SOURCE_SQL_DATABASE,
    user: process.env.SOURCE_SQL_USER,
    password: process.env.SOURCE_SQL_PASSWORD,
    options: {
        trustServerCertificate: true,
        encrypt: false
    }
};

const targetPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false'
        ? false
        : { rejectUnauthorized: false }
});

function requireEnv(name) {
    if (!process.env[name]) {
        throw new Error(`${name} is missing in .env`);
    }
}

async function run() {
    requireEnv('DATABASE_URL');
    requireEnv('SOURCE_SQL_SERVER');
    requireEnv('SOURCE_SQL_DATABASE');
    requireEnv('SOURCE_SQL_USER');
    requireEnv('SOURCE_SQL_PASSWORD');

    const sourcePool = await sql.connect(sourceConfig);
    const sourceRows = await sourcePool.request().query(`
        SELECT
            id,
            constituency_no,
            constituency_name,
            district_name,
            candidate_name,
            party_code,
            party_name,
            votes_received,
            total_votes,
            vote_percentage,
            margin,
            status,
            state_code,
            state_name
        FROM [dbo].[election_results]
        ORDER BY id ASC
    `);

    const client = await targetPool.connect();

    try {
        await client.query('BEGIN');

        for (const row of sourceRows.recordset) {
            await client.query(`
                INSERT INTO election_results (
                    id,
                    constituency_no,
                    constituency_name,
                    district_name,
                    candidate_name,
                    party_code,
                    party_name,
                    votes_received,
                    total_votes,
                    vote_percentage,
                    margin,
                    status,
                    state_code,
                    state_name
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13, $14
                )
                ON CONFLICT (id) DO UPDATE SET
                    constituency_no = EXCLUDED.constituency_no,
                    constituency_name = EXCLUDED.constituency_name,
                    district_name = EXCLUDED.district_name,
                    candidate_name = EXCLUDED.candidate_name,
                    party_code = EXCLUDED.party_code,
                    party_name = EXCLUDED.party_name,
                    votes_received = EXCLUDED.votes_received,
                    total_votes = EXCLUDED.total_votes,
                    vote_percentage = EXCLUDED.vote_percentage,
                    margin = EXCLUDED.margin,
                    status = EXCLUDED.status,
                    state_code = EXCLUDED.state_code,
                    state_name = EXCLUDED.state_name
            `, [
                row.id,
                row.constituency_no,
                row.constituency_name,
                row.district_name,
                row.candidate_name,
                row.party_code,
                row.party_name,
                row.votes_received,
                row.total_votes,
                row.vote_percentage,
                row.margin,
                row.status,
                row.state_code,
                row.state_name
            ]);
        }

        await client.query(`
            SELECT setval(
                pg_get_serial_sequence('election_results', 'id'),
                COALESCE((SELECT MAX(id) FROM election_results), 1),
                true
            )
        `);

        await client.query('COMMIT');
        console.log(`Imported ${sourceRows.recordset.length} rows from MSSQL into Supabase.`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
        await sourcePool.close();
        await targetPool.end();
    }
}

run().catch(err => {
    console.error('Import failed:', err.message);
    process.exit(1);
});
