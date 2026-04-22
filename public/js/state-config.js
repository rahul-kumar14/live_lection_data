window.STATE_CONFIG = {
    assam: {
        slug: 'assam',
        stateCode: 18,
        stateName: 'Assam',
        shortTitle: 'Assam',
        electionLabel: 'Assam Vidhan Sabha Election Results',
        geojsonPath: '/data/assam-constituencies.geojson',
        available: true,
        defaultMapZoom: 1,
        maxMapZoom: 3
    },
    'west-bengal': {
        slug: 'west-bengal',
        stateCode: 19,
        stateName: 'West Bengal',
        shortTitle: 'West Bengal',
        electionLabel: 'West Bengal Vidhan Sabha Election Results',
        geojsonPath: '/data/states/west-bengal/constituencies.geojson',
        available: true,
        defaultMapZoom: 1,
        maxMapZoom: 3
    },
    'tamil-nadu': {
        slug: 'tamil-nadu',
        stateCode: 33,
        stateName: 'Tamil Nadu',
        shortTitle: 'Tamil Nadu',
        electionLabel: 'Tamil Nadu Vidhan Sabha Election Results',
        geojsonPath: '/data/states/tamil-nadu/constituencies.geojson',
        available: true,
        defaultMapZoom: 1,
        maxMapZoom: 3
    },
    kerala: {
        slug: 'kerala',
        stateCode: 32,
        stateName: 'Kerala',
        shortTitle: 'Kerala',
        electionLabel: 'Kerala Vidhan Sabha Election Results',
        geojsonPath: '/data/states/kerala/constituencies.geojson',
        available: true,
        defaultMapZoom: 1,
        maxMapZoom: 3
    },
    puducherry: {
        slug: 'puducherry',
        stateCode: 34,
        stateName: 'Puducherry',
        shortTitle: 'Puducherry',
        electionLabel: 'Puducherry Vidhan Sabha Election Results',
        geojsonPath: '/data/states/puducherry/constituencies.geojson',
        available: true,
        defaultMapZoom: 8,
        maxMapZoom: 12
    }
};

window.STATE_LIST = Object.values(window.STATE_CONFIG);
