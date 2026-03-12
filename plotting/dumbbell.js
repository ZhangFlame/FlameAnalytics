/**
 * =========================================================
 * 期刊级绘图模块 - 哑铃对比图 (Dumbbell Plot)
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_dumbbell',
    category: 'plotting',
    name: '哑铃差距对比图',
    slots: [
        { key: 'category', label: '分类轴 (Y)', type: 'single', tagType: 'c' },
        { key: 'v1', label: '基准值 (Start)', type: 'single', tagType: 'x' },
        { key: 'v2', label: '对比值 (End)', type: 'single', tagType: 'y' }
    ],
    extraConfigs: [
        { type: 'title', label: '📦 核心样式设置' },
        { key: 'barWidth', label: '连接线宽度', type: 'select', options: [ {label:'2', value:2}, {label:'4', value:4}, {label:'6', value:6} ], default: 2 },
        { key: 'barColor', label: '连接线颜色', type: 'color', default: '#cbd5e1' },
        { key: 'dotSize', label: '端点大小', type: 'select', options: [ {label:'8', value:8}, {label:'10', value:10}, {label:'12', value:12} ], default: 10 },
        { key: 'v1Color', label: '基准点颜色', type: 'color', default: '#3b82f6' },
        { key: 'v2Color', label: '对比点颜色', type: 'color', default: '#ef4444' },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.customTitle,
        window.PlotConfigBase.backgroundColor
    ],
    validate: (vars) => vars.category && vars.v1 && vars.v2,

    run: (vars, data) => {
        const { category, v1, v2 } = vars;
        const cleanData = MatrixUtils.cleanData(data, [category, v1, v2]).slice(0, 15);
        const axisData = cleanData.map(r => r[category]);
        const lineData = cleanData.map(r => [parseFloat(r[v1]), parseFloat(r[v2])]);
        return { axisData, lineData, v1Name: v1, v2Name: v2 };
    },

    resultComponent: {
        props: ['results', 'extraConfigs', 'configSchema', 'variables', 'predefineColors'],
        // ✨ 优化：剥离响应式 myChart，改用 chartReady 控制 UI
        data() { return { chartReady: false }; },
        mounted() {
            if (!this.results || !this.$refs.chartRef) return;
            // ✨ 优化：直接挂载到 this._myChart 防止 Proxy 劫持
            this._myChart = window.echarts.init(this.$refs.chartRef);
            this.chartReady = true;
            this.renderChart();
            this.$watch('extraConfigs', this.renderChart, { deep: true });
            this.$watch('results', this.renderChart, { deep: true });
            // ✨ 优化：使用 ResizeObserver 精确监听 DIV 容器形变
            this._resizeObserver = new ResizeObserver(() => {
                if (this._myChart) this._myChart.resize();
            });
            this._resizeObserver.observe(this.$refs.chartRef);
        },
        // ✨ 优化：Vue 3 必须使用 unmounted，防止内存泄漏
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
                    title: { text: cfg.customTitle || '哑铃对比图', left: 'center', show: cfg.showTitle },
                    tooltip: { trigger: 'axis' },
                    grid: { left: '15%', right: '10%', containLabel: true },
                    xAxis: { type: 'value' },
                    yAxis: { type: 'category', data: this.results.axisData, axisLabel: { fontSize: cfg.axisFontSize, fontFamily: cfg.fontFamily } },
                    series: [
                        {
                            type: 'custom',
                            name: '连接线',
                            renderItem: (params, api) => {
                                const start = api.coord([this.results.lineData[params.dataIndex][0], params.dataIndex]);
                                const end = api.coord([this.results.lineData[params.dataIndex][1], params.dataIndex]);
                                return {
                                    type: 'line',
                                    shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] },
                                    style: { stroke: cfg.barColor, lineWidth: cfg.barWidth }
                                };
                            },
                            data: this.results.lineData
                        },
                        {
                            name: this.results.v1Name, type: 'scatter',
                            data: this.results.lineData.map(d => d[0]),
                            itemStyle: { color: cfg.v1Color }, symbolSize: cfg.dotSize
                        },
                        {
                            name: this.results.v2Name, type: 'scatter',
                            data: this.results.lineData.map(d => d[1]),
                            itemStyle: { color: cfg.v2Color }, symbolSize: cfg.dotSize
                        }
                    ]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `dumbbell_${Date.now()}.png`;
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
                                哑铃差距对比图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">哑铃差距对比图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">保存 PNG</button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 850px; height: 500px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { category, v1, v2 } = vars;
        return `# 哑铃图（前后对比）
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.sans-serif'] = ['SimHei']
df = pd.read_csv("${fileName}")
df = df[['${category}', '${v1}', '${v2}']].dropna().head(15)  # 取前15组

y_pos = np.arange(len(df))
plt.figure(figsize=(8, 6))
for i, row in df.iterrows():
    plt.plot([row['${v1}'], row['${v2}']], [i, i], color='${config.barColor}', linewidth=${config.barWidth})
plt.scatter(df['${v1}'], y_pos, color='${config.v1Color}', s=${config.dotSize*8}, label='${v1}')
plt.scatter(df['${v2}'], y_pos, color='${config.v2Color}', s=${config.dotSize*8}, label='${v2}')
plt.yticks(y_pos, df['${category}'])
plt.xlabel('值')
plt.title('${config.customTitle || "哑铃图"}')
plt.legend()
plt.grid(axis='x', linestyle='--', alpha=0.7)
plt.tight_layout()
plt.savefig('dumbbell.pdf')
plt.show()`;
    }
});