/**
 * =========================================================
 * 期刊级绘图模块 - 动态时间序列图 (支持滑动平均)
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_timeseries',
    category: 'plotting',
    name: '时间序列趋势图',
    slots: [
        // ✨ 隐患修复：时间日期通常是文本(例如2024-01-01)，必须改用 c 防止主程序误拦截
        { key: 'x', label: '时间/日期轴', type: 'single', tagType: 'c' },
        { key: 'y', label: '观测变量 Y', type: 'single', tagType: 'y' }
    ],
    extraConfigs: [
        { type: 'title', label: '📊 趋势与平滑设置' },
        window.PlotConfigBase.customTitle,
        { key: 'showRolling', label: '显示移动平均线', type: 'switch', default: true },
        { key: 'windowSize', label: '平滑窗口大小', type: 'select', options: [ {label:'3期', value:3}, {label:'5期', value:5}, {label:'7期', value:7}, {label:'12期', value:12} ], default: 7 },
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.backgroundColor,

        { type: 'title', label: '🎨 线条与标记样式' },
        { key: 'lineColor', label: '原始线颜色', type: 'color', default: '#4361ee' },
        { key: 'rollingColor', label: '平滑线颜色', type: 'color', default: '#ef4444' },
        { key: 'lineWidth', label: '线条粗细', type: 'select', options: [ {label:'1', value:1}, {label:'1.5', value:1.5}, {label:'2', value:2}, {label:'3', value:3} ], default: 1.5 },
        { key: 'showSymbol', label: '显示数据点', type: 'switch', default: false },

        { type: 'title', label: '📝 坐标轴与字体' },
        window.PlotConfigBase.customXLabel,
        window.PlotConfigBase.customYLabel,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.labelRotation,
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.titleFontSize
    ],
    validate: (vars) => vars.x && vars.y,

    run: (vars, data, config) => {
        const { x, y } = vars;
        const cleanData = MatrixUtils.cleanData(data, [x, y]).sort((a, b) => new Date(a[x]) - new Date(b[x]));
        const xData = cleanData.map(r => r[x]);
        const yData = cleanData.map(r => parseFloat(r[y]));

        const rollingData = [];
        const win = config.windowSize || 7;
        for (let i = 0; i < yData.length; i++) {
            if (i < win - 1) {
                rollingData.push(null);
            } else {
                const subset = yData.slice(i - win + 1, i + 1);
                const avg = subset.reduce((a, b) => a + b, 0) / win;
                rollingData.push(avg.toFixed(4));
            }
        }

        return { xData, yData, rollingData, xName: x, yName: y, n: cleanData.length };
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
                        text: cfg.customTitle || (this.results.yName + ' 时间序列趋势'),
                        left: 'center',
                        show: cfg.showTitle !== false,
                        textStyle: { fontFamily: cfg.fontFamily, fontSize: cfg.titleFontSize || 16 }
                    },
                    tooltip: { trigger: 'axis' },
                    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%', containLabel: true },
                    xAxis: { 
                        type: 'category', data: this.results.xData, name: cfg.customXLabel || '',
                        axisLabel: { rotate: cfg.labelRotation || 45, fontSize: cfg.axisFontSize || 12, fontFamily: cfg.fontFamily }
                    },
                    yAxis: { 
                        type: 'value', name: cfg.customYLabel || this.results.yName,
                        axisLabel: { fontSize: cfg.axisFontSize || 12, fontFamily: cfg.fontFamily }
                    },
                    series: [
                        {
                            name: '原始数据', type: 'line', data: this.results.yData,
                            lineStyle: { color: cfg.lineColor, width: cfg.lineWidth },
                            itemStyle: { color: cfg.lineColor }, showSymbol: cfg.showSymbol,
                            smooth: true
                        },
                        {
                            name: (cfg.windowSize || 7) + '期平滑',
                            type: 'line', data: this.results.rollingData,
                            lineStyle: { color: cfg.rollingColor, width: (cfg.lineWidth || 1.5) + 0.5, type: 'solid' },
                            itemStyle: { color: cfg.rollingColor }, showSymbol: false,
                            smooth: true, connectNulls: false
                        }
                    ]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `timeseries_${Date.now()}.png`;
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
                                时间序列趋势图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">时间序列趋势图编辑（点击空白处关闭）</div>
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
        const { x, y } = vars;
        return `import pandas as pd
import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['SimHei']
df = pd.read_csv("${fileName}")
df['${x}'] = pd.to_datetime(df['${x}'])
df = df.sort_values('${x}')

plt.figure(figsize=(10, 5))
plt.plot(df['${x}'], df['${y}'], label='原始数据', color='${config.lineColor}', linewidth=${config.lineWidth})
if ${config.showRolling}:
    plt.plot(df['${x}'], df['${y}'].rolling(${config.windowSize}).mean(), color='${config.rollingColor}', label='${config.windowSize}期平滑')
plt.xlabel('${config.customXLabel || x}')
plt.ylabel('${config.customYLabel || y}')
plt.title('${config.customTitle || y + "时间序列"}')
plt.legend()
plt.xticks(rotation=${config.labelRotation || 45})
plt.grid(True)
plt.tight_layout()
plt.savefig('timeseries.pdf')
plt.show()`;
    }
});