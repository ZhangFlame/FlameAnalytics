/**
 * =========================================================
 * 期刊级绘图模块 - 带拟合线的学术散点图（超详尽版）
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_scatter',
    category: 'plotting',
    name: '散点图',
    slots: [
        { key: 'y', label: 'Y 轴变量', type: 'single', tagType: 'y' },
        { key: 'x', label: 'X 轴变量', type: 'single', tagType: 'x' }
    ],
    extraConfigs: [
        { type: 'title', label: '📈 拟合设置' },
        { 
            key: 'fitType', label: '拟合类型', type: 'select', 
            options: [
                { label: '无拟合', value: 'none' },
                { label: '线性', value: 'linear' },
                { label: '二次', value: 'quadratic' },
                { label: '指数', value: 'exponential' }
            ], default: 'linear' 
        },
        
        { type: 'title', label: '📊 基础画板设置' },
        window.PlotConfigBase.customTitle,
        window.PlotConfigBase.customXLabel,
        window.PlotConfigBase.customYLabel,
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.showEquation,
        window.PlotConfigBase.backgroundColor,
        
        { type: 'title', label: '📐 网格与边框' },
        window.PlotConfigBase.showGrid,
        window.PlotConfigBase.gridColor,
        window.PlotConfigBase.gridLineType,
        window.PlotConfigBase.showBorder,
        
        { type: 'title', label: '🔵 散点样式调节' },
        { key: 'pointColor', label: '散点填充色', type: 'color', default: '#3b82f6' },
        { key: 'pointBorderColor', label: '散点边框色', type: 'color', default: '#2563eb' },
        { key: 'pointSymbol', label: '点形状', type: 'select', options: [ { label: '圆形 (Circle)', value: 'circle' }, { label: '方形 (Rect)', value: 'rect' }, { label: '圆角方形', value: 'roundRect' }, { label: '三角形 (Triangle)', value: 'triangle' }, { label: '菱形 (Diamond)', value: 'diamond' } ], default: 'circle' },
        { key: 'pointSize', label: '点大小', type: 'select', options: [ { label: '3', value: 3 }, { label: '4', value: 4 }, { label: '6', value: 6 }, { label: '8', value: 8 }, { label: '10', value: 10 }, { label: '12', value: 12 }, { label: '15', value: 15 } ], default: 6 },
        { key: 'pointOpacity', label: '填充透明度', type: 'select', options: [ { label: '0(仅线框)', value: 0 }, { label: '0.3', value: 0.3 }, { label: '0.5', value: 0.5 }, { label: '0.7', value: 0.7 }, { label: '1.0(实心)', value: 1.0 } ], default: 0.5 },
        { key: 'pointBorderWidth', label: '边框线宽', type: 'select', options: [ {label: '0(无边框)', value: 0}, {label: '1', value: 1}, {label: '1.5', value: 1.5}, {label: '2', value: 2}, {label: '3', value: 3} ], default: 1.5 },
        
        { type: 'title', label: '🔴 拟合线与文字排版' },
        { key: 'lineColor', label: '拟合线颜色', type: 'color', default: '#ef4444' },
        { key: 'lineType', label: '拟合线型', type: 'select', options: [ { label: '实线 (Solid)', value: 'solid' }, { label: '虚线 (Dashed)', value: 'dashed' }, { label: '点线 (Dotted)', value: 'dotted' } ], default: 'solid' },
        { key: 'lineWidth', label: '拟合线宽', type: 'select', options: [ { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 } ], default: 2 },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.fontWeight,
        window.PlotConfigBase.titleFontSize,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.labelRotation
    ],
    validate: (vars) => vars.y && vars.x,

    run: (vars, data, config) => {
        const { y, x } = vars;
        const cleanData = MatrixUtils.cleanData(data, [y, x]);
        const xData = cleanData.map(r => parseFloat(r[x]));
        const yData = cleanData.map(r => parseFloat(r[y]));
        const scatterPoints = cleanData.map(r => [parseFloat(r[x]), parseFloat(r[y])]);

        const fits = { 
            none: { lineData: [], equation: '', r2: '0.0000' },
            linear: { lineData: [], equation: '', r2: '0.0000' },
            quadratic: { lineData: [], equation: '', r2: '0.0000' },
            exponential: { lineData: [], equation: '', r2: '0.0000' }
        };

        const xMin = Math.min(...xData);
        const xMax = Math.max(...xData);
        const xMean = MatrixUtils.mean(xData);
        const yMean = MatrixUtils.mean(yData);

        // 1. 线性拟合
        let num = 0, den = 0;
        for (let i = 0; i < xData.length; i++) {
            num += (xData[i] - xMean) * (yData[i] - yMean);
            den += Math.pow(xData[i] - xMean, 2);
        }
        const b_lin = den === 0 ? 0 : num / den;
        const a_lin = yMean - b_lin * xMean;
        const yPred_lin = xData.map(val => b_lin * val + a_lin);
        let tss_lin = yData.reduce((acc, val) => acc + Math.pow(val - yMean, 2), 0);
        let rss_lin = yData.reduce((acc, val, i) => acc + Math.pow(val - yPred_lin[i], 2), 0);
        fits.linear = {
            lineData: [[xMin, b_lin * xMin + a_lin], [xMax, b_lin * xMax + a_lin]],
            equation: `Y = ${b_lin.toFixed(4)} X + ${a_lin.toFixed(4)}`,
            r2: (tss_lin === 0 ? 0 : (1 - rss_lin / tss_lin)).toFixed(4)
        };

        // 2. 二次拟合
        const n_pts = xData.length;
        let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumY = 0, sumXY = 0, sumX2Y = 0;
        for (let i = 0; i < n_pts; i++) {
            let xi = xData[i]; let yi = yData[i];
            let xi2 = xi * xi; let xi3 = xi2 * xi; let xi4 = xi3 * xi;
            sumX += xi; sumX2 += xi2; sumX3 += xi3; sumX4 += xi4;
            sumY += yi; sumXY += xi * yi; sumX2Y += xi2 * yi;
        }
        const det = n_pts * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);
        if (Math.abs(det) > 1e-10) {
            const a_q = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY * sumX4 - sumX2Y * sumX3) + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / det;
            const b_q = (n_pts * (sumXY * sumX4 - sumX2Y * sumX3) - sumY * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y - sumXY * sumX2)) / det;
            const c_q = (n_pts * (sumX2 * sumX2Y - sumX3 * sumXY) - sumX * (sumX * sumX2Y - sumX2 * sumXY) + sumY * (sumX * sumX3 - sumX2 * sumX2)) / det;
            let tss_q = 0, rss_q = 0;
            const yMean_q = sumY / n_pts;
            for (let i = 0; i < n_pts; i++) {
                let xi = xData[i]; let yi = yData[i];
                let yPred = a_q + b_q * xi + c_q * xi * xi;
                tss_q += (yi - yMean_q) ** 2; rss_q += (yi - yPred) ** 2;
            }
            const step = (xMax - xMin) / 50;
            let lineData_q = [];
            for (let xv = xMin; xv <= xMax; xv += step) lineData_q.push([xv, a_q + b_q * xv + c_q * xv * xv]);
            fits.quadratic = {
                lineData: lineData_q,
                equation: `Y = ${c_q.toFixed(4)} X² + ${b_q.toFixed(4)} X + ${a_q.toFixed(4)}`,
                r2: (tss_q === 0 ? 0 : 1 - rss_q / tss_q).toFixed(4)
            };
        }

        // 3. 指数拟合
        const posIndices = [];
        for (let i = 0; i < yData.length; i++) if (yData[i] > 0) posIndices.push(i);
        if (posIndices.length >= 2) {
            const logY = posIndices.map(i => Math.log(yData[i]));
            const xSub = posIndices.map(i => xData[i]);
            const xSubMean = MatrixUtils.mean(xSub);
            const logYMean = MatrixUtils.mean(logY);
            let num_e = 0, den_e = 0;
            for (let i = 0; i < xSub.length; i++) {
                num_e += (xSub[i] - xSubMean) * (logY[i] - logYMean);
                den_e += (xSub[i] - xSubMean) ** 2;
            }
            const b_e = den_e === 0 ? 0 : num_e / den_e;
            const logA = logYMean - b_e * xSubMean;
            const a_e = Math.exp(logA);
            
            let tss_e = 0, rss_e = 0;
            for (let i = 0; i < yData.length; i++) {
                tss_e += (yData[i] - yMean) ** 2;
                if (yData[i] > 0) {
                    const yPred = a_e * Math.exp(b_e * xData[i]);
                    rss_e += (yData[i] - yPred) ** 2;
                } else rss_e += (yData[i] - 0) ** 2;
            }
            const step_e = (xMax - xMin) / 50;
            let lineData_e = [];
            for (let xv = xMin; xv <= xMax; xv += step_e) lineData_e.push([xv, a_e * Math.exp(b_e * xv)]);
            fits.exponential = {
                lineData: lineData_e,
                equation: `Y = ${a_e.toFixed(4)} * exp(${b_e.toFixed(4)} X)`,
                r2: (tss_e === 0 ? 0 : 1 - rss_e / tss_e).toFixed(4)
            };
        }

        return { scatterPoints, fits, xName: x, yName: y, n: cleanData.length };
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
                const activeFit = this.results.fits[cfg.fitType || 'linear'];

                const titleConfig = {};
                if (cfg.showTitle !== false) {
                    titleConfig.text = cfg.customTitle || `散点图 (N=${this.results.n})`;
                    if (cfg.showEquation !== false && activeFit.equation) {
                        titleConfig.subtext = `拟合方程: ${activeFit.equation}  |  R² = ${activeFit.r2}`;
                    }
                    titleConfig.left = 'center'; 
                    titleConfig.textStyle = { fontFamily: cfg.fontFamily, color: '#1e293b', fontSize: cfg.titleFontSize || 16, fontWeight: cfg.fontWeight };
                    titleConfig.subtextStyle = { fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight };
                }

                const series = [
                    { 
                        type: 'scatter', name: '观测值', data: this.results.scatterPoints, 
                        symbol: cfg.pointSymbol || 'circle', symbolSize: cfg.pointSize || 6, 
                        itemStyle: { color: cfg.pointColor || '#3b82f6', borderColor: cfg.pointBorderColor || '#2563eb', borderWidth: cfg.pointBorderWidth !== undefined ? cfg.pointBorderWidth : 1.5, opacity: cfg.pointOpacity !== undefined ? cfg.pointOpacity : 0.5 } 
                    }
                ];
                
                if (activeFit.lineData && activeFit.lineData.length > 0) {
                    series.push({ 
                        type: 'line', name: '拟合线', data: activeFit.lineData, showSymbol: false, 
                        lineStyle: { color: cfg.lineColor || '#ef4444', width: cfg.lineWidth || 2, type: cfg.lineType || 'solid' } 
                    });
                }

                const option = {
                    backgroundColor: cfg.backgroundColor || '#ffffff',
                    ...(cfg.showTitle !== false ? { title: titleConfig } : {}),
                    grid: { top: cfg.showTitle !== false ? 60 : 30, bottom: 50, left: 60, right: 40, show: cfg.showBorder, borderColor: cfg.showBorder ? '#000' : 'transparent' },
                    tooltip: { trigger: 'item', textStyle: { fontFamily: cfg.fontFamily }, formatter: (params) => params.seriesType === 'scatter' ? `X: ${params.value[0]}<br/>Y: ${params.value[1]}` : '拟合线' },
                    xAxis: { 
                        name: cfg.customXLabel || this.results.xName, nameLocation: 'middle', nameGap: 30, type: 'value', 
                        nameTextStyle: { fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight, fontSize: cfg.axisFontSize || 12 },
                        splitLine: { show: cfg.showGrid, lineStyle: { type: cfg.gridLineType || 'dashed', color: cfg.gridColor || '#e5e7eb' } }, 
                        axisLine: { show: cfg.showBorder, lineStyle: { color: '#000' } }, axisTick: { show: cfg.showBorder }, 
                        axisLabel: { fontSize: cfg.axisFontSize || 12, rotate: cfg.labelRotation || 0, fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight } 
                    },
                    yAxis: { 
                        name: cfg.customYLabel || this.results.yName, type: 'value', 
                        nameTextStyle: { fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight, fontSize: cfg.axisFontSize || 12 },
                        splitLine: { show: cfg.showGrid, lineStyle: { type: cfg.gridLineType || 'dashed', color: cfg.gridColor || '#e5e7eb' } }, 
                        axisLine: { show: cfg.showBorder, lineStyle: { color: '#000' } }, axisTick: { show: cfg.showBorder }, 
                        axisLabel: { fontSize: cfg.axisFontSize || 12, fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight } 
                    },
                    series: series
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `scatter_plot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
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
                                散点图编辑
                            </button>
                        </template>
                        <div style="padding: 4px;">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #334155;">散点图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        保存 PNG
                    </button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 800px; height: 500px; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo, processingSteps) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { y, x } = vars;
        let mplLineStyle;
        switch (config.lineType) { case 'solid': mplLineStyle = '-'; break; case 'dashed': mplLineStyle = '--'; break; case 'dotted': mplLineStyle = ':'; break; default: mplLineStyle = '-'; }
        
        let code = `# ============================================\n# 学术级散点图绘制 (Python Seaborn)\n# ============================================\n\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nimport numpy as np\nfrom scipy import stats\n\n`;
        code += `plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial', 'sans-serif']\n`;
        if (config.fontFamily && config.fontFamily !== 'sans-serif') code += `plt.rcParams['font.family'] = '${config.fontFamily}'\n`;
        code += `plt.rcParams['axes.unicode_minus'] = False\n\n`;
        if (config.backgroundColor && config.backgroundColor !== '#ffffff') code += `plt.rcParams['figure.facecolor'] = '${config.backgroundColor}'\nplt.rcParams['axes.facecolor'] = '${config.backgroundColor}'\n\n`;

        code += `df = pd.read_csv("${fileName}")\n\n`;
        if (processingSteps && processingSteps.length > 0) code += `# 数据预处理\n${processingSteps.join('\n')}\n\n`;
        code += `plt.figure(figsize=(8, 6), dpi=300)\n`;
        
        const hexFill = config.pointColor ? `"#${config.pointColor.replace('#', '')}"` : '"#3b82f6"';
        const hexEdge = config.pointBorderColor ? `"#${config.pointBorderColor.replace('#', '')}"` : '"#2563eb"';
        const pSize = config.pointSize ? config.pointSize * 10 : 60;
        const pAlpha = config.pointOpacity !== undefined ? config.pointOpacity : 0.5;
        const eWidth = config.pointBorderWidth !== undefined ? config.pointBorderWidth : 1.5;
        const markerMap = { 'circle':'o', 'rect':'s', 'triangle':'^', 'diamond':'D' };
        const pMarker = markerMap[config.pointSymbol] || 'o';

        if (config.fitType === 'none') {
            code += `sns.scatterplot(x="${x}", y="${y}", data=df,\n            edgecolor=${hexEdge}, facecolor=${hexFill}, alpha=${pAlpha}, s=${pSize}, marker="${pMarker}")\n\n`;
        } else if (config.fitType === 'linear') {
            code += `sns.regplot(x="${x}", y="${y}", data=df, ci=None,\n            scatter_kws={"s": ${pSize}, "edgecolor": ${hexEdge}, "facecolor": ${hexFill}, "alpha": ${pAlpha}, "linewidths": ${eWidth}, "marker": "${pMarker}"},\n            line_kws={"color": "#${config.lineColor ? config.lineColor.replace('#', '') : 'dc2626'}", "linewidth": ${config.lineWidth || 2}, "linestyle": "${mplLineStyle}"})\n\n`;
        } else if (config.fitType === 'quadratic') {
            code += `# 二次拟合\ncoef = np.polyfit(df["${x}"], df["${y}"], 2)\npoly = np.poly1d(coef)\nx_range = np.linspace(df["${x}"].min(), df["${x}"].max(), 100)\nplt.scatter(df["${x}"], df["${y}"], s=${pSize}, c=${hexFill}, edgecolors=${hexEdge}, alpha=${pAlpha}, marker="${pMarker}")\nplt.plot(x_range, poly(x_range), color="#${config.lineColor ? config.lineColor.replace('#', '') : 'dc2626'}", linewidth=${config.lineWidth || 2}, linestyle="${mplLineStyle}")\n`;
        } else if (config.fitType === 'exponential') {
            code += `# 指数拟合 (y = a * exp(b * x))\nfrom scipy.optimize import curve_fit\ndef func(x, a, b): return a * np.exp(b * x)\npopt, pcov = curve_fit(func, df["${x}"], df["${y}"], p0=(1, 0.01))\nx_range = np.linspace(df["${x}"].min(), df["${x}"].max(), 100)\nplt.scatter(df["${x}"], df["${y}"], s=${pSize}, c=${hexFill}, edgecolors=${hexEdge}, alpha=${pAlpha}, marker="${pMarker}")\nplt.plot(x_range, func(x_range, *popt), color="#${config.lineColor ? config.lineColor.replace('#', '') : 'dc2626'}", linewidth=${config.lineWidth || 2}, linestyle="${mplLineStyle}")\n`;
        }
        
        code += `sns.despine()\n`;
        if (config.showGrid) {
            code += `plt.grid(True, linestyle='${config.gridLineType || '--'}', color='${config.gridColor || '#e5e7eb'}')\n`;
        }
        
        if (config.showTitle) {
            const titleTxt = config.customTitle || `${y} 与 ${x} 的关系散点图`;
            code += `plt.title("${titleTxt}", fontsize=${config.titleFontSize || 16}, pad=15, fontweight='${config.fontWeight || 'bold'}')\n`;
        }
        code += `plt.xlabel("${config.customXLabel || x}", fontsize=${config.axisFontSize || 12}, fontweight='${config.fontWeight || 'normal'}')\n`;
        code += `plt.ylabel("${config.customYLabel || y}", fontsize=${config.axisFontSize || 12}, fontweight='${config.fontWeight || 'normal'}')\n\n`;

        code += `plt.tight_layout()\nplt.savefig("Scatter_Plot.pdf", format='pdf', bbox_inches='tight')\nplt.show()\n`;
        return code;
    }
});