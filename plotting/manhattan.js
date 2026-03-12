/**
 * =========================================================
 * 期刊级绘图模块 - 曼哈顿图（GWAS结果可视化）
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_manhattan',
    category: 'plotting',
    name: '曼哈顿图',
    slots: [
        { key: 'chr', label: '染色体列', type: 'single', tagType: 'c' },
        { key: 'pos', label: '基因位置', type: 'single', tagType: 'x' },
        { key: 'pval', label: 'p值列', type: 'single', tagType: 'y' }
    ],
    extraConfigs: [
        { type: 'title', label: '🎯 显著性与标题设置' },
        window.PlotConfigBase.customTitle,
        { key: 'sigLine', label: '显著性阈值(-log10)', type: 'select', options: [ {label:'5', value:5}, {label:'6', value:6}, {label:'7', value:7}, {label:'8', value:8} ], default: 7 },
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.backgroundColor,

        { type: 'title', label: '🎨 染色体配色方案' },
        { key: 'colorPerChr', label: '奇数染色体色', type: 'color', default: '#3b82f6' },
        { key: 'colorAlt', label: '偶数染色体色', type: 'color', default: '#94a3b8' },
        { key: 'pointSize', label: '散点大小', type: 'select', options: [ {label:'2', value:2}, {label:'3', value:3}, {label:'5', value:5} ], default: 3 },
        
        { type: 'title', label: '📝 字体与排版' },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.titleFontSize,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.showGrid
    ],
    validate: (vars) => vars.chr && vars.pos && vars.pval,

    run: (vars, data) => {
        const { chr, pos, pval } = vars;
        const clean = MatrixUtils.cleanData(data, [chr, pos, pval]);
        const groups = {};
        clean.forEach(row => {
            const c = String(row[chr]);
            if (!groups[c]) groups[c] = [];
            groups[c].push({ pos: parseFloat(row[pos]), logp: -Math.log10(parseFloat(row[pval])) });
        });

        let xOffset = 0;
        const seriesData = [];
        const xAxisLabels = [];
        const tickPositions = [];

        Object.keys(groups).sort((a,b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
            return numA - numB;
        }).forEach((chrName, idx) => {
            const points = groups[chrName].sort((a,b) => a.pos - b.pos);
            const startX = xOffset;
            points.forEach(p => {
                seriesData.push({
                    value: [xOffset + p.pos, p.logp],
                    chr: chrName,
                    colorIdx: idx % 2
                });
            });
            const endX = points.length ? points[points.length-1].pos : 0;
            tickPositions.push(startX + endX / 2);
            xAxisLabels.push(chrName);
            xOffset += endX + 1000000; 
        });
        return { seriesData, xAxisLabels, tickPositions, n: clean.length };
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
                const option = {
                    backgroundColor: cfg.backgroundColor || '#ffffff',
                    title: { 
                        text: cfg.customTitle || '曼哈顿图', 
                        left: 'center', textStyle: { fontFamily: cfg.fontFamily, fontSize: cfg.titleFontSize } 
                    },
                    tooltip: { 
                        formatter: (p) => `染色体: ${p.data.chr}<br/>-log10(p): ${p.value[1].toFixed(3)}` 
                    },
                    grid: { bottom: '15%', containLabel: true },
                    xAxis: {
                        type: 'value',
                        splitLine: { show: false },
                        axisLabel: {
                            formatter: (val) => {
                                const idx = this.results.tickPositions.findIndex(pos => Math.abs(pos - val) < 500000);
                                return idx !== -1 ? this.results.xAxisLabels[idx] : '';
                            },
                            interval: 0, fontSize: cfg.axisFontSize, fontFamily: cfg.fontFamily
                        }
                    },
                    yAxis: { name: '-log10(p)', splitLine: { show: cfg.showGrid } },
                    series: [{
                        type: 'scatter',
                        data: this.results.seriesData,
                        symbolSize: cfg.pointSize || 3,
                        itemStyle: {
                            color: (p) => p.data.colorIdx === 0 ? cfg.colorPerChr : cfg.colorAlt
                        },
                        markLine: {
                            silent: true,
                            symbol: 'none',
                            data: [{ yAxis: cfg.sigLine, label: { formatter: '显著性阈值', position: 'end' } }],
                            lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 }
                        }
                    }]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
                link.download = `manhattan_${Date.now()}.png`;
                link.click();
            }
        },
        template: `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding: 20px 0;">
                <div class="plot-actions-wrapper">
                    <el-popover placement="bottom-end" :width="500" trigger="click" popper-class="plot-edit-popover">
                        <template #reference>
                            <button class="plot-action-btn btn-edit-plot">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path></svg>
                                曼哈顿图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">曼哈顿图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">保存图片</button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 900px; height: 500px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { chr, pos, pval } = vars;
        
        const titleText = config.customTitle || '曼哈顿图 (Manhattan Plot)';
        const sigLine = config.sigLine || 7;
        const color1 = config.colorPerChr || '#3b82f6';
        const color2 = config.colorAlt || '#94a3b8';
        const pointSize = (config.pointSize || 3) * 5; 

        let code = `# ============================================\n`;
        code += `# 学术级曼哈顿图绘制 (GWAS Manhattan Plot)\n`;
        code += `# ============================================\n\n`;

        code += `import pandas as pd\n`;
        code += `import numpy as np\n`;
        code += `import matplotlib.pyplot as plt\n\n`;

        code += `plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial', 'sans-serif']\n`;
        if (config.fontFamily && config.fontFamily !== 'sans-serif') {
            code += `plt.rcParams['font.family'] = '${config.fontFamily}'\n`;
        }
        code += `plt.rcParams['axes.unicode_minus'] = False\n\n`;

        if (config.backgroundColor && config.backgroundColor !== '#ffffff') {
            code += `plt.rcParams['figure.facecolor'] = '${config.backgroundColor}'\n`;
            code += `plt.rcParams['axes.facecolor'] = '${config.backgroundColor}'\n\n`;
        }

        code += `# 1. 读取并清洗数据\n`;
        code += `df = pd.read_csv(r"${fileName}")\n`;
        code += `df = df.dropna(subset=['${chr}', '${pos}', '${pval}'])\n\n`;

        code += `# 尝试将染色体列转为数值以便正确排序\n`;
        code += `try:\n`;
        code += `    df['${chr}'] = pd.to_numeric(df['${chr}'])\n`;
        code += `except:\n`;
        code += `    df['${chr}'] = df['${chr}'].astype(str)\n\n`;

        code += `df = df.sort_values(by=['${chr}', '${pos}'])\n`;
        code += `df['-log10(p)'] = -np.log10(df['${pval}'])\n\n`;

        code += `# 2. 计算连续的X轴坐标 (将各染色体首尾相接)\n`;
        code += `df['cumulative_pos'] = 0.0\n`;
        code += `current_offset = 0.0\n`;
        code += `ticks = []\n`;
        code += `labels = []\n\n`;

        code += `for chr_name, group in df.groupby('${chr}', sort=False):\n`;
        code += `    max_pos = group['${pos}'].max()\n`;
        code += `    df.loc[group.index, 'cumulative_pos'] = group['${pos}'] + current_offset\n`;
        code += `    ticks.append(current_offset + max_pos / 2)\n`;
        code += `    labels.append(str(chr_name))\n`;
        code += `    current_offset += max_pos + 1000000  # 在不同染色体之间添加间隙\n\n`;

        code += `# 3. 绘制图表\n`;
        code += `plt.figure(figsize=(14, 6), dpi=300)\n`;
        code += `unique_chrs = df['${chr}'].unique()\n\n`;

        code += `for i, chr_name in enumerate(unique_chrs):\n`;
        code += `    group = df[df['${chr}'] == chr_name]\n`;
        code += `    color = '${color1}' if i % 2 == 0 else '${color2}'\n`;
        code += `    plt.scatter(group['cumulative_pos'], group['-log10(p)'], color=color, s=${pointSize}, alpha=0.8)\n\n`;

        code += `# 添加显著性阈值线\n`;
        code += `plt.axhline(y=${sigLine}, color='#ef4444', linestyle='--', linewidth=1.5, label=f'显著性阈值 (-log10p={sigLine})')\n\n`;

        code += `plt.xticks(ticks, labels, rotation=45, fontsize=${config.axisFontSize || 12})\n`;
        code += `plt.xlabel('染色体 (Chromosome)', fontsize=${config.axisFontSize || 12})\n`;
        code += `plt.ylabel('-log10(p 值)', fontsize=${config.axisFontSize || 12})\n`;
        
        if (config.showTitle !== false) {
            code += `plt.title('${titleText}', fontsize=${config.titleFontSize || 16}, pad=15, fontweight='${config.fontWeight || 'bold'}')\n`;
        }
        
        if (config.showGrid) {
            code += `plt.grid(axis='y', linestyle='--', alpha=0.5)\n`;
        }
        
        code += `plt.legend()\n`;
        code += `plt.tight_layout()\n`;
        code += `plt.savefig("Manhattan_Plot.png", bbox_inches='tight')\n`;
        code += `plt.show()\n`;

        return code;
    }
});