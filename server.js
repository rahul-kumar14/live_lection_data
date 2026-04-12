const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const STATE_CONFIG = {
    assam: { stateCode: 18, stateName: 'Assam' },
    'west-bengal': { stateCode: 19, stateName: 'West Bengal' },
    'tamil-nadu': { stateCode: 33, stateName: 'Tamil Nadu' },
    kerala: { stateCode: 32, stateName: 'Kerala' },
    puducherry: { stateCode: 34, stateName: 'Puducherry' }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function parseStateCode(value) {
    const stateCode = Number(value);
    return Number.isFinite(stateCode) ? stateCode : null;
}

function normalizeResultRow(row) {
    return {
        ...row,
        id: Number(row.id),
        constituency_no: Number(row.constituency_no),
        votes_received: Number(row.votes_received),
        total_votes: Number(row.total_votes),
        vote_percentage: Number(row.vote_percentage),
        margin: Number(row.margin),
        state_code: row.state_code === null ? null : Number(row.state_code)
    };
}

function normalizeStatsRow(row) {
    return {
        ...row,
        seats_won: Number(row.seats_won),
        total_votes: Number(row.total_votes),
        vote_share_pct: Number(row.vote_share_pct)
    };
}

function requireSupabaseConfig() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
        throw new Error('SUPABASE_URL or SUPABASE_API_KEY is missing. Add both to .env before starting the app.');
    }
}

function buildSupabaseUrl(tableName, queryString) {
    const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
    return `${baseUrl}/rest/v1/${tableName}?${queryString}`;
}

async function supabaseRequest(tableName, queryString) {
    requireSupabaseConfig();

    const response = await fetch(buildSupabaseUrl(tableName, queryString), {
        headers: {
            apikey: process.env.SUPABASE_API_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_API_KEY}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase request failed (${response.status}): ${errorText}`);
    }

    return response.json();
}

app.get('/api/health', async (req, res) => {
    try {
        const rows = await supabaseRequest('election_results', 'select=id&limit=1');
        res.json({ ok: true });
    } catch (err) {
        console.error('Health check failed:', err.message);
        res.status(500).json({ ok: false, error: 'Database unavailable' });
    }
});

app.get('/api/results', async (req, res) => {
    try {
        const stateCode = parseStateCode(req.query.stateCode);
        const searchParams = new URLSearchParams();
        searchParams.set('select', 'id,constituency_no,constituency_name,district_name,candidate_name,party_code,party_name,votes_received,total_votes,vote_percentage,margin,status,state_code,state_name');
        searchParams.set('order', 'constituency_no.asc');
        if (stateCode !== null) {
            searchParams.set('state_code', `eq.${stateCode}`);
        }
        const rows = await supabaseRequest('election_results', searchParams.toString());
        res.json(rows.map(normalizeResultRow));
    } catch (err) {
        console.error('Error fetching results:', err.message);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stateCode = parseStateCode(req.query.stateCode);
        const searchParams = new URLSearchParams();
        searchParams.set('select', 'party_code,party_name,votes_received,total_votes,status,state_name');
        if (stateCode !== null) {
            searchParams.set('state_code', `eq.${stateCode}`);
        }

        const rows = (await supabaseRequest('election_results', searchParams.toString()))
            .map(row => ({
                ...row,
                votes_received: Number(row.votes_received),
                total_votes: Number(row.total_votes)
            }));

        const winners = rows.filter(row => row.status === 'Won');
        const partyMap = new Map();

        winners.forEach(row => {
            const key = `${row.party_code}||${row.party_name}`;
            if (!partyMap.has(key)) {
                partyMap.set(key, {
                    party_code: row.party_code,
                    party_name: row.party_name,
                    seats_won: 0,
                    total_votes: 0,
                    total_poll: 0
                });
            }

            const entry = partyMap.get(key);
            entry.seats_won += 1;
            entry.total_votes += row.votes_received;
            entry.total_poll += row.total_votes;
        });

        const parties = Array.from(partyMap.values())
            .map(entry => normalizeStatsRow({
                ...entry,
                vote_share_pct: entry.total_poll === 0
                    ? 0
                    : ((entry.total_votes / entry.total_poll) * 100).toFixed(2)
            }))
            .sort((a, b) => b.seats_won - a.seats_won || a.party_code.localeCompare(b.party_code));

        const total = {
            total_seats: rows.length,
            total_votes_all: rows.reduce((sum, row) => sum + row.votes_received, 0),
            state_name: rows[0]?.state_name || null
        };

        res.json({
            parties,
            total
        });
    } catch (err) {
        console.error('Error fetching stats:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/state/:slug', (req, res) => {
    const state = STATE_CONFIG[req.params.slug];
    if (!state) {
        return res.status(404).send('Unknown state');
    }

    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

async function start() {
    requireSupabaseConfig();
    await supabaseRequest('election_results', 'select=id&limit=1');
    app.listen(PORT, () => {
        console.log(`Supabase REST dashboard running at http://localhost:${PORT}`);
    });
}

start().catch(err => {
    console.error('Startup failed:', err.message);
    process.exit(1);
});
