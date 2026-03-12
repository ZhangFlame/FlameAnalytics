/**
 * =========================================================
 * 期刊级绘图模块 - 火山图 (Volcano Plot)
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_volcano',
    category: 'plotting',
    name: '火山图',
    slots: [
        { key: 'fc', label: '影响倍数 (LogFC)', type: 'single', tagType: 'x' },
        { key: 'p', label: '显著性 (P-Value)', type: 'single', tagType: 'y' }
    ],
    extraConfigs: [
        { type: 'title', label: '🎯 阈值判定设置' },
        { key: 'pThreshold', label: 'P值显著阈值', type: 'select', options: [ {label:'0.01', value:0.01}, {label:'0.05', value:0.05}, {label:'0.1', value:0.1} ], default: 0.05 },
        { key: 'fcThreshold', label: 'FC判定阈值', type: 'select', options: [ {label:'0.5', value:0.5}, {label:'1.0', value:1}, {label:'1.5', value:1.5}, {label:'2.0', value:2} ], default: 1 },
        
        { type: 'title', label: '🎨 颜色方案' },
        { key: 'upColor', label: '显著上调色', type: 'color', default: '#ef4444' },
        { key: 'downColor', label: '显著下调色', type: 'color', default: '#22c55e' },
        { key: 'nsColor', label: '不显著颜色', type: 'color', default: '#94a3b8' },
        window.PlotConfigBase.backgroundColor,

        { type: 'title', label: '📐 坐标轴与文字' },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.titleFontSize,
        window.PlotConfigBase.showGrid,
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.customTitle
    ],
    validate: (vars) => vars.fc && vars.p,

    run: (vars, data, config) => {
        const { fc, p } = vars;
        const pThr = config.pThreshold || 0.05;
        const fcThr = config.fcThreshold || 1;
        
        const cleanData = MatrixUtils.cleanData(data, [fc, p]);
        const points = cleanData.map(r => {
            const xVal = parseFloat(r[fc]);
            const yVal = -Math.log10(parseFloat(r[p])); 
            let category = 'NS';
            if (parseFloat(r[p]) < pThr) {
                if (xVal > fcThr) category = 'Up';
                if (xVal < -fcThr) category = 'Down';
            }
            return [xVal, yVal, category];
        });

        return { points, pThr: -Math.log10(pThr), fcThr, n: cleanData.length };
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
                const seriesData = {
                    'Up': this.results.points.filter(p => p[2] === 'Up'),
                    'Down': this.results.points.filter(p => p[2] === 'Down'),
                    'NS': this.results.points.filter(p => p[2] === 'NS')
                };

                const option = {
                    backgroundColor: cfg.backgroundColor || '#ffffff',
                    title: { 
                        text: cfg.customTitle || '火山图', 
                        left: 'center', 
                        show: cfg.showTitle !== false,
                        textStyle: { fontFamily: cfg.fontFamily, fontSize: cfg.titleFontSize || 16 }
                    },
                    tooltip: { trigger: 'item', formatter: (p) => `LogFC: ${p.value[0]}<br>-log10(p): ${p.value[1]}` },
                    xAxis: { 
                        name: 'Log2 Fold Change', 
                        splitLine: { show: cfg.showGrid }, 
                        axisLabel: { fontSize: cfg.axisFontSize, fontFamily: cfg.fontFamily } 
                    },
                    yAxis: { 
                        name: '-log10(P-value)', 
                        splitLine: { show: cfg.showGrid }, 
                        axisLabel: { fontSize: cfg.axisFontSize, fontFamily: cfg.fontFamily } 
                    },
                    series: [
                        { name: '上调', type: 'scatter', data: seriesData.Up, itemStyle: { color: cfg.upColor }, symbolSize: 6 },
                        { name: '下调', type: 'scatter', data: seriesData.Down, itemStyle: { color: cfg.downColor }, symbolSize: 6 },
                        { name: '不显著', type: 'scatter', data: seriesData.NS, itemStyle: { color: cfg.nsColor, opacity: 0.4 }, symbolSize: 4 }
                    ]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `volcano_${Date.now()}.png`;
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
                                火山图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">火山图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">保存 PNG</button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 850px; height: 550px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { fc, p } = vars;
        return `# 火山图
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

df = pd.read_csv("${fileName}")
df['logp'] = -np.log10(df['${p}'])
p_thr = ${config.pThreshold}
fc_thr = ${config.fcThreshold}

df['sig'] = 'NS'
df.loc[(df['${p}'] < p_thr) & (df['${fc}'] > fc_thr), 'sig'] = 'Up'
df.loc[(df['${p}'] < p_thr) & (df['${fc}'] < -fc_thr), 'sig'] = 'Down'

colors = {'Up': '${config.upColor}', 'Down': '${config.downColor}', 'NS': '${config.nsColor}'}
plt.figure(figsize=(8,6))
for sig, color in colors.items():
    subset = df[df['sig'] == sig]
    plt.scatter(subset['${fc}'], subset['logp'], c=color, label=sig, alpha=0.6, s=20)

plt.axhline(y=-np.log10(p_thr), color='gray', linestyle='--', linewidth=1)
plt.axvline(x=fc_thr, color='gray', linestyle='--', linewidth=1)
plt.axvline(x=-fc_thr, color='gray', linestyle='--', linewidth=1)
plt.xlabel('Log2 Fold Change')
plt.ylabel('-log10(P-value)')
plt.title('${config.customTitle || "火山图"}')
plt.legend()
plt.grid(${config.showGrid})
plt.tight_layout()
plt.savefig('volcano.pdf')
plt.show()`;
    }
});