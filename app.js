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

    // --- Global State ---
    let chartInstance = null;
    let stagesData = [];
    const stageColors = ['#3b82f6', '#ef4444', '#10b981', '#eab308', '#8b5cf6', '#ec4899', '#f97316'];
    let initialFeedData = [];

    // --- JointJS Setup ---
    let graph, paper, namespace;

    const initInteractiveSchematic = () => {
        namespace = joint.shapes;
        graph = new joint.dia.Graph({}, { cellNamespace: namespace });

        paper = new joint.dia.Paper({
            el: document.getElementById('schematic-container'),
            model: graph,
            width: '100%',
            height: 600,
            gridSize: 10,
            drawGrid: { name: 'dot', args: { color: '#e0e0e0' } },
            background: { color: '#f9fafb' },
            cellViewNamespace: namespace,
            interactive: true,
            linkPinning: false,
        });

        paper.on('cell:pointerclick', (cellView) => {
            const stageData = cellView.model.get('stageData');
            if (stageData) {
                displayProperties(cellView.model);
            }
        });
    };

    const displayProperties = (cellModel) => {
        const stage = cellModel.get('stageData');
        propertiesContent.innerHTML = `
            <div>
                <label class="block font-medium text-sm">مرحله</label>
                <input type="text" value="${stage['مرحله']}" class="input-field bg-gray-100" readonly>
            </div>
            <div>
                <label class="block font-medium text-sm">نوع سنگ شکن</label>
                <input type="text" value="${stage.crusherType}" class="input-field bg-gray-100" readonly>
            </div>
            <div>
                <label class="block font-medium text-sm">گلوگاه (CSS) (mm)</label>
                <input type="number" value="${stage['گلوگاه (mm)'].toFixed(1)}" class="input-field" data-prop="گلوگاه (mm)" data-stage-id="${stage.id}">
            </div>
             <div>
                <label class="block font-medium text-sm">توان موتور (kW)</label>
                <input type="number" value="${stage['توان موتور (kW)'].toFixed(1)}" class="input-field bg-gray-100" readonly>
            </div>
        `;
        propertiesPanel.classList.remove('hidden');

        // Add event listener for the editable property
        const editableInput = propertiesContent.querySelector('[data-prop="گلوگاه (mm)"]');
        editableInput.addEventListener('change', (e) => {
            const newCss = parseFloat(e.target.value);
            const stageId = e.target.dataset.stageId;
            const stageIndex = stagesData.findIndex(s => s.id === stageId);

            if (stageIndex !== -1 && !isNaN(newCss)) {
                // Update the model
                stagesData[stageIndex]['گلوگاه (mm)'] = newCss;
                // Recalculate from the changed stage onwards
                recalculateCircuit(stageIndex);
                // Redraw everything
                updateAllUI();
            }
        });
    };

    const updateAllUI = () => {
        // Clear old results
        stagesContainer.innerHTML = '';
        equipmentContainer.innerHTML = '';
        chartSummaryContainer.innerHTML = '';

        // Redraw all components
        const chartFeedData = initialFeedData.map(p => ({x: p.size, y: p.percent}));
        setupChart(chartFeedData);

        const f_max = Math.max(...initialFeedData.map(p=>p.size));
        const f80_initial = interpolateXfromY(initialFeedData.map(p => p.size), initialFeedData.map(p => p.percent), 80);
        displayChartSummary({
            'مرحله': 'خوراک اولیه', 'گلوگاه (mm)': null,
            psdSummary: {F100: f_max, F80: f80_initial, P80: f80_initial, P100: f_max, percentBypass:0}
        }, '#4b5563');

        stagesData.forEach((stage, index) => {
            const color = stageColors[index % stageColors.length];
            displayStage(stage, index);
            addDataToChart(stage, color);
            displayChartSummary(stage, color);
            displayEquipment(stage);
        });

        const finalTotalPower = stagesData.reduce((sum, stage) => sum + stage['توان موتور (kW)'], 0);
        const plantTph = stagesData.length > 0 ? (stagesData[0].massBalance.feedToStageTph) : 0;
        const effectiveHours = parseFloat(shiftsInput.value) * parseFloat(hoursPerShiftInput.value) * (parseFloat(accessibilityFactorInput.value) / 100);

        plantCapacityElement.textContent = `${plantTph.toFixed(1)} tph`;
        effectiveHoursElement.textContent = `${effectiveHours.toFixed(1)} h`;
        totalPowerElement.textContent = `${finalTotalPower.toFixed(1)} kW`;

        equipmentCard.classList.remove('hidden');
        updateReportTable();
        displayMassBalanceTable(stagesData);
        displaySizeAnalysisTable(stagesData);
        updateInteractiveSchematic(stagesData);
    };

    const updateInteractiveSchematic = (stages) => {
        graph.clear();
        if (!stages || stages.length === 0) return;

        const elements = {};
        let lastElementId = null;

        const feed = new joint.shapes.standard.Rectangle({
            position: { x: 50, y: 50 },
            size: { width: 120, height: 70 },
            attrs: {
                body: { fill: '#fff', stroke: '#4b5563', strokeWidth: 2.5, rx: 8, ry: 8 },
                label: { text: 'خوراک', fill: '#4b5563', fontFamily: 'Vazirmatn', fontWeight: '600', fontSize: 16 }
            }
        });
        feed.addTo(graph);
        elements['feed'] = feed;
        lastElementId = feed.id;

        stages.forEach((stage, i) => {
            const y_pos = 50 + (i + 1) * 150;
            const color = stageColors[i % stageColors.length];
            const crusherLabel = `${stage['مرحله']}\n(CSS: ${stage['گلوگاه (mm)'].toFixed(1)} mm)`;

            const crusher = new joint.shapes.standard.Rectangle({
                position: { x: 250, y: y_pos },
                size: { width: 140, height: 80 },
                attrs: {
                    body: { fill: `${color}10`, stroke: color, strokeWidth: 2.5, rx: 8, ry: 8 },
                    label: { text: crusherLabel, fill: color, fontFamily: 'Vazirmatn', fontWeight: '600', fontSize: 14, textWrap: { width: -10 } }
                },
            });
            crusher.set('stageData', stage); // Attach stage data to the element
            crusher.addTo(graph);
            elements[stage['مرحله']] = crusher;

            const link = new joint.shapes.standard.Link({
                source: { id: lastElementId },
                target: { id: crusher.id },
                attrs: { line: { stroke: '#4a5568', strokeWidth: 2.5, targetMarker: { 'type': 'path', 'stroke': '#4a5568', 'fill': '#4a5568', 'd': 'M 10 -5 L 0 0 L 10 5 z' } } }
            });
            link.addTo(graph);
            lastElementId = crusher.id;
        });

        const product = new joint.shapes.standard.Rectangle({
            position: { x: 480, y: 50 + (stages.length) * 150 },
            size: { width: 120, height: 70 },
            attrs: {
                body: { fill: '#fff', stroke: '#10b981', strokeWidth: 2.5, rx: 8, ry: 8 },
                label: { text: 'محصول نهایی', fill: '#10b981', fontFamily: 'Vazirmatn', fontWeight: '600', fontSize: 16 }
            }
        });
        product.addTo(graph);
        elements['product'] = product;

        const finalLink = new joint.shapes.standard.Link({
            source: { id: lastElementId },
            target: { id: product.id },
            attrs: { line: { stroke: '#4a5568', strokeWidth: 2.5, targetMarker: { 'type': 'path', 'stroke': '#4a5568', 'fill': '#4a5568', 'd': 'M 10 -5 L 0 0 L 10 5 z' } } }
        });
        finalLink.addTo(graph);
    };

    const equipmentData = {
        jaw: [
            { model: 'F-1500x1200', gape: 1200, maxFeed: 1020, cssRange: [150, 300], capacityRange: [400, 850], kw: 250 },
            { model: 'F-1200x900', gape: 900, maxFeed: 750, cssRange: [75, 200], capacityRange: [130, 360], kw: 132 },
            { model: 'F-1100x800', gape: 800, maxFeed: 680, cssRange: [75, 180], capacityRange: [120, 300], kw: 110 },
            { model: 'F-1000x750', gape: 750, maxFeed: 630, cssRange: [75, 175], capacityRange: [110, 260], kw: 90 },
            { model: 'F-900x600', gape: 600, maxFeed: 500, cssRange: [65, 150], capacityRange: [65, 180], kw: 75 },
            { model: 'F-800x550', gape: 550, maxFeed: 450, cssRange: [55, 130], capacityRange: [50, 150], kw: 55 },
            { model: 'F-750x500', gape: 500, maxFeed: 420, cssRange: [50, 125], capacityRange: [45, 120], kw: 55 },
            { model: 'F-600x400', gape: 400, maxFeed: 340, cssRange: [40, 100], capacityRange: [25, 70], kw: 37 },
            { model: 'F-500x300', gape: 300, maxFeed: 250, cssRange: [25, 80], capacityRange: [15, 50], kw: 30 },
            { model: 'F-400x250', gape: 250, maxFeed: 210, cssRange: [20, 60], capacityRange: [8, 35], kw: 22 }
        ],
        cone: [
            { model: 'CS-7', type: 'Standard', maxFeed: 370, cssRange: [25, 60], capacityRange: [450, 1100], kw: 315 },
            { model: 'CS-5.5', type: 'Standard', maxFeed: 230, cssRange: [19, 51], capacityRange: [220, 480], kw: 220 },
            { model: 'CH-4.5', type: 'Standard', maxFeed: 185, cssRange: [13, 38], capacityRange: [140, 300], kw: 160 },
            { model: 'CS-4', type: 'Standard', maxFeed: 160, cssRange: [13, 32], capacityRange: [90, 210], kw: 132 },
            { model: 'CS-3', type: 'Standard', maxFeed: 125, cssRange: [10, 25], capacityRange: [60, 130], kw: 90 },
            { model: 'CS-2', type: 'Standard', maxFeed: 90, cssRange: [8, 19], capacityRange: [20, 70], kw: 55 },
            { model: 'CH-7 SH', type: 'Short Head', maxFeed: 180, cssRange: [10, 38], capacityRange: [300, 750], kw: 315 },
            { model: 'CH-5.5 SH', type: 'Short Head', maxFeed: 130, cssRange: [8, 32], capacityRange: [150, 400], kw: 220 },
            { model: 'CS-4 SH', type: 'Short Head', maxFeed: 100, cssRange: [6, 25], capacityRange: [60, 160], kw: 132 },
            { model: 'CH-430', type: 'Short Head', maxFeed: 90, cssRange: [6, 25], capacityRange: [50, 150], kw: 110 },
            { model: 'CS-3 SH', type: 'Short Head', maxFeed: 60, cssRange: [5, 19], capacityRange: [25, 80], kw: 75 },
            { model: 'CS-2 SH', type: 'Short Head', maxFeed: 45, cssRange: [3, 13], capacityRange: [15, 50], kw: 55 }
        ]
    };

    const findClosestEquipment = (crusherType, requiredCapacity, requiredPower, css) => {
        const table = equipmentData[crusherType] || [];

        const suitableEquipment = table.filter(item =>
            item.kw >= requiredPower &&
            css >= item.cssRange[0] &&
            css <= item.cssRange[1] &&
            requiredCapacity >= item.capacityRange[0] * 0.7 &&
            requiredCapacity <= item.capacityRange[1] * 1.5
        );

        if (suitableEquipment.length > 0) {
            return suitableEquipment.sort((a, b) => a.kw - b.kw)[0];
        } else {
            const powerSufficient = table.filter(item => item.kw >= requiredPower);
            if (powerSufficient.length > 0) {
                return powerSufficient.sort((a,b) => a.kw - b.kw)[0];
            }
        }
        return null;
    };

    const addPsdRow = (size = '', percent = '') => {
        const rowCount = psdInputRows.children.length;
        const row = document.createElement('div');
        row.className = 'psd-row flex items-center gap-3 border border-gray-200 rounded-lg p-3';
        row.innerHTML = `
            <div class="stage-indicator">${rowCount + 1}</div>
            <div class="flex-1">
                <input type="number" placeholder="اندازه (mm)" class="input-field size-input" value="${size}" min="0.1" step="0.1">
            </div>
            <div class="flex-1">
                <input type="number" placeholder="درصد عبوری (%)" class="input-field percent-input" value="${percent}" min="0" max="100">
            </div>
            <div class="remove-row">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
        `;
        psdInputRows.appendChild(row);
        row.querySelector('.remove-row').addEventListener('click', () => {
            row.remove();
            updateRowIndicators();
        });
    };

    const updateRowIndicators = () => {
        const rows = psdInputRows.querySelectorAll('.psd-row');
        rows.forEach((row, index) => {
            row.querySelector('.stage-indicator').textContent = index + 1;
        });
    };

    const interpolateYfromX = (x_series, y_series, target_x) => {
        if (x_series.length < 2) return null;
        let i = 0;
        while (i < x_series.length && x_series[i] < target_x) { i++; }
        if (i === 0) return y_series[0];
        if (i === x_series.length) return y_series[x_series.length - 1];
        const x1 = x_series[i-1], x2 = x_series[i];
        const y1 = y_series[i-1], y2 = y_series[i];
        if (x1 === x2) return y1;
        return y1 + (y2 - y1) * (target_x - x1) / (x2 - x1);
    };

    const interpolateXfromY = (x_series, y_series, target_y) => {
        if (y_series.length < 2) return null;
        let i = 0;
        while (i < y_series.length && y_series[i] < target_y) { i++; }
        if (i === 0) return x_series[0];
        if (i === y_series.length) return x_series[y_series.length - 1];
        const x1 = x_series[i-1], x2 = x_series[i];
        const y1 = y_series[i-1], y2 = y_series[i];
        if (y1 === y2) return x1;
        return x1 + (x2 - x1) * (target_y - y1) / (y2 - y1);
    };

    const calculateSpecificPower = (wi, f80, p80) => {
        const f80_micron = f80 * 1000;
        const p80_micron = p80 * 1000;
        if (f80_micron <= 0 || p80_micron <= 0 || f80_micron <= p80_micron) return 0;
        return 11 * wi * (1 / Math.sqrt(p80_micron) - 1 / Math.sqrt(f80_micron));
    };

    const calculateCorrectedPower = (specificPower, tph, crusherType) => {
        const correctionFactors = { 'jaw': 2.0, 'cone': 1.3 };
        const factor = correctionFactors[crusherType] || 1.0;
        return specificPower * tph * factor;
    };

    const generateGaudinPSD = (p80, gaudin_a) => {
        const k = p80 / Math.pow(0.8, 1 / gaudin_a);
        const data = [];
        const startSize = 0.1;
        const endSize = k * 1.1;
        for (let i = 0; i < 100; i++) {
            const size = startSize * Math.pow(endSize / startSize, i / 99);
            let passing = 100 * Math.pow(size / k, gaudin_a);
            if (passing > 100) passing = 100;
            data.push({ x: size, y: passing });
        }
        return data;
    };

    const setupChart = (feedData) => {
        chartCard.classList.remove('hidden');
        const ctx = document.getElementById('psd-chart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        const options = {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'logarithmic', title: { display: true, text: 'اندازه ذرات (mm)', font: { family: 'Vazirmatn', size: 15, weight: '500' } }, grid: { color: 'rgba(107, 114, 128, 0.1)' } },
                y: { min: 0, max: 100, title: { display: true, text: 'درصد تجمعی عبوری (%)', font: { size: 15, family: 'Vazirmatn', weight: '500' } }, grid: { color: 'rgba(107, 114, 128, 0.1)' } }
            },
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'Vazirmatn', size: 13 }, padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: 12, titleFont: { size: 14, family: 'Vazirmatn' }, bodyFont: { size: 13, family: 'Vazirmatn' }, callbacks: { title: (tooltipItems) => `اندازه: ${tooltipItems[0].raw.x.toFixed(2)} mm`, label: (tooltipItem) => `عبوری: ${tooltipItem.raw.y.toFixed(2)} %` } }
            },
            animation: { duration: 1200, easing: 'easeOutQuart' }
        };
        chartInstance = new Chart(ctx, { type: 'line', data: { datasets: [{ label: 'خوراک اولیه', data: feedData, borderColor: '#4b5563', backgroundColor: 'rgba(75, 85, 99, 0.1)', borderDash: [5, 5], fill: false, pointRadius: 4, pointBackgroundColor: '#4b5563', tension: 0.3, borderWidth: 2.5 }] }, options: options });
    };

    const addDataToChart = (stage, color) => {
        if (!chartInstance) return;
        const data = stage.psdSummary.productPSD;
        const label = `محصول ${stage['مرحله']}`;
        chartInstance.data.datasets.push({ label: label, data: data, borderColor: color, backgroundColor: 'transparent', fill: false, pointRadius: 0, borderWidth: 3, tension: 0.3 });
        chartInstance.update();
    };

    const displayChartSummary = (stage, color) => {
        const summary = stage.psdSummary;
        const table = document.createElement('table');
        table.className = 'chart-summary-table';
        table.style.borderColor = color;
        const throatSizeText = (stage['گلوگاه (mm)'] !== null && typeof stage['گلوگاه (mm)'] !== 'undefined') ? `(${stage['گلوگاه (mm)'].toFixed(1)}mm)` : '';
        table.innerHTML = `
            <thead>
                <tr><th colspan="2" style="background-color: ${color}20; color: ${color};">تحلیل مرحله: ${stage['مرحله']}</th></tr>
            </thead>
            <tbody>
                <tr><td>F100 (بزرگترین سایز ورودی)</td><td>${summary.F100.toFixed(1)} mm</td></tr>
                <tr><td>F80 (ورودی)</td><td>${summary.F80.toFixed(1)} mm</td></tr>
                <tr><td>P80 (خروجی)</td><td>${summary.P80.toFixed(1)} mm</td></tr>
                <tr><td>P100 (بزرگترین سایز خروجی)</td><td>${summary.P100.toFixed(1)} mm</td></tr>
                <tr><td>درصد عبوری از گلوگاه ${throatSizeText}</td><td>${summary.percentBypass.toFixed(1)}%</td></tr>
            </tbody>`;
        chartSummaryContainer.appendChild(table);
    };

    const displayStage = (stage, index) => {
        const card = document.createElement('div');
        const colorIndex = index % stageColors.length;
        card.className = 'stage-card p-6 rounded-lg bg-white';
        card.style.borderRightColor = stageColors[colorIndex];
        const crusherIcon = stage.crusherType === 'jaw' ?
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-blue-600"><path d="M10 16.5 3 21"/><path d="m3 14 7.5 7.5"/><path d="M14 16.5 21 21"/><path d="m21 14-7.5 7.5"/><path d="M10 16.5 14 16.5"/><path d="M4 11V4h16v7"/><path d="M4 4 12 11l8-7"/></svg>` :
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-green-600"><path d="m21.44 11.05-9.19 9.19a6.003 6.003 0 1 1-8.49-8.49l9.19-9.19a4.002 4.002 0 1 1 5.66 5.66l-9.2 9.19a2.001 2.001 0 1 1-2.83-2.83l8.49-8.48"/></svg>`;

        let capacityHtml;
        if (stage.crusherType === 'cone') {
            capacityHtml = `
                <div class="metric-card"><div class="metric-label">ظرفیت باز (tph)</div><div class="metric-value">${stage['ظرفیت مدار باز (tph)'].toFixed(1)}</div></div>
                <div class="metric-card"><div class="metric-label">ظرفیت بسته (tph)</div><div class="metric-value">${stage['ظرفیت مدار بسته (tph)'].toFixed(1)}</div></div>
            `;
        } else {
            capacityHtml = `
                <div class="metric-card"><div class="metric-label">ظرفیت (tph)</div><div class="metric-value">${stage['ظرفیت ورودی (tph)'].toFixed(1)}</div></div>
                <div class="metric-card"><div class="metric-label">ظرفیت (m³/h)</div><div class="metric-value">${stage['ظرفیت ورودی (m3/h)'].toFixed(1)}</div></div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center">
                    <div class="crusher-icon" style="background-color: ${stageColors[colorIndex]}20;">${crusherIcon}</div>
                    <div>
                        <h3 class="font-bold text-lg flex items-center">
                            <span class="stage-indicator" style="background-color: ${stageColors[colorIndex]}; color: white;">${index + 1}</span>
                            ${stage['مرحله']}
                        </h3>
                        <span class="text-sm font-medium bg-gray-100 text-gray-600 px-3 py-1 rounded-full mt-2 inline-block">${stage['نوع مدار']}</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">${stage.crusherType === 'jaw' ? 'سنگ شکن فکی' : 'سنگ شکن مخروطی'}</span>
                </div>
            </div>
            <div class="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div class="metric-card"><div class="metric-label">توان موتور</div><div class="metric-value">${stage['توان موتور (kW)'].toFixed(1)} kW</div></div>
                ${capacityHtml}
                <div class="metric-card"><div class="metric-label">گلوگاه</div><div class="metric-value">${stage['گلوگاه (mm)'].toFixed(1)} mm</div></div>
                <div class="metric-card"><div class="metric-label">دهانه</div><div class="metric-value">${stage['دهانه (mm)'] !== null ? stage['دهانه (mm)'].toFixed(1) : '---'}</div></div>
            </div>
            <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="metric-card"><div class="metric-label">F80 ورودی</div><div class="metric-value">${stage['F80 ورودی (mm)'].toFixed(1)} mm</div></div>
                <div class="metric-card"><div class="metric-label">P80 خروجی</div><div class="metric-value">${stage['P80 خروجی (mm)'].toFixed(1)} mm</div></div>
                <div class="metric-card"><div class="metric-label">نسبت خردایش</div><div class="metric-value">${stage['نسبت خردایش'].toFixed(1)}:1</div></div>
                <div class="metric-card"><div class="metric-label">توان ویژه</div><div class="metric-value">${stage['توان (kWh/t)'].toFixed(3)}</div></div>
            </div>`;
        stagesContainer.appendChild(card);
    };

    const displayEquipment = (stage) => {
        const closest = findClosestEquipment(stage.crusherType, stage['ظرفیت ورودی (tph)'], stage['توان موتور (kW)'], stage['گلوگاه (mm)']);
        if (!closest) {
            const card = document.createElement('div');
            card.className = 'equipment-card';
            card.innerHTML = `<h3 class="font-bold text-lg mb-2 text-red-600">تجهیز مناسبی برای ${stage['مرحله']} یافت نشد.</h3><p class="text-sm">لطفا پارامترهای ورودی را بازبینی کنید یا دیتابیس تجهیزات را گسترش دهید.</p>`;
            equipmentContainer.appendChild(card);
            return;
        }
        const card = document.createElement('div');
        card.className = 'equipment-card';
        card.innerHTML = `
            <h3 class="font-bold text-lg mb-4">تجهیزات پیشنهادی برای ${stage['مرحله']}</h3>
            <table class="equipment-table">
                <tr><th>مدل</th><th>حداکثر خوراک (mm)</th><th>محدوده گلوگاه (mm)</th><th>محدوده ظرفیت (tph)</th><th>قدرت (kW)</th></tr>
                <tr><td>${closest.model}</td><td>${closest.maxFeed}</td><td>${closest.cssRange.join(' - ')}</td><td>${closest.capacityRange.join(' - ')}</td><td>${closest.kw}</td></tr>
            </table>`;
        equipmentContainer.appendChild(card);
    };

    const updateReportTable = () => {
        reportCard.classList.remove('hidden');
        reportTableBody.innerHTML = '';
        let totalPower = 0;
        stagesData.forEach(stage => {
            totalPower += stage['توان موتور (kW)'];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-4 font-medium">${stage['مرحله']}</td>
                <td>${stage['ظرفیت ورودی (tph)'].toFixed(2)}</td>
                <td>${stage['ظرفیت ورودی (m3/h)'].toFixed(2)}</td>
                <td>${stage['توان موتور (kW)'].toFixed(2)}</td>
                <td>${stage['توان (kWh/t)'].toFixed(3)}</td>
                <td>${stage['دهانه (mm)'] !== null ? stage['دهانه (mm)'].toFixed(1) : '---'}</td>
                <td>${stage['گلوگاه (mm)'].toFixed(1)}</td>
                <td>${stage['نوع مدار']}</td>`;
            reportTableBody.appendChild(row);
        });
        totalPowerReportElement.textContent = `${totalPower.toFixed(1)} kW`;
    };

    const displayMassBalanceTable = (stages) => {
        if (!stages || stages.length === 0) {
            massBalanceCard.classList.add('hidden');
            return;
        }
        let tableHTML = `<table class="w-full text-center text-sm report-table"><thead><tr>
            <th>مرحله</th>
            <th>خوراک جدید (tph)</th>
            <th>کنارگذر (tph)</th>
            <th>بار در گردش (tph)</th>
            <th>خوراک سنگ شکن (tph)</th>
            <th>محصول نهایی مرحله (tph)</th>
        </tr></thead><tbody>`;
        stages.forEach(stage => {
            const mb = stage.massBalance;
            tableHTML += `<tr>
                <td class="p-4 font-medium">${stage['مرحله']}</td>
                <td>${mb.feedToStageTph.toFixed(2)}</td>
                <td>${(mb.screenBypassTph || 0).toFixed(2)}</td>
                <td>${(mb.circulatingLoadTph || 0).toFixed(2)}</td>
                <td>${mb.crusherFeedTph.toFixed(2)}</td>
                <td>${mb.productTph.toFixed(2)}</td>
            </tr>`;
        });
        tableHTML += '</tbody></table>';
        massBalanceContainer.innerHTML = tableHTML;
        massBalanceCard.classList.remove('hidden');
    };

    const displaySizeAnalysisTable = (stages) => {
        if (!stages || stages.length === 0) {
            sizeAnalysisCard.classList.add('hidden');
            return;
        }
        let tableHTML = `<table class="w-full text-center text-sm report-table"><thead><tr>
            <th>مرحله</th>
            <th>F100 (mm)</th>
            <th>F80 (mm)</th>
            <th>P80 (mm)</th>
            <th>P100 (mm)</th>
        </tr></thead><tbody>`;
        stages.forEach(stage => {
            const psd = stage.psdSummary;
            tableHTML += `<tr>
                <td class="p-4 font-medium">${stage['مرحله']}</td>
                <td>${psd.F100.toFixed(2)}</td>
                <td>${psd.F80.toFixed(2)}</td>
                <td>${psd.P80.toFixed(2)}</td>
                <td>${psd.P100.toFixed(2)}</td>
            </tr>`;
        });
        tableHTML += '</tbody></table>';
        sizeAnalysisContainer.innerHTML = tableHTML;
        sizeAnalysisCard.classList.remove('hidden');
    };

    const handleAutoDesign = () => {
        const psdRows = psdInputRows.querySelectorAll('.psd-row');
        initialFeedData = Array.from(psdRows).map(row => ({
            size: parseFloat(row.querySelector('.size-input').value),
            percent: parseFloat(row.querySelector('.percent-input').value),
        })).filter(d => !isNaN(d.size) && !isNaN(d.percent)).sort((a, b) => a.size - b.size);

        if (initialFeedData.length < 2) {
            alert('لطفا حداقل دو نقطه معتبر برای دانه‌بندی وارد کنید.'); return;
        }

        const f80_initial = interpolateXfromY(initialFeedData.map(p => p.size), initialFeedData.map(p => p.percent), 80);
        if (!f80_initial) {
            alert('خطا در محاسبه F80. لطفا دانه‌بندی خوراک را بررسی کنید.'); return;
        }

        const targetP100 = parseFloat(targetP100Input.value);
        const gaudin_a_cone = 0.87;
        const targetP80 = targetP100 * Math.pow(0.8, 1 / gaudin_a_cone);

        if (f80_initial <= targetP80) {
            alert("سایز خوراک از سایز محصول نهایی کوچکتر است."); return;
        }

        // Auto-design the initial stages configuration
        stagesData = [];
        let stageNum = 1;
        let current_f80 = f80_initial;
        while (current_f80 > targetP80 && stageNum <= 5) {
            let p80_current;
            if (stageNum === 1) {
                p80_current = current_f80 / 3.0;
                stagesData.push({ id: `stage-${stageNum}`, crusherType: 'jaw', 'گلوگاه (mm)': p80_current });
            } else {
                 const maxPossibleNextP80 = current_f80 / 6;
                if (maxPossibleNextP80 <= targetP80) {
                    p80_current = targetP80;
                } else {
                    p80_current = current_f80 / 4.0;
                }
                stagesData.push({ id: `stage-${stageNum}`, crusherType: 'cone', 'گلوگاه (mm)': p80_current });
            }
            current_f80 = p80_current;
            stageNum++;
        }

        recalculateCircuit(0);
        updateAllUI();
    };

    const recalculateCircuit = (startFromIndex = 0) => {
        const dailyCapacity = parseFloat(dailyCapacityInput.value);
        const shifts = parseInt(shiftsInput.value);
        const hoursPerShift = parseFloat(hoursPerShiftInput.value);
        const accessibilityFactor = parseFloat(accessibilityFactorInput.value) / 100;
        const bulkDensity = parseFloat(bulkDensityInput.value);
        const wi = parseFloat(bondWorkIndexInput.value);
        const targetP100 = parseFloat(targetP100Input.value);

        if (isNaN(dailyCapacity) || isNaN(wi)) {
            alert("لطفا داده‌های ورودی اصلی (ظرفیت، شاخص کار) را تکمیل کنید.");
            return;
        }

        const effectiveHours = shifts * hoursPerShift * accessibilityFactor;
        const plantTph = dailyCapacity / effectiveHours;

        let current_psd_sizes, current_psd_percents;

        if (startFromIndex === 0) {
            current_psd_sizes = initialFeedData.map(p => p.size);
            current_psd_percents = initialFeedData.map(p => p.percent);
        } else {
            const prevStagePsd = stagesData[startFromIndex - 1].psdSummary.productPSD;
            current_psd_sizes = prevStagePsd.map(p => p.x);
            current_psd_percents = prevStagePsd.map(p => p.y);
        }

        for (let i = startFromIndex; i < stagesData.length; i++) {
            const stage = stagesData[i];

            const current_f80 = interpolateXfromY(current_psd_sizes, current_psd_percents, 80);
            const current_f100 = Math.max(...current_psd_sizes);

            const css = stage['گلوگاه (mm)'];
            const p80_current = css; // Simplified assumption
            const reductionRatio = current_f80 / p80_current;
            const specificPower = calculateSpecificPower(wi, current_f80, p80_current);
            const correctedPower = calculateCorrectedPower(specificPower, plantTph, stage.crusherType);

            const gaudin_a = stage.crusherType === 'jaw' ? 0.88 : 0.87;
            const k = p80_current / Math.pow(0.8, 1 / gaudin_a);
            const p100_current = k;

            const percentPassingCSS = interpolateYfromX(current_psd_sizes, current_psd_percents, css) || 0;
            const actualCrusherTph = plantTph * (1 - percentPassingCSS / 100);

            // Update stage data
            stage['مرحله'] = `${i === 0 ? 'خردایش اولیه' : 'مرحله ' + (i+1)} (${stage.crusherType})`;
            stage['F80 ورودی (mm)'] = current_f80;
            stage['P80 خروجی (mm)'] = p80_current;
            stage['نسبت خردایش'] = reductionRatio;
            stage['نوع مدار'] = 'باز'; // simplified for now
            stage['توان (kWh/t)'] = specificPower;
            stage['توان موتور (kW)'] = correctedPower;
            stage['دهانه (mm)'] = current_f100 / 0.85;
            stage['ظرفیت ورودی (tph)'] = actualCrusherTph;
            stage['ظرفیت ورودی (m3/h)'] = actualCrusherTph / bulkDensity;
            stage.massBalance = {
                feedToStageTph: plantTph,
                screenBypassTph: plantTph * (percentPassingCSS / 100),
                crusherFeedTph: actualCrusherTph,
                productTph: plantTph,
            };
            stage.psdSummary = {
                F100: current_f100, F80: current_f80, P80: p80_current, P100: p100_current,
                percentBypass: percentPassingCSS,
                productPSD: generateGaudinPSD(p80_current, gaudin_a)
            };

            // Prepare for next iteration
            const next_psd = stage.psdSummary.productPSD;
            current_psd_sizes = next_psd.map(p => p.x);
            current_psd_percents = next_psd.map(p => p.y);
        }
        startMessage.style.display = 'none';
        tabsContainer.classList.remove('hidden');
    };

    const handleDownloadCsv = () => {
        if (stagesData.length === 0) { alert("داده‌ای برای دانلود وجود ندارد. ابتدا مدار را طراحی کنید."); return; }
        const headers = Object.keys(stagesData[0]).filter(k => !['crusherType', 'massBalance', 'psdSummary', 'id'].includes(k));
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n";
        stagesData.forEach(stage => {
            const row = headers.map(header => {
                const value = stage[header];
                return (value === null || typeof value === 'undefined') ? '' : (typeof value === 'number' ? value.toFixed(2) : `"${value}"`);
            });
            csvContent += row.join(",") + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `crusher_report_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Event Listeners ---
    addRowBtn.addEventListener('click', () => addPsdRow());
    autoDesignBtn.addEventListener('click', handleAutoDesign);
    downloadCsvBtn.addEventListener('click', handleDownloadCsv);
    tabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            tabs.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            tabPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(e.target.dataset.tab).classList.add('active');
        }
    });
    closePropertiesBtn.addEventListener('click', () => {
        propertiesPanel.classList.add('hidden');
    });

    // --- Initial Page Setup ---
    [
        { size: 50, percent: 12 }, { size: 75, percent: 26 }, { size: 100, percent: 40 },
        { size: 150, percent: 64 }, { size: 200, percent: 82 }, { size: 300, percent: 94 },
        { size: 400, percent: 100 }
    ].forEach(p => addPsdRow(p.size, p.percent));
    updateRowIndicators();
    initInteractiveSchematic();
});
