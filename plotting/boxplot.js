/**
 * =========================================================
 * 期刊级绘图模块 - 分组分布箱线图（加入异常值判定与分组色系）
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_boxplot',
    category: 'plotting',
    name: '箱线图',
    slots: [
        { key: 'y', label: '目标变量 Y', type: 'single', tagType: 'y' }
    ],
    extraConfigs: [
        { type: 'title', label: '📊 分组设置' },
        { key: 'groupVar', label: '分组对比变量', type: 'select', optional: true },
        
        { type: 'title', label: '📊 基础设置' },
        window.PlotConfigBase.customTitle,
        window.PlotConfigBase.customXLabel,
        window.PlotConfigBase.customYLabel,
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.backgroundColor,
        
        { type: 'title', label: '📐 网格与边框' },
        window.PlotConfigBase.showGrid,
        window.PlotConfigBase.gridColor,
        window.PlotConfigBase.gridLineType,
        window.PlotConfigBase.showBorder,
        
        { type: 'title', label: '📦 箱体外形与颜色' },
        window.PlotConfigBase.categoricalTheme,
        { key: 'boxColor', label: '单变量箱体主色', type: 'color', default: '#4361ee' },
        { key: 'boxWidth', label: '箱体宽度', type: 'select', options: [ { label: '20', value: 20 }, { label: '30', value: 30 }, { label: '40', value: 40 }, { label: '50', value: 50 }, { label: '60', value: 60 } ], default: 30 },
        { key: 'borderColor', label: '边缘颜色', type: 'color', default: '#333333' },
        { key: 'borderType', label: '外框线型', type: 'select', options: [ { label: '实线 (Solid)', value: 'solid' }, { label: '虚线 (Dashed)', value: 'dashed' }, { label: '点线 (Dotted)', value: 'dotted' } ], default: 'solid' },
        
        { type: 'title', label: '➖ 须线与异常值' },
        { key: 'whiskerColor', label: '须线颜色', type: 'color', default: '#333333' },
        { key: 'whiskerWidth', label: '须线宽度', type: 'select', options: [ { label: '1', value: 1 }, { label: '1.5', value: 1.5 }, { label: '2', value: 2 }, { label: '3', value: 3 } ], default: 1.5 },
        { key: 'showOutliers', label: '独立显示异常值', type: 'switch', default: true },
        { key: 'outlierColor', label: '异常值散点色', type: 'color', default: '#ef4444' },
        
        { type: 'title', label: '📝 字体与标签 (全局)' },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.fontWeight,
        window.PlotConfigBase.titleFontSize,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.labelRotation
    ],
    validate: (vars) => vars.y,

    run: (vars, data, config) => {
        const { y } = vars;
        const cleanData = data.filter(row => row[y] !== null && row[y] !== '' && !isNaN(parseFloat(row[y])));
        return { fullData: cleanData, yName: y, n: cleanData.length };
    },

    resultComponent: {
        props: ['results', 'extraConfigs', 'configSchema', 'variables', 'predefineColors'],
        // ✨ 统一防抖防错升级
        data() { return { chartReady: false }; },
        mounted() {
            if (!this.results || !this.$refs.chartRef) return;
            this._myChart = window.echarts.init(this.$refs.chartRef);
            this.chartReady = true;
            this.renderChart();
            this.$watch('extraConfigs', this.renderChart, { deep: true });
            this.$watch('results', this.renderChart, { deep: true });
            this._resizeObserver = new ResizeObserver(() => {
                if (this._myChart) this._myChart.resize();
            });
            this._resizeObserver.observe(this.$refs.chartRef);
        },
        unmounted() {
            if (this._resizeObserver) this._resizeObserver.disconnect();
            if (this._myChart) { this._myChart.dispose(); this._myChart = null; }
        },
        methods: {
            renderChart() {
                if (!this._myChart || !this.results) return;
                const cfg = this.extraConfigs;
                const groupVar = cfg.groupVar;

                const getBoxDataWithOutliers = (arr, showOutliers) => {
                    if (arr.length === 0) return { box: [0, 0, 0, 0, 0], outliers: [] };
                    const sorted = [...arr].sort((a, b) => a - b);
                    const q1 = sorted[Math.floor(sorted.length * 0.25)];
                    const med = sorted[Math.floor(sorted.length * 0.5)];
                    const q3 = sorted[Math.floor(sorted.length * 0.75)];
                    
                    if (!showOutliers) {
                        return { box: [sorted[0], q1, med, q3, sorted[sorted.length - 1]], outliers: [] };
                    }

                    const iqr = q3 - q1;
                    const lowBound = q1 - 1.5 * iqr;
                    const upBound = q3 + 1.5 * iqr;
                    
                    let minIdx = 0, maxIdx = sorted.length - 1;
                    while (minIdx < sorted.length && sorted[minIdx] < lowBound) minIdx++;
                    while (maxIdx >= 0 && sorted[maxIdx] > upBound) maxIdx--;
                    
                    const whiskerLow = sorted[minIdx] !== undefined ? sorted[minIdx] : q1;
                    const whiskerHigh = sorted[maxIdx] !== undefined ? sorted[maxIdx] : q3;
                    
                    const outliers = [];
                    for(let i=0; i<minIdx; i++) outliers.push(sorted[i]);
                    for(let i=maxIdx+1; i<sorted.length; i++) outliers.push(sorted[i]);
                    
                    return { box: [whiskerLow, q1, med, q3, whiskerHigh], outliers: outliers };
                };

                let boxData = [], axisData = [], scatterData = [];

                if (groupVar) {
                    const groups = {};
                    this.results.fullData.forEach(row => {
                        const gVal = row[groupVar];
                        if (gVal === null || gVal === '' || gVal === undefined) return;
                        const groupKey = String(gVal);
                        const val = parseFloat(row[this.results.yName]);
                        if (!isNaN(val)) { if (!groups[groupKey]) groups[groupKey] = []; groups[groupKey].push(val); }
                    });
                    const validGroups = Object.keys(groups).filter(g => groups[g].length >= 5);
                    axisData = validGroups.slice(0, 20); 
                    
                    axisData.forEach((g, idx) => {
                        const res = getBoxDataWithOutliers(groups[g], cfg.showOutliers !== false);
                        boxData.push(res.box);
                        res.outliers.forEach(outVal => scatterData.push([idx, outVal])); 
                    });
                } else {
                    const values = this.results.fullData.map(row => parseFloat(row[this.results.yName]));
                    axisData = ['全样本'];
                    const res = getBoxDataWithOutliers(values, cfg.showOutliers !== false);
                    boxData = [res.box];
                    res.outliers.forEach(outVal => scatterData.push([0, outVal]));
                }

                const titleText = cfg.customTitle ? cfg.customTitle : (groupVar ? `${this.results.yName} 的分组箱线图` : `${this.results.yName} 的箱线图`);

                let colors = [];
                if (groupVar && cfg.categoricalTheme) {
                    colors = window.themeColorMap[cfg.categoricalTheme] || window.themeColorMap['Set2'];
                }

                const option = {
                    backgroundColor: cfg.backgroundColor || '#ffffff',
                    ...(cfg.showTitle !== false ? { title: { text: titleText, left: 'center', textStyle: { fontSize: cfg.titleFontSize || 16, fontWeight: cfg.fontWeight || 'normal', fontFamily: cfg.fontFamily } } } : {}),
                    tooltip: { trigger: 'item', textStyle: { fontFamily: cfg.fontFamily } },
                    grid: { left: '10%', right: '8%', bottom: '12%', top: cfg.showTitle !== false ? '15%' : '8%', containLabel: true, show: cfg.showBorder, borderColor: cfg.showBorder ? '#000' : 'transparent' },
                    xAxis: { 
                        type: 'category', data: axisData, 
                        name: cfg.customXLabel || groupVar || '', nameLocation: 'middle', nameGap: 30, 
                        nameTextStyle: { fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight, fontSize: cfg.axisFontSize || 12 },
                        axisLabel: { rotate: cfg.labelRotation || (axisData.length > 5 ? 30 : 0), interval: 0, fontSize: cfg.axisFontSize || 12, fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight }, 
                        axisLine: { show: cfg.showBorder }, axisTick: { show: cfg.showBorder }, splitLine: { show: false } 
                    },
                    yAxis: { 
                        type: 'value', name: cfg.customYLabel || this.results.yName, 
                        nameTextStyle: { fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight, fontSize: cfg.axisFontSize || 12 },
                        splitLine: { show: cfg.showGrid, lineStyle: { type: cfg.gridLineType || 'dashed', color: cfg.gridColor || '#e5e7eb' } }, 
                        axisLine: { show: cfg.showBorder }, axisTick: { show: cfg.showBorder }, 
                        axisLabel: { fontSize: cfg.axisFontSize || 12, fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight } 
                    },
                    series: [
                        { 
                            name: '箱线图', type: 'boxplot', data: boxData, boxWidth: cfg.boxWidth || 30, 
                            itemStyle: { 
                                color: (params) => {
                                    if (groupVar && colors.length > 0) {
                                        return colors[params.dataIndex % colors.length];
                                    }
                                    return cfg.boxColor || '#4361ee';
                                },
                                borderColor: cfg.borderColor || '#333', 
                                borderWidth: 1.5, 
                                borderType: cfg.borderType || 'solid', 
                                borderRadius: 2 
                            }, 
                            lineStyle: { color: cfg.whiskerColor || '#333', width: cfg.whiskerWidth || 1.5, type: cfg.borderType || 'solid' } 
                        },
                        {
                            name: '异常值', type: 'scatter', data: scatterData,
                            itemStyle: { color: cfg.outlierColor || '#ef4444', opacity: 0.8 }, symbolSize: 5
                        }
                    ]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `boxplot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
                link.click();
            }
        },
        template: `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding: 20px 0;">
                <div class="plot-actions-wrapper">
                    <el-popover placement="bottom-end" :width="500" trigger="click" popper-class="plot-edit-popover">
                        <template #reference>
                            <button class="plot-action-btn btn-edit-plot">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                箱线图编辑
                            </button>
                        </template>
                        <div style="padding: 4px;">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #334155;">箱线图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        保存 PNG
                    </button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 800px; height: 450px; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                <div style="margin-top: 15px; font-size: 13px; color: #64748b; text-align: center;">方盒上下边界代表 25% 和 75% 分位数，中间的线是中位数。</div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { y } = vars;
        const groupVar = config.groupVar;

        let code = `# ============================================\n# 学术箱线图 (支持分组对比与异常值)\n# ============================================\n\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n\n`;
        code += `plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial', 'sans-serif']\n`;
        if (config.fontFamily && config.fontFamily !== 'sans-serif') code += `plt.rcParams['font.family'] = '${config.fontFamily}'\n`;
        code += `plt.rcParams['axes.unicode_minus'] = False\n\n`;
        if (config.backgroundColor && config.backgroundColor !== '#ffffff') code += `plt.rcParams['figure.facecolor'] = '${config.backgroundColor}'\nplt.rcParams['axes.facecolor'] = '${config.backgroundColor}'\n\n`;

        code += `df = pd.read_csv("${fileName}")\n\n`;
        if (groupVar) code += `df["${groupVar}"] = df["${groupVar}"].astype(str)\n`;
        code += `df_clean = df.dropna(subset=[${groupVar ? `"${groupVar}", ` : ''}"${y}"])\n\nplt.figure(figsize=(10, 6), dpi=300)\n`;
        
        const fliersize = config.showOutliers === false ? 0 : 3;
        const flierColor = config.outlierColor ? `"#${config.outlierColor.replace('#','')}"` : '"#ef4444"';
        const flierprops = `flierprops={"marker": "o", "markerfacecolor": ${flierColor}, "markeredgecolor": "none", "markersize": ${fliersize}}`;

        if (groupVar) {
            code += `sns.boxplot(x="${groupVar}", y="${y}", data=df_clean, palette="${config.categoricalTheme || 'Set2'}", width=${config.boxWidth / 100 || 0.3}, linewidth=${config.whiskerWidth || 1.5}, ${flierprops})\n`;
        } else {
            code += `sns.boxplot(y=df_clean["${y}"], color="${config.boxColor || '#93c5fd'}", width=${config.boxWidth / 100 || 0.3}, linewidth=${config.whiskerWidth || 1.5}, ${flierprops})\n`;
        }
        
        if (config.showGrid) {
            code += `plt.grid(axis='y', linestyle='${config.gridLineType || '--'}', color='${config.gridColor || '#e5e7eb'}')\n`;
        }
        code += `sns.despine()\n`;

        if (config.showTitle) {
            const titleTxt = config.customTitle || (groupVar ? `${groupVar} 分组下的 ${y} 分布对比` : `全样本 ${y} 的分布箱线图`);
            code += `plt.title("${titleTxt}", fontsize=${config.titleFontSize || 16}, pad=15, fontweight='${config.fontWeight || 'bold'}')\n`;
        }
        if (config.customXLabel || groupVar) code += `plt.xlabel("${config.customXLabel || groupVar || ''}", fontsize=${config.axisFontSize || 12}, fontweight='${config.fontWeight || 'normal'}')\n`;
        if (config.customYLabel || y) code += `plt.ylabel("${config.customYLabel || y}", fontsize=${config.axisFontSize || 12}, fontweight='${config.fontWeight || 'normal'}')\n`;

        code += `plt.tight_layout()\nplt.savefig("Distribution_Boxplot.pdf", format='pdf', bbox_inches='tight')\nplt.show()\n`;
        return code;
    }
});