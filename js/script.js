// Structure follows the course labs: load data, set up controls, then update SVGs.
const margin = { top: 30, right: 175, bottom: 38, left: 150 };
const width = 980 - margin.left - margin.right;
const outcomes = ['Substantiated', 'Unsubstantiated', 'Exonerated'];
const colorScale = d3.scaleOrdinal(outcomes, ['#b96a32', '#4d6f92', '#246557']);
const formatNumber = d3.format(',');
const formatPercent = d3.format('.1f');
let allData = [];
let targetYear = 'all';
let targetCategory = 'all';
let revealed = false;

function init() {
    d3.csv('data/outcomes.csv', function (d) {
        return { year: +d.year, category: d.category, outcome: d.outcome, count: +d.count };
    }).then(data => {
        allData = data;
        setupSelector();
        updateVis();
        updateBlackHat();
        d3.select('#status').text('Data loaded. Change a filter to explore the evidence.');
    }).catch(error => {
        d3.select('#status').text('The data could not load. Please reload the page or serve this folder with a local web server.');
        console.error('Error loading data:', error);
    });
}

function setupSelector() {
    const years = [...new Set(allData.map(d => d.year))].sort(d3.ascending);
    const categories = [...new Set(allData.map(d => d.category))].sort(d3.ascending);
    d3.select('#year').selectAll('.year-option').data(years).join('option')
        .attr('class', 'year-option').attr('value', d => d).text(d => d === 2020 ? '2020 (partial year)' : d);
    d3.select('#category').selectAll('.category-option').data(categories).join('option')
        .attr('class', 'category-option').attr('value', d => d).text(d => d);
    d3.select('#year').on('change', function () { targetYear = this.value; updateVis(); });
    d3.select('#category').on('change', function () { targetCategory = this.value; updateVis(); });
    d3.select('#reset').on('click', function () {
        targetYear = 'all'; targetCategory = 'all';
        d3.select('#year').property('value', 'all');
        d3.select('#category').property('value', 'all');
        updateVis();
    });
    d3.select('#reveal').on('click', function () {
        revealed = !revealed;
        d3.select(this).attr('aria-pressed', revealed).text(revealed ? 'Restore the misleading framing ↶' : 'Reveal the framing ↗');
        d3.select('#reveal-note').property('hidden', !revealed);
        updateBlackHat();
    });
}

function summarize(data) {
    const total = d3.sum(data, d => d.count);
    return outcomes.map(outcome => {
        const count = d3.sum(data.filter(d => d.outcome === outcome), d => d.count);
        return { label: outcome, count, percent: total ? count / total * 100 : 0, color: colorScale(outcome) };
    });
}

// The same fixed scale is used in all three charts; no truncated axes.
function createVis(selector, data, description, baseline = null) {
    const height = data.length * 65;
    const svg = d3.select(selector).selectAll('svg').data([null]).join('svg')
        .attr('viewBox', `0 0 980 ${height + margin.top + margin.bottom}`)
        .attr('role', 'img').attr('aria-label', description);
    const chart = svg.selectAll('.plot').data([null]).join('g').attr('class', 'plot')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, width]);
    const yScale = d3.scaleBand().domain(data.map(d => d.label)).range([0, height]).padding(0.48);
    chart.selectAll('.axis').data([null]).join('g').attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickValues([0, 25, 50, 75, 100]).tickFormat(d => d + '%').tickSize(-height));
    chart.selectAll('.bar').data(data, d => d.label).join('rect').attr('class', 'bar')
        .attr('x', 0).attr('y', d => yScale(d.label)).attr('width', d => xScale(d.percent))
        .attr('height', yScale.bandwidth()).attr('fill', d => d.color)
        .attr('opacity', d => d.dimmed ? 0.35 : 1);
    chart.selectAll('.row-label').data(data, d => d.label).join('text').attr('class', 'row-label')
        .attr('x', -12).attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end').text(d => d.label);
    chart.selectAll('.value').data(data, d => d.label).join('text').attr('class', 'value')
        .attr('x', d => xScale(d.percent) + 9).attr('y', d => yScale(d.label) + yScale.bandwidth() / 2 + 4)
        .text(d => d.valueLabel || `${formatPercent(d.percent)}% · ${formatNumber(d.count)}`);
    chart.selectAll('.baseline').data(baseline === null ? [] : [baseline]).join('line')
        .attr('class', 'baseline').attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
        .attr('y1', -12).attr('y2', height).attr('stroke', '#182c2c').attr('stroke-dasharray', '4 4');
    chart.selectAll('.baseline-label').data(baseline === null ? [] : [baseline]).join('text')
        .attr('class', 'baseline-label').attr('x', d => xScale(d) + 7).attr('y', -16)
        .text(d => `Overall: ${formatPercent(d)}%`);
}

function updateVis() {
    const yearData = allData.filter(d => targetYear === 'all' || d.year === +targetYear);
    const currentData = yearData.filter(d => targetCategory === 'all' || d.category === targetCategory);
    const total = d3.sum(currentData, d => d.count);
    const yearLabel = targetYear === 'all' ? '1985–2020' : targetYear;
    const categoryLabel = targetCategory === 'all' ? 'All categories' : targetCategory;
    const summary = summarize(currentData);
    createVis('#outcomes', summary, summary.map(d => `${d.label}: ${formatPercent(d.percent)} percent, ${d.count} allegations`).join('. '));
    const selection = `${categoryLabel} · Received ${yearLabel} · n = ${formatNumber(total)} allegation records. ${total ? 'Each percentage uses this selection as its denominator.' : 'No records match this selection; percentages are undefined, and zero-length bars are shown.'}`;
    d3.select('#selection').text(selection);
    d3.select('#status').text(`${formatNumber(total)} allegations selected. ${targetYear === '2020' ? '2020 is incomplete; avoid comparisons of yearly volume.' : ''}`);
    const overall = summarize(yearData)[0].percent;
    const groups = d3.groups(yearData, d => d.category).map(([category, rows]) => {
        const result = summarize(rows)[0];
        const n = d3.sum(rows, d => d.count);
        const difference = result.percent - overall;
        return { ...result, label: category, dimmed: targetCategory !== 'all' && targetCategory !== category,
            valueLabel: `${formatPercent(result.percent)}% (${difference >= 0 ? '+' : ''}${formatPercent(difference)} pp) · n=${formatNumber(n)}` };
    }).sort((a, b) => d3.descending(a.percent, b.percent));
    createVis('#comparison', groups, groups.map(d => `${d.label}: ${d.valueLabel}`).join('. '), overall);
    d3.select('#comparison-note').text(`Received ${yearLabel}. Each bar uses its own category’s allegation count (n). Dashed line: all-category substantiation percentage for this year selection. pp = percentage points from that baseline. Category selection highlights a row; it does not change the baseline. These are descriptive comparisons, not causal effects.`);
}

function updateBlackHat() {
    const summary = summarize(allData);
    const combined = summary[1].count + summary[2].count;
    const total = d3.sum(allData, d => d.count);
    const misleading = [
        { label: 'Cleared', count: combined, percent: combined / total * 100, color: '#246557' },
        { label: 'Substantiated', count: summary[0].count, percent: summary[0].percent, color: '#82918a' }
    ];
    const data = revealed ? summary : misleading;
    d3.select('#black-title').text(revealed ? 'Nearly half of allegations remained unsubstantiated' : 'Three in four allegations leave officers cleared');
    d3.select('#black-subtitle').text(revealed ? 'Selected officers and closed cases. Unsubstantiated is not the same as exonerated.' : 'A broad view of the investigation record, 1985–2020.');
    d3.select('#black-number').text(`${formatPercent(revealed ? summary[1].percent : combined / total * 100)}%`);
    d3.select('#black-number-label').text(revealed ? 'of allegations unsubstantiated' : 'of allegations cleared');
    createVis('#black-chart', data, `${revealed ? 'Corrected' : 'Intentionally misleading'} chart. ` + data.map(d => `${d.label}: ${formatPercent(d.percent)} percent, ${d.count} records`).join('. '));
}

window.addEventListener('load', init);
