/**
 * =========================================================
 * 期刊级绘图模块 - 样本筛选漏斗图
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_funnel',
    category: 'plotting',
    name: '样本筛选漏斗图',
    slots: [
        { key: 'name', label: '阶段名称', type: 'single', tagType: 'c' },
        { key: 'value', label: '样本量 (Obs)', type: 'single', tagType: 'x' }
    ],
    extraConfigs: [
        { type: 'title', label: '🎨 视觉样式' },
        window.PlotConfigBase.categoricalTheme,
        { key: 'funnelSort', label: '排序方式', type: 'select', options: [ {label:'降序', value:'descending'}, {label:'升序', value:'ascending'}, {label:'不排序', value:'none'} ], default: 'none' },
        { key: 'gap', label: '块间距', type: 'select', options: [ {label:'0', value:0}, {label:'2', value:2}, {label:'5', value:5} ], default: 2 },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.showValues,
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.customTitle,
        window.PlotConfigBase.backgroundColor
    ],
    validate: (vars) => vars.name && vars.value,

    run: (vars, data) => {
        const { name, value } = vars;
        const cleanData = MatrixUtils.cleanData(data, [name, value]);
        const funnelData = cleanData.map(r => ({ name: String(r[name]), value: parseFloat(r[value]) }));
        return { funnelData };
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
                    color: window.themeColorMap[cfg.categoricalTheme || 'Set2'],
                    title: { text: cfg.customTitle || '样本筛选漏斗图', left: 'center', show: cfg.showTitle },
                    tooltip: { trigger: 'item', formatter: '{b} : {c}' },
                    series: [
                        {
                            name: '样本量', type: 'funnel', left: '10%', width: '80%',
                            sort: cfg.funnelSort, gap: cfg.gap,
                            label: { show: cfg.showValues, position: 'inside', fontFamily: cfg.fontFamily },
                            data: this.results.funnelData
                        }
                    ]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `funnel_${Date.now()}.png`;
                link.click();
            }
        },
        template: `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding: 20px 0;">
                <div class="plot-actions-wrapper">
                    <el-popover placement="bottom-end" :width="400" trigger="click" popper-class="plot-edit-popover">
                        <template #reference>
                            <button class="plot-action-btn btn-edit-plot">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                样本筛选漏斗图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">样本筛选漏斗图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">保存 PNG</button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 800px; height: 500px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { name, value } = vars;
        return `# 漏斗图（样本筛选）
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

df = pd.read_csv(r"${fileName}")
funnel = df.groupby('${name}')['${value}'].sum().reset_index()
if '${config.funnelSort}' == 'descending':
    funnel = funnel.sort_values('${value}', ascending=False)
elif '${config.funnelSort}' == 'ascending':
    funnel = funnel.sort_values('${value}', ascending=True)

stages = funnel['${name}'].tolist()
values = funnel['${value}'].tolist()
y_pos = np.arange(len(stages))
widths = np.array(values) / float(max(values)) * 0.8

plt.figure(figsize=(8,5))
colors = plt.cm.${config.categoricalTheme || 'Blues'}(np.linspace(0.4, 0.8, len(stages)))
for i, (stage, val, w, color) in enumerate(zip(stages, values, widths, colors)):
    left = (1 - w) / 2
    plt.barh(i, w, left=left, height=0.6, color=color, edgecolor='black')
    plt.text(0.5, i, f'{val}', ha='center', va='center', fontweight='bold', color='white')

plt.yticks(y_pos, stages)
plt.xlabel('比例')
plt.title('${config.customTitle || "样本筛选漏斗图"}')
plt.xlim(0, 1)
plt.gca().invert_yaxis()
plt.tight_layout()
plt.savefig('funnel.pdf')
plt.show()`;
    }
});