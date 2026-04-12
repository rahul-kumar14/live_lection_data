require('dotenv').config();

async function run() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
        throw new Error('SUPABASE_URL or SUPABASE_API_KEY is missing in .env');
    }

    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/election_results?select=id,state_code&limit=5`, {
        headers: {
            apikey: process.env.SUPABASE_API_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_API_KEY}`
        }
    });

    if (!response.ok) {
        throw new Error(`Supabase REST check failed (${response.status}): ${await response.text()}`);
    }

    const rows = await response.json();
    console.log(JSON.stringify({
        sample_rows: rows.length,
        sample_state_codes: [...new Set(rows.map(row => row.state_code))]
    }, null, 2));
}

run().catch(err => {
    console.error('Supabase check failed:', err.message);
    process.exit(1);
});
