CREATE TABLE IF NOT EXISTS election_results (
    id BIGSERIAL PRIMARY KEY,
    constituency_no INTEGER NOT NULL,
    constituency_name VARCHAR(200),
    district_name VARCHAR(200),
    candidate_name VARCHAR(200),
    party_code VARCHAR(200),
    party_name VARCHAR(200),
    votes_received INTEGER NOT NULL,
    total_votes INTEGER NOT NULL,
    vote_percentage NUMERIC(5, 2) NOT NULL,
    margin INTEGER NOT NULL,
    status VARCHAR(20),
    state_code INTEGER,
    state_name VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_election_results_state_code
    ON election_results (state_code);

CREATE INDEX IF NOT EXISTS idx_election_results_state_constituency
    ON election_results (state_code, constituency_no);

CREATE INDEX IF NOT EXISTS idx_election_results_party
    ON election_results (party_code);
