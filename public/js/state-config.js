window.STATE_CONFIG = {
    assam: {
        slug: 'assam',
        stateCode: 18,
        stateName: 'Assam',
        shortTitle: 'Assam',
        electionLabel: 'Assam Vidhan Sabha Election Results',
        geojsonPath: '/data/states/assam/constituencies.geojson',
        available: true
    },
    'west-bengal': {
        slug: 'west-bengal',
        stateCode: 19,
        stateName: 'West Bengal',
        shortTitle: 'West Bengal',
        electionLabel: 'West Bengal Vidhan Sabha Election Results',
        geojsonPath: '/data/states/west-bengal/constituencies.geojson',
        available: true
    },
    'tamil-nadu': {
        slug: 'tamil-nadu',
        stateCode: 33,
        stateName: 'Tamil Nadu',
        shortTitle: 'Tamil Nadu',
        electionLabel: 'Tamil Nadu Vidhan Sabha Election Results',
        geojsonPath: '/data/states/tamil-nadu/constituencies.geojson',
        available: true
    },
    kerala: {
        slug: 'kerala',
        stateCode: 32,
        stateName: 'Kerala',
        shortTitle: 'Kerala',
        electionLabel: 'Kerala Vidhan Sabha Election Results',
        geojsonPath: '/data/states/kerala/constituencies.geojson',
        available: false
    },
    puducherry: {
        slug: 'puducherry',
        stateCode: 34,
        stateName: 'Puducherry',
        shortTitle: 'Puducherry',
        electionLabel: 'Puducherry Vidhan Sabha Election Results',
        geojsonPath: '/data/states/puducherry/constituencies.geojson',
        available: false
    }
};

window.STATE_LIST = Object.values(window.STATE_CONFIG);
