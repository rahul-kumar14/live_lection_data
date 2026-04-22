/* ===================================
   D3.js Donut Chart Functions
   =================================== */

const PARTY_COLORS = {
    'BJP': '#FF6B00',
    'INC': '#00BFFF',
    'TMC': '#2ED14B',
    'AIUDF': '#2ECC71',
    'AGP': '#FFD700',
    'DMK': '#E53935',
    'AIADMK': '#16A34A',
    'PMK': '#8B5CF6',
    'VCK': '#F59E0B',
    'IUML': '#22C55E',
    'KC(M)': '#7C3AED',
    'AINRC': '#06B6D4',
    'UPPL': '#9E9E9E',
    'BPF': '#9E9E9E',
    'CPI(M)': '#EF4444',
    'OTH': '#9E9E9E',
    'Other': '#888888'
};

function getPartyColor(code) {
    return PARTY_COLORS[code] || PARTY_COLORS['Other'];
}

/**
 * Render a donut chart
 * @param {string} containerId - ID of the container div
 * @param {Array} data - [{label, value, color}]
 * @param {string} centerLabel - Text for center of donut
 * @param {string} valueType - 'seats' or 'percentage'
 */
function renderDonutChart(containerId, data, centerLabel, valueType = 'seats') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const width = 320;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 20;
    const innerRadius = radius * 0.55;

    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('viewBox', `0 0 ${width + 200} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('max-width', '100%');

    const chartGroup = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null)
        .padAngle(0.03);

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius);

    const arcHover = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius + 8);

    const arcs = chartGroup.selectAll('.arc')
        .data(pie(data))
        .enter()
        .append('g')
        .attr('class', 'arc');

    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', arcHover)
                .attr('opacity', 1);
        })
        .on('mouseout', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', arc)
                .attr('opacity', 0.9);
        })
        .transition()
        .duration(800)
        .attrTween('d', function(d) {
            const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function(t) {
                return arc(interpolate(t));
            };
        });

    // Center text
    chartGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.3em')
        .attr('class', 'donut-label-text')
        .style('font-size', '24px')
        .text(centerLabel);

    chartGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .attr('class', 'donut-value-text')
        .style('font-size', '12px')
        .text(valueType === 'seats' ? 'Total Seats' : 'Total Votes');

    // Legend (right side)
    const legendGroup = svg.append('g')
        .attr('transform', `translate(${width / 2 + radius + 30}, ${height / 2 - (data.length * 28) / 2})`);

    data.forEach((d, i) => {
        const item = legendGroup.append('g')
            .attr('transform', `translate(0, ${i * 28})`);

        item.append('rect')
            .attr('width', 14)
            .attr('height', 14)
            .attr('rx', 3)
            .attr('fill', d.color);

        const displayValue = valueType === 'percentage'
            ? `${d.value.toFixed(2)}%`
            : d.value;

        item.append('text')
            .attr('x', 22)
            .attr('y', 11)
            .attr('fill', '#94a3b8')
            .style('font-size', '12px')
            .style('font-family', 'Inter, sans-serif')
            .text(`${d.label} (${displayValue})`);
    });
}
