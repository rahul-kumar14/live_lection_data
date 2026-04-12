/* ===================================
   ASSAM ELECTION DASHBOARD — Main App
   Constituency-wise Map Version
   =================================== */

// State
let electionData = [];
let statsData = null;
let geoData = null;
let mapZoom = 1;
let isRefreshing = false;
let dashboardInitialized = false;

const MAP_BASE_WIDTH = 980;
const MAP_BASE_HEIGHT = 620;
const AUTO_REFRESH_MS = 20000;

// Constituency Name → Election Result mapping
const constituencyMap = {};
const constituencyNumberMap = {};
const CONSTITUENCY_ALIASES = {
    'GUWAHATI EAST': ['GAUHATI EAST'],
    'GAUHATI EAST': ['GUWAHATI EAST'],
    'NAGAON': ['NOWGONG'],
    'NOWGONG': ['NAGAON']
};
const currentState = getCurrentStateConfig();

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
    if (!currentState || !currentState.available) {
        window.location.href = '/';
        return;
    }

    initializePageMeta();
    showLoading();
    initializeControls();
    try {
        await loadDashboard();
        startAutoRefresh();
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
});

function getCurrentStateConfig() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const slug = segments[0] === 'state' ? segments[1] : 'assam';
    return window.STATE_CONFIG?.[slug] || null;
}

function initializePageMeta() {
    document.title = `${currentState.electionLabel} | Dashboard`;
    document.getElementById('page-title').textContent = currentState.electionLabel;
    document.getElementById('page-subtitle').textContent = `General Election to Assembly Constituencies — ${currentState.stateName}`;
    document.getElementById('map-panel-title').textContent = `${currentState.shortTitle} Constituency Map`;
    document.getElementById('results-title').textContent = `${currentState.shortTitle} Constituency Wise Results`;
    document.getElementById('footer-title').textContent = `${currentState.electionLabel} Dashboard`;
}

// ─── API Calls ───
async function loadDashboard(options = {}) {
    const {
        keepSelection = true,
        showRefreshing = false
    } = options;

    if (isRefreshing) return;
    isRefreshing = true;
    setRefreshState(showRefreshing, 'Refreshing...');

    const previousSelection = keepSelection
        ? document.getElementById('constituency-select')?.value || ''
        : '';

    try {
        await Promise.all([
            fetchResults(),
            fetchStats(),
            fetchGeoJSON()
        ]);

        buildConstituencyMap();
        renderPartySummary();
        renderPartyTable();
        renderMap();
        renderCharts();
        renderResultCards();
        populateDropdown(previousSelection);
        updateTimestamp();
    } finally {
        isRefreshing = false;
        setRefreshState(false, `Auto refresh: every ${AUTO_REFRESH_MS / 1000}s`);
    }
}

function startAutoRefresh() {
    window.setInterval(() => {
        loadDashboard({ keepSelection: true }).catch(err => {
            console.error('Auto refresh failed:', err);
        });
    }, AUTO_REFRESH_MS);
}

function initializeControls() {
    if (dashboardInitialized) return;

    document.getElementById('refresh-data-btn')?.addEventListener('click', () => {
        loadDashboard({ keepSelection: true, showRefreshing: true }).catch(err => {
            console.error('Manual refresh failed:', err);
        });
    });

    document.getElementById('map-zoom-in')?.addEventListener('click', () => setMapZoom(mapZoom + 0.2));
    document.getElementById('map-zoom-out')?.addEventListener('click', () => setMapZoom(mapZoom - 0.2));
    document.getElementById('map-zoom-reset')?.addEventListener('click', () => setMapZoom(1, true));

    dashboardInitialized = true;
}

async function fetchResults() {
    const res = await fetch(`/api/results?stateCode=${currentState.stateCode}`);
    electionData = await res.json();
}

async function fetchStats() {
    const res = await fetch(`/api/stats?stateCode=${currentState.stateCode}`);
    statsData = await res.json();
}

async function fetchGeoJSON() {
    const res = await fetch(currentState.geojsonPath);
    const rawGeoData = await res.json();
    geoData = mergeConstituencyFeatures(rawGeoData);
}

// Build constituency name → result lookup
function buildConstituencyMap() {
    Object.keys(constituencyMap).forEach(key => delete constituencyMap[key]);
    Object.keys(constituencyNumberMap).forEach(key => delete constituencyNumberMap[key]);

    electionData.forEach(r => {
        constituencyNumberMap[String(r.constituency_no)] = r;
        getConstituencyKeys(r.constituency_name).forEach(key => {
            constituencyMap[key] = r;
        });
    });

    logMapDiagnostics();
}

// Match GeoJSON feature to election result
function matchFeature(feature) {
    const acNo = String(feature?.properties?.AC_NO || '').trim();
    if (acNo && constituencyNumberMap[acNo]) {
        return constituencyNumberMap[acNo];
    }

    const acName = feature?.properties?.AC_NAME || '';
    const matchKey = getConstituencyKeys(acName).find(key => constituencyMap[key]);
    return matchKey ? constituencyMap[matchKey] : null;
}

function normalizeConstituencyKey(name) {
    return String(name || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function getConstituencyKeys(name) {
    const primaryKey = normalizeConstituencyKey(name);
    const aliasKeys = (CONSTITUENCY_ALIASES[primaryKey] || []).map(normalizeConstituencyKey);
    return Array.from(new Set([primaryKey, ...aliasKeys].filter(Boolean)));
}

function walkCoordinates(coords, callback) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        callback(coords);
        return;
    }
    coords.forEach(part => walkCoordinates(part, callback));
}

function getMapProjection(features, width, height, padding = 20) {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    features.forEach(feature => {
        walkCoordinates(feature?.geometry?.coordinates, ([lon, lat]) => {
            minLon = Math.min(minLon, lon);
            minLat = Math.min(minLat, lat);
            maxLon = Math.max(maxLon, lon);
            maxLat = Math.max(maxLat, lat);
        });
    });

    const lonSpan = Math.max(maxLon - minLon, 1e-9);
    const latSpan = Math.max(maxLat - minLat, 1e-9);
    const scale = Math.min(
        (width - padding * 2) / lonSpan,
        (height - padding * 2) / latSpan
    );

    const offsetX = (width - lonSpan * scale) / 2;
    const offsetY = (height - latSpan * scale) / 2;

    return ([lon, lat]) => {
        const x = offsetX + (lon - minLon) * scale;
        const y = height - offsetY - (lat - minLat) * scale;
        return [x, y];
    };
}

function ringToPath(ring, projectPoint) {
    if (!Array.isArray(ring) || !ring.length) return '';

    return ring.map((point, index) => {
        const [x, y] = projectPoint(point);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ') + ' Z';
}

function geometryToSvgPath(geometry, projectPoint) {
    if (!geometry) return '';

    if (geometry.type === 'Polygon') {
        return geometry.coordinates.map(ring => ringToPath(ring, projectPoint)).join(' ');
    }

    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates
            .map(polygon => polygon.map(ring => ringToPath(ring, projectPoint)).join(' '))
            .join(' ');
    }

    return '';
}

function getFeatureLabelPosition(feature, projectPoint) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    walkCoordinates(feature?.geometry?.coordinates, point => {
        const [x, y] = projectPoint(point);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    });

    return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function mergeConstituencyFeatures(collection) {
    if (!collection || !Array.isArray(collection.features)) {
        return collection;
    }

    const grouped = new Map();

    collection.features.forEach(feature => {
        const acNo = feature?.properties?.AC_NO ?? '';
        const acName = feature?.properties?.AC_NAME ?? '';
        const groupKey = `${acNo}|${normalizeConstituencyKey(acName)}`;
        const geometrySize = JSON.stringify(feature?.geometry?.coordinates || []).length;

        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
                feature: {
                    ...feature,
                    properties: { ...feature.properties }
                },
                geometrySize
            });
            return;
        }

        const current = grouped.get(groupKey);
        if (geometrySize > current.geometrySize) {
            grouped.set(groupKey, {
                feature: {
                    ...feature,
                    properties: { ...feature.properties }
                },
                geometrySize
            });
        }
    });

    const features = Array.from(grouped.values())
        .map(entry => entry.feature)
        .sort((a, b) => (a.properties.AC_NO || 0) - (b.properties.AC_NO || 0));

    return {
        type: collection.type || 'FeatureCollection',
        features
    };
}

function logMapDiagnostics() {
    if (!geoData || !Array.isArray(geoData.features) || !electionData.length) return;

    const unmatchedResults = electionData
        .filter(result => !geoData.features.some(feature => matchFeature(feature) === result))
        .map(result => result.constituency_name);

    const matchedCount = electionData.length - unmatchedResults.length;
    console.info(`Map match status: ${matchedCount}/${electionData.length} constituencies resolved.`);

    if (unmatchedResults.length) {
        console.warn('Unmatched constituency names:', unmatchedResults);
    }
}

// ─── Party Summary Cards ───
function renderPartySummary() {
    const container = document.getElementById('party-cards');
    const seatsBar = document.getElementById('seats-bar');
    if (!statsData) return;

    container.innerHTML = '';
    seatsBar.innerHTML = '';

    const totalSeats = statsData.total.total_seats;

    statsData.parties.forEach((party, i) => {
        const color = getPartyColor(party.party_code);

        const card = document.createElement('div');
        card.className = 'party-card animate-in';
        card.style.setProperty('--party-color', color);
        card.style.setProperty('--party-glow', color + '40');
        card.style.setProperty('--party-tint', color + '22');
        card.style.setProperty('--party-border', color + '55');
        card.style.animationDelay = `${i * 0.1}s`;
        card.innerHTML = `
            <div class="party-dot" style="background: ${color}"></div>
            <div class="party-info">
                <span class="party-code" style="color: ${color}">${party.party_code}</span>
                <span class="party-seats">${party.seats_won}</span>
            </div>
        `;
        container.appendChild(card);

        const segment = document.createElement('div');
        segment.className = 'bar-segment';
        segment.style.background = color;
        segment.style.width = `${(party.seats_won / totalSeats) * 100}%`;
        seatsBar.appendChild(segment);
    });

    document.getElementById('total-seats-label').textContent = `Total: ${totalSeats} Seats`;
    const totalSeatsMax = document.getElementById('total-seats-max');
    if (totalSeatsMax) {
        totalSeatsMax.textContent = totalSeats;
    }
}

// ─── Party Table ───
function renderPartyTable() {
    const tbody = document.getElementById('party-table-body');
    if (!statsData) return;

    tbody.innerHTML = '';

    let totalSeats = 0;

    statsData.parties.forEach(party => {
        const color = getPartyColor(party.party_code);
        totalSeats += party.seats_won;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="party-name-cell">
                    <span class="dot" style="background: ${color}"></span>
                    <div>
                        <div class="name">${party.party_name}</div>
                        <div class="code">${party.party_code}</div>
                    </div>
                </div>
            </td>
            <td style="color: ${color}; font-size: 18px;">${party.seats_won}</td>
            <td>${party.vote_share_pct}%</td>
            <td>${party.seats_won}</td>
        `;
        tbody.appendChild(tr);
    });

    const totalTr = document.createElement('tr');
    totalTr.innerHTML = `
        <td><div class="party-name-cell"><strong>Total</strong></div></td>
        <td><strong>${totalSeats}</strong></td>
        <td>—</td>
        <td><strong>${totalSeats}</strong></td>
    `;
    tbody.appendChild(totalTr);
}

// ─── Interactive Map (Constituency-wise) ───
function renderMap() {
    const container = document.getElementById('map-svg-container');
    const tooltip = document.getElementById('map-tooltip');
    if (!geoData || !Array.isArray(geoData.features)) return;

    container.innerHTML = '';

    const width = MAP_BASE_WIDTH;
    const height = MAP_BASE_HEIGHT;
    const features = geoData.features;

    const svg = d3.select('#map-svg-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const projectPoint = getMapProjection(features, width, height, 20);

    // Draw ALL constituencies
    svg.selectAll('.constituency-path')
        .data(features)
        .enter()
        .append('path')
        .attr('class', 'district-path')
        .attr('d', d => geometryToSvgPath(d.geometry, projectPoint))
        .attr('fill', d => {
            const result = matchFeature(d);
            if (result) {
                return getPartyColor(result.party_code);
            }
            return '#2a2a3a'; // no data
        })
        .attr('data-ac-name', d => d.properties.AC_NAME)
        .attr('data-ac-key', d => normalizeConstituencyKey(d.properties.AC_NAME))
        .attr('data-ac-no', d => d.properties.AC_NO)
        .on('mouseover', function(event, d) {
            const result = matchFeature(d);
            const acName = d.properties.AC_NAME || 'Unknown';

            d3.select(this).classed('highlighted', true);

            if (result) {
                const color = getPartyColor(result.party_code);
                tooltip.innerHTML = `
                    <div class="tooltip-header">
                        <span class="tooltip-dot" style="background: ${color}"></span>
                        <span class="tooltip-district">${acName}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">AC No.</span>
                        <span class="value">#${d.properties.AC_NO}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">District</span>
                        <span class="value">${d.properties.DIST_NAME}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">Winner</span>
                        <span class="value">${result.candidate_name}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">Party</span>
                        <span class="value" style="color: ${color}">${result.party_code}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">Votes</span>
                        <span class="value">${Number(result.votes_received).toLocaleString('en-IN')}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">Vote %</span>
                        <span class="value">${result.vote_percentage}%</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">Margin</span>
                        <span class="value">${Number(result.margin).toLocaleString('en-IN')}</span>
                    </div>
                    <span class="tooltip-status won">✓ ${result.status}</span>
                `;
            } else {
                tooltip.innerHTML = `
                    <div class="tooltip-header">
                        <span class="tooltip-dot" style="background: #555"></span>
                        <span class="tooltip-district">${acName}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">AC No.</span>
                        <span class="value">#${d.properties.AC_NO}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">District</span>
                        <span class="value">${d.properties.DIST_NAME || '-'}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="label">Status</span>
                        <span class="value" style="color: #888">No Data</span>
                    </div>
                `;
            }
            tooltip.classList.add('visible');
        })
        .on('mousemove', function(event) {
            const mapContainer = document.getElementById('map-scroll-shell');
            const rect = mapContainer.getBoundingClientRect();
            const tooltipWidth = tooltip.offsetWidth || 220;
            const tooltipHeight = tooltip.offsetHeight || 160;

            let x = event.clientX - rect.left + 15;
            let y = event.clientY - rect.top - 10;

            if (x + tooltipWidth > rect.width - 12) {
                x = Math.max(12, event.clientX - rect.left - tooltipWidth - 18);
            }

            if (y + tooltipHeight > rect.height - 12) {
                y = Math.max(12, rect.height - tooltipHeight - 12);
            }

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        })
        .on('mouseout', function() {
            d3.select(this).classed('highlighted', false);
            tooltip.classList.remove('visible');
        })
        .on('click', function(event, d) {
            const result = matchFeature(d);
            if (result) {
                const select = document.getElementById('constituency-select');
                const key = normalizeConstituencyKey(result.constituency_name);
                if (select) {
                    select.value = key;
                }
                highlightCard(result.constituency_name);
            }
        });

    applyMapZoom(false);
    renderMapLegend();
}

function renderMapLegend() {
    const legend = document.getElementById('map-legend');
    legend.innerHTML = '';

    const partyItems = (statsData?.parties || []).map(party => ({
        label: party.party_code,
        color: getPartyColor(party.party_code)
    }));

    const items = [
        ...partyItems,
        { label: 'No Data', color: '#2a2a3a' }
    ];

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <span class="legend-dot" style="background: ${item.color}"></span>
            <span>${item.label}</span>
        `;
        legend.appendChild(div);
    });
}

function setMapZoom(nextZoom, forceCenter = false) {
    mapZoom = Math.min(3, Math.max(1, Number(nextZoom.toFixed(2))));
    applyMapZoom(forceCenter);
}

function applyMapZoom(forceCenter = false) {
    const mapContainer = document.getElementById('map-svg-container');
    const mapStage = document.getElementById('map-stage');
    const mapShell = document.getElementById('map-scroll-shell');
    const zoomStatus = document.getElementById('map-zoom-status');
    if (!mapContainer || !mapStage || !mapShell) return;

    const previousCenterX = mapShell.scrollLeft + mapShell.clientWidth / 2;
    const previousCenterY = mapShell.scrollTop + mapShell.clientHeight / 2;
    const previousWidth = mapContainer.clientWidth || MAP_BASE_WIDTH;
    const previousHeight = mapContainer.clientHeight || MAP_BASE_HEIGHT;

    const scaledWidth = Math.round(MAP_BASE_WIDTH * mapZoom);
    const scaledHeight = Math.round(MAP_BASE_HEIGHT * mapZoom);

    mapContainer.style.width = `${scaledWidth}px`;
    mapContainer.style.height = `${scaledHeight}px`;
    mapStage.style.width = `${Math.max(scaledWidth + 24, mapShell.clientWidth)}px`;
    mapStage.style.height = `${Math.max(scaledHeight + 24, mapShell.clientHeight)}px`;

    const svg = mapContainer.querySelector('svg');
    if (svg) {
        svg.setAttribute('width', String(scaledWidth));
        svg.setAttribute('height', String(scaledHeight));
    }

    if (zoomStatus) {
        zoomStatus.textContent = `Zoom ${Math.round(mapZoom * 100)}%`;
    }

    window.requestAnimationFrame(() => {
        if (forceCenter || previousWidth === 0 || previousHeight === 0) {
            centerMapViewport();
            return;
        }

        const scaleX = scaledWidth / previousWidth;
        const scaleY = scaledHeight / previousHeight;
        mapShell.scrollLeft = Math.max(0, previousCenterX * scaleX - mapShell.clientWidth / 2);
        mapShell.scrollTop = Math.max(0, previousCenterY * scaleY - mapShell.clientHeight / 2);
    });
}

function centerMapViewport() {
    const mapShell = document.getElementById('map-scroll-shell');
    const mapStage = document.getElementById('map-stage');
    if (!mapShell || !mapStage) return;

    mapShell.scrollLeft = Math.max(0, (mapStage.scrollWidth - mapShell.clientWidth) / 2);
    mapShell.scrollTop = Math.max(0, (mapStage.scrollHeight - mapShell.clientHeight) / 2);
}

// ─── Charts ───
function renderCharts() {
    if (!statsData) return;

    const seatsData = statsData.parties.map(p => ({
        label: p.party_code,
        value: p.seats_won,
        color: getPartyColor(p.party_code)
    }));
    renderDonutChart('seats-donut', seatsData, statsData.total.total_seats, 'seats');

    const voteData = statsData.parties.map(p => ({
        label: p.party_code,
        value: parseFloat(p.vote_share_pct),
        color: getPartyColor(p.party_code)
    }));
    renderDonutChart('votes-donut', voteData, '100%', 'percentage');
}

// ─── Result Cards ───
function renderResultCards() {
    const grid = document.getElementById('results-grid');
    grid.innerHTML = '';

    electionData.forEach((r, i) => {
        const color = getPartyColor(r.party_code);
        const initials = r.candidate_name.split(' ').map(w => w[0]).join('').substring(0, 2);

        const card = document.createElement('div');
        card.className = 'result-card animate-in';
        card.id = `card-${r.constituency_name.replace(/\s+/g, '-').toLowerCase()}`;
        card.style.animationDelay = `${i * 0.08}s`;

        card.innerHTML = `
            <style>
                #${card.id}::before { background: ${color}; }
            </style>
            <div class="card-header">
                <div>
                    <div class="card-constituency">#${r.constituency_no} — ${r.district_name}</div>
                    <div class="card-constituency-name">${r.constituency_name}</div>
                </div>
                <span class="card-status">✓ ${r.status}</span>
            </div>
            <div class="card-candidate">
                <div class="candidate-icon" style="background: ${color}">${initials}</div>
                <div class="candidate-info">
                    <div class="candidate-name">${r.candidate_name}</div>
                    <div class="candidate-party" style="color: ${color}">${r.party_name} (${r.party_code})</div>
                </div>
            </div>
            <div class="card-stats">
                <div class="card-stat">
                    <div class="stat-value" style="color: ${color}">${Number(r.votes_received).toLocaleString('en-IN')}</div>
                    <div class="stat-label">Votes</div>
                </div>
                <div class="card-stat">
                    <div class="stat-value">${r.vote_percentage}%</div>
                    <div class="stat-label">Vote %</div>
                </div>
                <div class="card-stat">
                    <div class="stat-value">${Number(r.margin).toLocaleString('en-IN')}</div>
                    <div class="stat-label">Margin</div>
                </div>
            </div>
            <div class="card-vote-bar">
                <div class="bar-fill" style="background: ${color}; width: 0%;" data-width="${r.vote_percentage}%"></div>
            </div>
        `;
        grid.appendChild(card);

        setTimeout(() => {
            const barFill = card.querySelector('.bar-fill');
            if (barFill) barFill.style.width = barFill.dataset.width;
        }, 300 + i * 100);
    });
}

function highlightCard(constituencyName) {
    document.querySelectorAll('.result-card.highlighted').forEach(c => c.classList.remove('highlighted'));

    const cardId = `card-${constituencyName.replace(/\s+/g, '-').toLowerCase()}`;
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ─── Dropdown ───
function populateDropdown(selectedKey = '') {
    const select = document.getElementById('constituency-select');
    select.innerHTML = '<option value="">Select Constituency...</option>';

    electionData.forEach(r => {
        const option = document.createElement('option');
        option.value = normalizeConstituencyKey(r.constituency_name);
        option.textContent = r.constituency_name;
        select.appendChild(option);
    });

    if (selectedKey) {
        select.value = selectedKey;
    }

    select.onchange = function() {
        const key = this.value;
        document.querySelectorAll('.district-path').forEach(p => p.classList.remove('highlighted'));
        if (!key) return;

        // Highlight constituency on map
        document.querySelectorAll('.district-path').forEach(p => {
            const acName = p.getAttribute('data-ac-name') || '';
            if (getConstituencyKeys(acName).includes(key)) {
                p.classList.add('highlighted');
            }
        });

        const result = constituencyMap[key];
        if (result) {
            highlightCard(result.constituency_name);
        }
    };

    if (selectedKey) {
        select.onchange();
    }
}

// ─── Utilities ───
function setRefreshState(isLoading, statusText) {
    const refreshButton = document.getElementById('refresh-data-btn');
    const refreshStatus = document.getElementById('refresh-status');

    if (refreshButton) {
        refreshButton.disabled = isLoading;
        refreshButton.classList.toggle('loading', isLoading);
        refreshButton.textContent = isLoading ? 'Refreshing...' : 'Refresh Data';
    }

    if (refreshStatus) {
        refreshStatus.textContent = statusText;
    }
}

function updateTimestamp() {
    const now = new Date();
    const options = {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    };
    document.getElementById('last-updated').textContent =
        `Last Updated: ${now.toLocaleDateString('en-IN', options)}`;
}

function showLoading() {
    const mapContainer = document.getElementById('map-svg-container');
    if (mapContainer) {
        mapContainer.style.width = `${MAP_BASE_WIDTH}px`;
        mapContainer.style.height = `${MAP_BASE_HEIGHT}px`;
        mapContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <span class="loading-text">Loading ${currentState.shortTitle} constituency map...</span>
            </div>
        `;
    }
}
