document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Lookups ---
    const psdInputRows = document.getElementById('psd-input-rows');
    const addRowBtn = document.getElementById('add-row-btn');
    const autoDesignBtn = document.getElementById('auto-design-btn');
    const stagesContainer = document.getElementById('stages-container');
    const startMessage = document.getElementById('start-message');
    const chartCard = document.getElementById('chart-card');
    const equipmentCard = document.getElementById('equipment-card');
    const equipmentContainer = document.getElementById('equipment-container');
    const reportCard = document.getElementById('report-card');
    const reportTableBody = document.getElementById('report-table-body');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const dailyCapacityInput = document.getElementById('daily-capacity');
    const shiftsInput = document.getElementById('shifts');
    const hoursPerShiftInput = document.getElementById('hours-per-shift');
    const accessibilityFactorInput = document.getElementById('accessibility-factor');
    const bulkDensityInput = document.getElementById('bulk-density');
    const bondWorkIndexInput = document.getElementById('bond-work-index');
    const targetP100Input = document.getElementById('target-p100');
    const tabsContainer = document.getElementById('tabs-container');
    const tabs = document.getElementById('tabs');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const plantCapacityElement = document.getElementById('plant-capacity');
    const effectiveHoursElement = document.getElementById('effective-hours');
    const totalPowerElement = document.getElementById('total-power');
    const totalPowerReportElement = document.getElementById('total-power-report');
    const chartSummaryContainer = document.getElementById('chart-summary-container');
    const massBalanceCard = document.getElementById('mass-balance-card');
    const massBalanceContainer = document.getElementById('mass-balance-container');
    const sizeAnalysisCard = document.getElementById('size-analysis-card');
    const sizeAnalysisContainer = document.getElementById('size-analysis-container');
    const schematicContainer = document.getElementById('schematic-container');
    const propertiesPanel = document.getElementById('properties-panel');
    const propertiesContent = document.getElementById('properties-content');
    const closePropertiesBtn = document.getElementById('close-properties-btn');
    const editSchematicBtn = document.getElementById('edit-schematic-btn');
    const runSimulationBtn = document.getElementById('run-simulation-btn');
    const schematicToolbar = document.getElementById('schematic-toolbar');

    // --- Global State ---
    let chartInstance = null;
    let selectedElement = null;
    const stageColors = ['#3b82f6', '#ef4444', '#10b981', '#eab308', '#8b5cf6', '#ec4899', '#f97316'];
    let initialFeedData = [];

    // --- JointJS State ---
    const App = {};
    App.shapes = {};
    let graph, paper;

    const initInteractiveSchematic = () => {
        const namespace = joint.shapes;
        graph = new joint.dia.Graph({}, { cellNamespace: namespace });

        const portAttrs = { portBody: { r: 6, fill: '#fff', stroke: '#313131', strokeWidth: 2 } };

        const baseShape = {
            ports: {
                groups: {
                    'in': { position: 'left', attrs: { ...portAttrs, portBody: { magnet: 'passive', fill: '#fde047' } }, z: -1 },
                    'out': { position: 'right', attrs: { ...portAttrs, portBody: { magnet: true, fill: '#3b82f6' } }, z: -1 }
                }
            }
        };

        App.shapes.Feed = joint.shapes.standard.Rectangle.define('App.Feed', { attrs: { body: { width: 120, height: 70, rx: 8, ry: 8, fill: '#fff', stroke: '#4b5563', strokeWidth: 2.5 }, label: { text: 'خوراک', fill: '#4b5563', fontFamily: 'Vazirmatn', fontWeight: '600', fontSize: 16 } }, ...baseShape });
        App.shapes.Product = joint.shapes.standard.Rectangle.define('App.Product', { attrs: { body: { width: 120, height: 70, rx: 8, ry: 8, fill: '#fff', stroke: '#10b981', strokeWidth: 2.5 }, label: { text: 'محصول نهایی', fill: '#10b981', fontFamily: 'Vazirmatn', fontWeight: '600', fontSize: 16 } }, ...baseShape });
        App.shapes.JawCrusher = joint.shapes.standard.Path.define('App.JawCrusher', { ...baseShape, attrs: { path: { d: 'M 0 0 L 20 0 L 60 80 L 80 80 L 80 100 L 0 100 Z', fill: '#d1d5db', stroke: '#4b5563', 'stroke-width': 2 }, label: { text: 'Jaw Crusher', 'ref-y': '110%', fontFamily: 'Vazirmatn' } } });
        App.shapes.ConeCrusher = joint.shapes.standard.Path.define('App.ConeCrusher', { ...baseShape, attrs: { path: { d: 'M 0 20 L 20 0 L 60 0 L 80 20 L 80 80 L 0 80 Z', fill: '#dbeafe', stroke: '#3b82f6', 'stroke-width': 2 }, label: { text: 'Cone Crusher', 'ref-y': '110%', fontFamily: 'Vazirmatn' } } });
        App.shapes.Screen = joint.shapes.standard.Path.define('App.Screen', { ...baseShape, attrs: { path: { d: 'M 0 0 L 80 0 L 60 80 L -20 80 Z', fill: '#d1fae5', stroke: '#10b981', 'stroke-width': 2 }, label: { text: 'Screen', 'ref-y': '110%', fontFamily: 'Vazirmatn' } } });

        paper = new joint.dia.Paper({
            el: document.getElementById('schematic-container'), model: graph, width: '100%', height: 600, gridSize: 10,
            drawGrid: { name: 'dot', args: { color: '#e0e0e0' } }, background: { color: '#f9fafb' },
            cellViewNamespace: namespace, interactive: false, linkPinning: true,
            defaultLink: () => new joint.shapes.standard.Link({ attrs: { line: { stroke: '#4a5568', strokeWidth: 2.5, targetMarker: { 'type': 'path', 'stroke': '#4a5568', 'fill': '#4a5568', 'd': 'M 10 -5 L 0 0 L 10 5 z' } } } }),
            validateConnection: function(vs, ms, vt, mt) { if (!ms || !mt) return false; if (ms.getAttribute('port-group') === 'in') return false; if (mt.getAttribute('port-group') !== 'in') return false; const links = graph.getLinks(); return !links.some(l => l.get('source').id === vs.model.id && l.get('target').id === vt.model.id); }
        });

        paper.on('cell:pointerclick', (cellView) => { selectedElement = cellView.model; if (cellView.model.get('stageData')) { displayProperties(cellView.model); } });
        paper.on('blank:pointerclick', () => { selectedElement = null; propertiesPanel.classList.add('hidden'); });

        const dnd = new joint.ui.DnD({ target: paper.el, paper: paper });
        schematicToolbar.querySelectorAll('.toolbar-item').forEach(item => {
            item.addEventListener('mousedown', (evt) => {
                const type = item.dataset.type; let el;
                if (type === 'jaw') el = new App.shapes.JawCrusher(); else if (type === 'cone') el = new App.shapes.ConeCrusher(); else el = new App.shapes.Screen();
                dnd.start(el, evt);
            });
        });

        paper.on('drop', (evt, element, x, y) => {
            const type = element.get('type'); const id = joint.util.uuid(); element.set('id', id);
            let stageData;
            if (type.includes('JawCrusher')) {
                stageData = { id, modelType: 'JawCrusher', crusherType: 'jaw', 'گلوگاه (mm)': 50.0, 'مرحله': 'Jaw Crusher' };
                element.addPort({ group: 'in', id: `${id}-in` }); element.addPort({ group: 'out', id: `${id}-out` });
            } else if (type.includes('ConeCrusher')) {
                stageData = { id, modelType: 'ConeCrusher', crusherType: 'cone', 'گلوگاه (mm)': 25.0, 'مرحله': 'Cone Crusher' };
                element.addPort({ group: 'in', id: `${id}-in` }); element.addPort({ group: 'out', id: `${id}-out` });
            } else if (type.includes('Screen')) {
                stageData = { id, modelType: 'Screen', type: 'screen', size: 20.0, 'مرحله': 'Screen' };
                element.addPort({ group: 'in', id: `${id}-in` });
                element.addPort({ group: 'out', id: 'out_over', attrs: { portBody: { fill: '#ef4444' } }, label: { text: 'Oversize' } });
                element.addPort({ group: 'out', id: 'out_under', attrs: { portBody: { fill: '#10b981' } }, position: { name: 'bottom' }, label: { text: 'Undersize' } });
            }
            if (stageData) { element.set('stageData', stageData); element.attr('label/text', stageData['مرحله']); }
        });
    };

    const displayProperties = (cellModel) => {
        const stage = cellModel.get('stageData'); if (!stage) { propertiesPanel.classList.add('hidden'); return; }
        let fields = '';
        if (stage.modelType === 'JawCrusher' || stage.modelType === 'ConeCrusher') { fields = `<div><label class="block font-medium text-sm">گلوگاه (CSS) (mm)</label><input type="number" value="${(stage['گلوگاه (mm)'] || 0).toFixed(1)}" class="input-field" data-prop="گلوگاه (mm)"></div>`; }
        else if (stage.modelType === 'Screen') { fields = `<div><label class="block font-medium text-sm">اندازه چشمی (mm)</label><input type="number" value="${(stage.size || 0).toFixed(1)}" class="input-field" data-prop="size"></div>`; }
        propertiesContent.innerHTML = `<div><label class="block font-medium text-sm">نام مرحله</label><input type="text" value="${stage['مرحله'] || stage.id}" class="input-field" data-prop="مرحله"></div><div><label class="block font-medium text-sm">نوع</label><input type="text" value="${stage.modelType}" class="input-field bg-gray-100" readonly></div>${fields}<div><label class="block font-medium text-sm">توان محاسبه شده (kW)</label><input type="number" value="${(stage['توان موتور (kW)'] || 0).toFixed(1)}" class="input-field bg-gray-100" readonly></div>`;
        propertiesPanel.classList.remove('hidden');
        propertiesContent.querySelectorAll('input[data-prop]').forEach(input => {
            input.addEventListener('change', (e) => {
                const prop = e.target.dataset.prop; const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                const data = cellModel.get('stageData'); if (data && !isNaN(value)) { data[prop] = value; cellModel.set('stageData', data); if (prop === 'مرحله') { cellModel.attr('label/text', value); } }
            });
        });
    };

    const updateAllUI = (processedElements) => {
        stagesContainer.innerHTML = ''; equipmentContainer.innerHTML = ''; chartSummaryContainer.innerHTML = '';
        if (initialFeedData.length === 0) return;
        const chartFeedData = initialFeedData.map(p => ({x: p.size, y: p.percent}));
        setupChart(chartFeedData);
        const f_max = Math.max(...initialFeedData.map(p=>p.size)); const f80_initial = interpolateXfromY(initialFeedData.map(p => p.size), initialFeedData.map(p => p.percent), 80);
        displayChartSummary({ 'مرحله': 'خوراک اولیه', psdSummary: {F100: f_max, F80: f80_initial, P80: f80_initial, P100: f_max, percentBypass:0} }, '#4b5563');

        const allStages = processedElements.map(e => e.get('stageData')).filter(s => s && s.psdSummary);
        allStages.forEach((stage, index) => {
            const color = stageColors[index % stageColors.length];
            if (stage.modelType !== 'Feed' && stage.modelType !== 'Product') { displayStage(stage, index); displayEquipment(stage); }
            if (stage.psdSummary.outputPSDs) { for (const portId in stage.psdSummary.outputPSDs) { addDataToChart(stage, portId, stage.psdSummary.outputPSDs[portId], color); } }
            displayChartSummary(stage, color);
        });
        const finalTotalPower = allStages.reduce((sum, s) => sum + (s['توان موتور (kW)'] || 0), 0);
        const plantTph = allStages.length > 0 && allStages[0].massBalance ? (allStages[0].massBalance.feedToStageTph) : 0;
        const effectiveHours = parseFloat(shiftsInput.value) * parseFloat(hoursPerShiftInput.value) * (parseFloat(accessibilityFactorInput.value) / 100);
        plantCapacityElement.textContent = `${plantTph.toFixed(1)} tph`; effectiveHoursElement.textContent = `${effectiveHours.toFixed(1)} h`; totalPowerElement.textContent = `${finalTotalPower.toFixed(1)} kW`;
        equipmentCard.classList.remove('hidden'); updateReportTable(allStages); displayMassBalanceTable(allStages); displaySizeAnalysisTable(allStages);
    };

    const handleAutoDesign = () => {
        initialFeedData = Array.from(psdInputRows.querySelectorAll('.psd-row')).map(r => ({ size: parseFloat(r.querySelector('.size-input').value), percent: parseFloat(r.querySelector('.percent-input').value) })).filter(d => !isNaN(d.size) && !isNaN(d.percent)).sort((a, b) => a.size - b.size);
        if (initialFeedData.length < 2) { alert('لطفا حداقل دو نقطه معتبر برای دانه‌بندی وارد کنید.'); return; }
        const f80_initial = interpolateXfromY(initialFeedData.map(p => p.size), initialFeedData.map(p => p.percent), 80);
        if (!f80_initial) { alert('خطا در محاسبه F80.'); return; }
        const targetP100 = parseFloat(targetP100Input.value); const targetP80 = targetP100 * Math.pow(0.8, 1 / 0.87);
        if (f80_initial <= targetP80) { alert("سایز خوراک از سایز محصول نهایی کوچکتر است."); return; }
        graph.clear();
        const feed = new App.shapes.Feed({ position: { x: 50, y: 250 }, id: 'feed', stageData: { id: 'feed', modelType: 'Feed', 'مرحله': 'Feed' } });
        feed.addPort({ group: 'out', id: 'feed-out' }); graph.addCell(feed);
        let current_f80 = f80_initial; let lastElement = feed; let lastPortId = 'feed-out'; let stageNum = 1;
        while (current_f80 > targetP80 && stageNum <= 5) {
            const y_pos = 50 + stageNum * 120; const id = `stage-${stageNum}`; let p80, stageData, el;
            if (stageNum === 1) {
                p80 = current_f80 / 3.0; stageData = { id, modelType: 'JawCrusher', crusherType: 'jaw', 'گلوگاه (mm)': p80, 'مرحله': 'خردایش اولیه' };
                el = new App.shapes.JawCrusher({ id, position: { x: 250, y: y_pos } });
                el.addPort({ group: 'in', id: `${id}-in` }); el.addPort({ group: 'out', id: `${id}-out` });
            } else {
                p80 = (current_f80 / 6 <= targetP80) ? targetP80 : current_f80 / 4.0;
                stageData = { id, modelType: 'ConeCrusher', crusherType: 'cone', 'گلوگاه (mm)': p80, 'مرحله': `مرحله ${stageNum}` };
                el = new App.shapes.ConeCrusher({ id, position: { x: 250, y: y_pos } });
                el.addPort({ group: 'in', id: `${id}-in` }); el.addPort({ group: 'out', id: `${id}-out` });
            }
            el.set('stageData', stageData); el.attr('label/text', stageData['مرحله']); graph.addCell(el);
            graph.addCell(new joint.shapes.standard.Link({ source: { id: lastElement.id, port: lastPortId }, target: { id: el.id, port: `${id}-in` } }));
            lastElement = el; lastPortId = `${id}-out`; current_f80 = p80; stageNum++;
        }
        const product = new App.shapes.Product({ position: { x: 500, y: 250 }, id: 'product', stageData: { id: 'product', modelType: 'Product', 'مرحله': 'Product' } });
        product.addPort({ group: 'in', id: 'product-in' }); graph.addCell(product);
        graph.addCell(new joint.shapes.standard.Link({ source: { id: lastElement.id, port: lastPortId }, target: { id: product.id, port: 'product-in' } }));
        runSimulation();
    };

    const runSimulation = () => {
        const dailyCapacity = parseFloat(dailyCapacityInput.value), shifts = parseInt(shiftsInput.value), hoursPerShift = parseFloat(hoursPerShiftInput.value), accessibilityFactor = parseFloat(accessibilityFactorInput.value) / 100, bulkDensity = parseFloat(bulkDensityInput.value), wi = parseFloat(bondWorkIndexInput.value);
        if ([dailyCapacity, shifts, hoursPerShift, accessibilityFactor, bulkDensity, wi].some(isNaN) || initialFeedData.length === 0) { alert("لطفا داده‌های ورودی اصلی را تکمیل کنید."); return; }
        const plantTph = dailyCapacity / (shifts * hoursPerShift * accessibilityFactor);
        const { sortedElements } = topologicalSort(graph);

        sortedElements.forEach(element => {
            const stageData = element.get('stageData'); if (!stageData) return;
            const inboundLinks = graph.getConnectedLinks(element, { inbound: true });
            let inputPsd = [];
            if (inboundLinks.length === 0) { if (stageData.modelType === 'Feed') { inputPsd = initialFeedData.map(p => ({ x: p.size, y: p.percent })); }
            } else {
                const inputPSDs = inboundLinks.map(link => { const sourceElement = graph.getCell(link.get('source').id); const sourcePortId = link.get('source').port; const sourceStageData = sourceElement.get('stageData'); return (sourceStageData && sourceStageData.psdSummary && sourceStageData.psdSummary.outputPSDs) ? sourceStageData.psdSummary.outputPSDs[sourcePortId] || [] : []; });
                inputPsd = combineInputPSDs(inputPSDs);
            }
            if (inputPsd.length === 0 && stageData.modelType !== 'Feed') { console.warn(`No input PSD for element ${stageData.id}`); return; }
            stageData.psdSummary = { outputPSDs: {} };
            if (stageData.modelType === 'JawCrusher' || stageData.modelType === 'ConeCrusher') {
                const sizes = inputPsd.map(p => p.x); const percents = inputPsd.map(p => p.y);
                const f80 = interpolateXfromY(sizes, percents, 80); const f100 = Math.max(...sizes);
                const css = stageData['گلوگاه (mm)']; const p80 = css;
                const specificPower = calculateSpecificPower(wi, f80, p80); const correctedPower = calculateCorrectedPower(specificPower, plantTph, stageData.crusherType);
                const gaudin_a = stageData.crusherType === 'jaw' ? 0.88 : 0.87; const productPsd = generateGaudinPSD(p80, gaudin_a);
                const p100 = Math.max(...productPsd.map(p => p.x)); const percentPassingCSS = interpolateYfromX(sizes, percents, css) || 0;
                stageData['F80 ورودی (mm)'] = f80; stageData['P80 خروجی (mm)'] = p80; stageData['نسبت خردایش'] = f80 / p80;
                stageData['توان (kWh/t)'] = specificPower; stageData['توان موتور (kW)'] = correctedPower; stageData['دهانه (mm)'] = f100 / 0.85;
                stageData.massBalance = { feedToStageTph: plantTph, productTph: plantTph };
                stageData.psdSummary = { F100: f100, F80: f80, P80: p80, P100: p100, percentBypass: percentPassingCSS, outputPSDs: { [`${stageData.id}-out`]: productPsd } };
            } else if (stageData.modelType === 'Screen') {
                const { oversizePSD, undersizePSD } = calculateScreenSplit(inputPsd, stageData.size);
                stageData.psdSummary.outputPSDs['out_over'] = oversizePSD; stageData.psdSummary.outputPSDs['out_under'] = undersizePSD;
                stageData.massBalance = { feedToStageTph: plantTph, productTph: plantTph };
            } else {
                const outPort = element.getPorts().find(p => p.group === 'out');
                if (outPort) { stageData.psdSummary.outputPSDs[outPort.id] = inputPsd; }
                stageData.massBalance = { feedToStageTph: plantTph, productTph: plantTph };
            }
            element.set('stageData', stageData);
        });
        startMessage.style.display = 'none'; tabsContainer.classList.remove('hidden'); updateAllUI(sortedElements);
    };

    const topologicalSort = (graph) => {
        const elements = graph.getElements(); const links = graph.getLinks(); const adjacencyList = {}; const inDegree = {};
        elements.forEach(el => { adjacencyList[el.id] = []; inDegree[el.id] = 0; });
        links.forEach(link => { const sourceId = link.get('source').id; const targetId = link.get('target').id; if (sourceId && targetId && adjacencyList[sourceId]) { adjacencyList[sourceId].push(targetId); inDegree[targetId]++; } });
        const queue = elements.filter(el => inDegree[el.id] === 0); const sortedElements = [];
        while (queue.length > 0) {
            const currentEl = queue.shift(); sortedElements.push(currentEl);
            if (adjacencyList[currentEl.id]) { adjacencyList[currentEl.id].forEach(neighborId => { inDegree[neighborId]--; if (inDegree[neighborId] === 0) { queue.push(graph.getCell(neighborId)); } }); }
        }
        return { sortedElements };
    }

    const combineInputPSDs = (psdArray) => { return psdArray.length > 0 ? psdArray[0] : []; };
    const calculateScreenSplit = (inputPsd, screenSize) => { const undersizePSD = [], oversizePSD = []; for (const p of inputPsd) { if (p.x < screenSize) undersizePSD.push(p); else oversizePSD.push(p); } return { oversizePSD, undersizePSD }; };
    const interpolateYfromX = (x, y, val) => { if (x.length < 2) return null; let i = 0; while (i < x.length && x[i] < val) i++; if (i === 0) return y[0]; if (i === x.length) return y[y.length - 1]; const [x1, x2] = [x[i-1], x[i]]; const [y1, y2] = [y[i-1], y[i]]; if (x1 === x2) return y1; return y1 + (y2 - y1) * (val - x1) / (x2 - x1); };
    const interpolateXfromY = (x, y, val) => { if (y.length < 2) return null; let i = 0; while (i < y.length && y[i] < val) i++; if (i === 0) return x[0]; if (i === y.length) return x[x.length - 1]; const [x1, x2] = [x[i-1], x[i]]; const [y1, y2] = [y[i-1], y[i]]; if (y1 === y2) return x1; return x1 + (x2 - x1) * (val - y1) / (y2 - y1); };
    const calculateSpecificPower = (wi, f80, p80) => { if (!f80 || !p80) return 0; const f80m = f80 * 1000, p80m = p80 * 1000; if (f80m <= 0 || p80m <= 0 || f80m <= p80m) return 0; return 11 * wi * (1 / Math.sqrt(p80m) - 1 / Math.sqrt(f80m)); };
    const calculateCorrectedPower = (sp, tph, type) => (sp * tph * ({ 'jaw': 2.0, 'cone': 1.3 }[type] || 1.0));
    const generateGaudinPSD = (p80, ga) => { const k = p80 / Math.pow(0.8, 1 / ga); const d = []; const ss = 0.1, es = k * 1.1; for (let i = 0; i < 100; i++) { const size = ss * Math.pow(es / ss, i / 99); let pass = 100 * Math.pow(size / k, ga); if (pass > 100) pass = 100; d.push({ x: size, y: pass }); } return d; };

    const setupChart = (feedData) => { chartCard.classList.remove('hidden'); chartSummaryContainer.innerHTML = ''; const ctx = document.getElementById('psd-chart').getContext('2d'); if (chartInstance) chartInstance.destroy(); chartInstance = new Chart(ctx, { type: 'line', data: { datasets: [{ label: 'خوراک اولیه', data: feedData, borderColor: '#4b5563', backgroundColor: 'rgba(75, 85, 99, 0.1)', borderDash: [5, 5], fill: false, pointRadius: 4, pointBackgroundColor: '#4b5563', tension: 0.3, borderWidth: 2.5 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'logarithmic', title: { display: true, text: 'اندازه ذرات (mm)', font: { family: 'Vazirmatn', size: 15, weight: '500' } }, grid: { color: 'rgba(107, 114, 128, 0.1)' } }, y: { min: 0, max: 100, title: { display: true, text: 'درصد تجمعی عبوری (%)', font: { size: 15, family: 'Vazirmatn', weight: '500' } }, grid: { color: 'rgba(107, 114, 128, 0.1)' } } }, plugins: { legend: { position: 'top', labels: { font: { family: 'Vazirmatn', size: 13 }, padding: 20, usePointStyle: true, pointStyle: 'circle' } }, tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: 12, titleFont: { size: 14, family: 'Vazirmatn' }, bodyFont: { size: 13, family: 'Vazirmatn' }, callbacks: { title: (tis) => `اندازه: ${tis[0].raw.x.toFixed(2)} mm`, label: (ti) => `عبوری: ${ti.raw.y.toFixed(2)} %` } } }, animation: { duration: 1200, easing: 'easeOutQuart' } } }); };
    const addDataToChart = (stage, portId, psd, color) => { if (!chartInstance || !psd) return; const label = `${stage['مرحله']} - ${portId}`; chartInstance.data.datasets.push({ label, data: psd, borderColor: color, backgroundColor: 'transparent', fill: false, pointRadius: 0, borderWidth: 3, tension: 0.3 }); chartInstance.update(); };
    const displayChartSummary = (stage, color) => { const s = stage.psdSummary; if (!s) return; const t = document.createElement('table'); t.className = 'chart-summary-table'; t.style.borderColor = color; const ts = (stage['گلوگاه (mm)'] != null) ? `(${(stage['گلوگاه (mm)'] || 0).toFixed(1)}mm)` : ''; t.innerHTML = `<thead><tr><th colspan="2" style="background-color: ${color}20; color: ${color};">تحلیل: ${stage['مرحله']}</th></tr></thead><tbody><tr><td>F100</td><td>${(s.F100||0).toFixed(1)}mm</td></tr><tr><td>F80</td><td>${(s.F80||0).toFixed(1)}mm</td></tr><tr><td>P80</td><td>${(s.P80||0).toFixed(1)}mm</td></tr><tr><td>P100</td><td>${(s.P100||0).toFixed(1)}mm</td></tr></tbody>`; chartSummaryContainer.appendChild(t); };
    const displayStage = (stage, index) => { const card = document.createElement('div'); const colorIndex = index % stageColors.length; card.className = 'stage-card p-6 rounded-lg bg-white'; card.style.borderRightColor = stageColors[colorIndex]; const icon = stage.crusherType === 'jaw' ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 16.5 3 21"/><path d="m3 14 7.5 7.5"/><path d="M14 16.5 21 21"/><path d="m21 14-7.5 7.5"/><path d="M10 16.5 14 16.5"/><path d="M4 11V4h16v7"/><path d="M4 4 12 11l8-7"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6.003 6.003 0 1 1-8.49-8.49l9.19-9.19a4.002 4.002 0 1 1 5.66 5.66l-9.2 9.19a2.001 2.001 0 1 1-2.83-2.83l8.49-8.48"/></svg>`; card.innerHTML = `<div class="flex justify-between items-start"><div class="flex items-center"><div class="crusher-icon" style="background-color: ${stageColors[colorIndex]}20;">${icon}</div><div><h3 class="font-bold text-lg flex items-center"><span class="stage-indicator" style="background-color: ${stageColors[colorIndex]}; color: white;">${index + 1}</span>${stage['مرحله']}</h3><span class="text-sm font-medium bg-gray-100 text-gray-600 px-3 py-1 rounded-full mt-2 inline-block">${stage.modelType}</span></div></div></div><div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"><div class="metric-card"><div class="metric-label">توان</div><div class="metric-value">${(stage['توان موتور (kW)']||0).toFixed(1)} kW</div></div><div class="metric-card"><div class="metric-label">گلوگاه</div><div class="metric-value">${(stage['گلوگاه (mm)']||0).toFixed(1)} mm</div></div><div class="metric-card"><div class="metric-label">F80 ورودی</div><div class="metric-value">${(stage['F80 ورودی (mm)']||0).toFixed(1)} mm</div></div><div class="metric-card"><div class="metric-label">P80 خروجی</div><div class="metric-value">${(stage['P80 خروجی (mm)']||0).toFixed(1)} mm</div></div></div>`; stagesContainer.appendChild(card); };
    const displayEquipment = (stage) => { const c = findClosestEquipment(stage.crusherType, stage['ظرفیت ورودی (tph)'], stage['توان موتور (kW)'], stage['گلوگاه (mm)']); const card = document.createElement('div'); card.className = 'equipment-card'; if (!c) { card.innerHTML = `<h3 class="font-bold text-lg mb-2 text-red-600">تجهیز مناسبی برای ${stage['مرحله']} یافت نشد.</h3>`; } else { card.innerHTML = `<h3 class="font-bold text-lg mb-4">تجهیزات پیشنهادی: ${stage['مرحله']}</h3><table class="equipment-table"><tr><th>مدل</th><th>Max Feed</th><th>CSS</th><th>Capacity</th><th>kW</th></tr><tr><td>${c.model}</td><td>${c.maxFeed}</td><td>${c.cssRange.join(' - ')}</td><td>${c.capacityRange.join(' - ')}</td><td>${c.kw}</td></tr></table>`; } equipmentContainer.appendChild(card); };
    const updateReportTable = (stages) => { reportCard.classList.remove('hidden'); reportTableBody.innerHTML = ''; let totalPower = 0; stages.forEach(s => { if (!s['توان موتور (kW)']) return; totalPower += s['توان موتور (kW)']; const row = document.createElement('tr'); row.innerHTML = `<td class="p-4 font-medium">${s['مرحله']}</td><td>${(s.massBalance.feedToStageTph||0).toFixed(2)}</td><td>${s['توان موتور (kW)'].toFixed(2)}</td><td>${s['توان (kWh/t)'].toFixed(3)}</td><td>${s['دهانه (mm)'] ? s['دهانه (mm)'].toFixed(1) : '---'}</td><td>${s['گلوگاه (mm)'] ? s['گلوگاه (mm)'].toFixed(1) : '---'}</td>`; reportTableBody.appendChild(row); }); totalPowerReportElement.textContent = `${totalPower.toFixed(1)} kW`; };
    const displayMassBalanceTable = (stages) => { const calculable = stages.filter(s => s.massBalance); if (calculable.length === 0) { massBalanceCard.classList.add('hidden'); return; } let html = `<table class="w-full text-center text-sm report-table"><thead><tr><th>مرحله</th><th>خوراک (tph)</th><th>محصول (tph)</th></tr></thead><tbody>`; calculable.forEach(s => { const mb = s.massBalance; html += `<tr><td class="p-4 font-medium">${s['مرحله']}</td><td>${mb.feedToStageTph.toFixed(2)}</td><td>${mb.productTph.toFixed(2)}</td></tr>`; }); html += '</tbody></table>'; massBalanceContainer.innerHTML = html; massBalanceCard.classList.remove('hidden'); };
    const displaySizeAnalysisTable = (stages) => { const calculable = stages.filter(s => s.psdSummary && s.psdSummary.F100); if (calculable.length === 0) { sizeAnalysisCard.classList.add('hidden'); return; } let html = `<table class="w-full text-center text-sm report-table"><thead><tr><th>مرحله</th><th>F100</th><th>F80</th><th>P80</th><th>P100</th></tr></thead><tbody>`; calculable.forEach(s => { const psd = s.psdSummary; html += `<tr><td class="p-4 font-medium">${s['مرحله']}</td><td>${psd.F100.toFixed(2)}</td><td>${psd.F80.toFixed(2)}</td><td>${psd.P80.toFixed(2)}</td><td>${psd.P100.toFixed(2)}</td></tr>`; }); html += '</tbody></table>'; sizeAnalysisContainer.innerHTML = html; sizeAnalysisCard.classList.remove('hidden'); };
    const handleDownloadCsv = () => { const elements = graph.getElements().map(e => e.get('stageData')).filter(Boolean); if (elements.length === 0) { alert("داده‌ای برای دانلود وجود ندارد."); return; } const headers = ['id', 'مرحله', 'modelType', 'ظرفیت ورودی (tph)', 'توان موتور (kW)', 'F80 ورودی (mm)', 'P80 خروجی (mm)']; let csv = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n"; elements.forEach(s => { if (!s['توان موتور (kW)']) return; const row = headers.map(h => { const v = s[h]; return (v === null || typeof v === 'undefined') ? '' : (typeof v === 'number' ? v.toFixed(2) : `"${v}"`); }); csv += row.join(",") + "\n"; }); const uri = encodeURI(csv); const link = document.createElement("a"); link.setAttribute("href", uri); link.setAttribute("download", `crusher_report_${new Date().toISOString().slice(0,10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); };

    // --- Event Listeners ---
    addRowBtn.addEventListener('click', () => addPsdRow());
    autoDesignBtn.addEventListener('click', handleAutoDesign);
    runSimulationBtn.addEventListener('click', runSimulation);
    downloadCsvBtn.addEventListener('click', handleDownloadCsv);
    tabs.addEventListener('click', (e) => { if (e.target.classList.contains('tab-btn')) { tabs.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); tabPanels.forEach(p => p.classList.remove('active')); document.getElementById(e.target.dataset.tab).classList.add('active'); } });
    closePropertiesBtn.addEventListener('click', () => propertiesPanel.classList.add('hidden'));
    editSchematicBtn.addEventListener('click', () => { const isHidden = schematicToolbar.classList.toggle('hidden'); runSimulationBtn.classList.toggle('hidden', isHidden); paper.setInteractivity(!isHidden); });
    document.addEventListener('keydown', (e) => { if (selectedElement && (e.key === 'Delete' || e.key === 'Backspace')) { selectedElement.remove(); selectedElement = null; propertiesPanel.classList.add('hidden'); } });

    // --- Initial Page Setup ---
    [ { size: 50, percent: 12 }, { size: 75, percent: 26 }, { size: 100, percent: 40 }, { size: 150, percent: 64 }, { size: 200, percent: 82 }, { size: 300, percent: 94 }, { size: 400, percent: 100 } ].forEach(p => addPsdRow(p.size, p.percent));
    updateRowIndicators();
    initInteractiveSchematic();
});
