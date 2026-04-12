const fs = require('fs');
const path = require('path');
const sql = require('mssql');
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

const OUTPUT_FILE = path.join(__dirname, '..', 'supabase', 'election_results.csv');

function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);
    if (/[",\r\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

async function run() {
    const pool = await sql.connect(sourceConfig);
    const result = await pool.request().query(`
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

    const rows = result.recordset;
    const headers = [
        'id',
        'constituency_no',
        'constituency_name',
        'district_name',
        'candidate_name',
        'party_code',
        'party_name',
        'votes_received',
        'total_votes',
        'vote_percentage',
        'margin',
        'status',
        'state_code',
        'state_name'
    ];

    const csvLines = [
        headers.join(','),
        ...rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(','))
    ];

    fs.writeFileSync(OUTPUT_FILE, csvLines.join('\n'));
    console.log(`Exported ${rows.length} rows to ${OUTPUT_FILE}`);
    await pool.close();
}

run().catch(err => {
    console.error('CSV export failed:', err.message);
    process.exit(1);
});
