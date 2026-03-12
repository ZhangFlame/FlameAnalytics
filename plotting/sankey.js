/**
 * =========================================================
 * 期刊级绘图模块 - 桑基图（流量/能量流动）
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_sankey',
    category: 'plotting',
    name: '桑基图',
    slots: [
        // ✨ 隐患修复：桑基图节点通常为文字，必须用 tagType: 'c' 绕过强制数值校验
        { key: 'source', label: '源节点', type: 'single', tagType: 'c' },
        { key: 'target', label: '目标节点', type: 'single', tagType: 'c' },
        { key: 'weight', label: '权重/流量', type: 'single', tagType: 'm' }
    ],
    extraConfigs: [
        { type: 'title', label: '🌊 流量结构设置' },
        window.PlotConfigBase.customTitle,
        { key: 'nodeAlign', label: '节点对齐方式', type: 'select', options: [ {label:'两端对齐', value:'justify'}, {label:'左对齐', value:'left'}, {label:'右对齐', value:'right'} ], default: 'justify' },
        { key: 'nodeWidth', label: '节点宽度', type: 'select', options: [ {label:'10', value:10}, {label:'20', value:20}, {label:'30', value:30} ], default: 20 },
        { key: 'nodeGap', label: '垂直间距', type: 'select', options: [ {label:'8', value:8}, {label:'15', value:15}, {label:'25', value:25} ], default: 15 },
        
        { type: 'title', label: '🎨 视觉配色' },
        window.PlotConfigBase.categoricalTheme,
        window.PlotConfigBase.backgroundColor,

        { type: 'title', label: '📝 文字标签' },
        window.PlotConfigBase.showValues,
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.valueFontSize
    ],
    validate: (vars) => vars.source && vars.target && vars.weight,

    run: (vars, data) => {
        const { source, target, weight } = vars;
        const clean = MatrixUtils.cleanData(data, [source, target, weight]);
        const nodesSet = new Set();
        const links = [];
        clean.forEach(row => {
            const s = String(row[source]);
            const t = String(row[target]);
            const w = parseFloat(row[weight]);
            if (w > 0) {
                nodesSet.add(s); nodesSet.add(t);
                links.push({ source: s, target: t, value: w });
            }
        });
        const nodes = Array.from(nodesSet).map(name => ({ name }));
        return { nodes, links, n: clean.length };
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
                    title: { 
                        text: cfg.customTitle || '桑基图', 
                        left: 'center', textStyle: { fontFamily: cfg.fontFamily } 
                    },
                    tooltip: { trigger: 'item' },
                    series: [{
                        type: 'sankey',
                        data: this.results.nodes,
                        links: this.results.links,
                        nodeAlign: cfg.nodeAlign,
                        nodeWidth: cfg.nodeWidth,
                        nodeGap: cfg.nodeGap,
                        label: { 
                            show: true, fontSize: cfg.valueFontSize, fontFamily: cfg.fontFamily 
                        },
                        lineStyle: { color: 'source', opacity: 0.3, curveness: 0.5 },
                        itemStyle: { borderWidth: 1, borderColor: '#aaa' }
                    }]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
                link.download = `sankey_${Date.now()}.png`;
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
                                桑基图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">桑基图编辑（点击空白处关闭）</div>
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
        const { source, target, weight } = vars;
        const titleText = config.customTitle || '桑基图 (Sankey Diagram)';

        let code = `# ============================================\n`;
        code += `# 交互式桑基图 (基于 Plotly)\n`;
        code += `# ============================================\n\n`;
        
        code += `import pandas as pd\n`;
        code += `import plotly.graph_objects as go\n\n`;
        
        code += `# 1. 加载数据\n`;
        code += `df = pd.read_csv(r"${fileName}")\n`;
        code += `df_clean = df.dropna(subset=['${source}', '${target}', '${weight}'])\n\n`;

        code += `# 2. 提取所有的唯一节点并建立字典映射\n`;
        code += `all_nodes = list(pd.unique(df_clean[['${source}', '${target}']].values.ravel('K')))\n`;
        code += `node_dict = {node: i for i, node in enumerate(all_nodes)}\n\n`;

        code += `# 3. 将源节点和目标节点从文字映射为数字索引\n`;
        code += `source_indices = df_clean['${source}'].map(node_dict).tolist()\n`;
        code += `target_indices = df_clean['${target}'].map(node_dict).tolist()\n`;
        code += `values = df_clean['${weight}'].tolist()\n\n`;

        code += `# 4. 构建并绘制桑基图\n`;
        code += `fig = go.Figure(data=[go.Sankey(\n`;
        code += `    node=dict(\n`;
        code += `        pad=${config.nodeGap || 15},\n`;
        code += `        thickness=${config.nodeWidth || 20},\n`;
        code += `        line=dict(color="black", width=0.5),\n`;
        code += `        label=all_nodes\n`;
        code += `    ),\n`;
        code += `    link=dict(\n`;
        code += `        source=source_indices,\n`;
        code += `        target=target_indices,\n`;
        code += `        value=values\n`;
        code += `    )\n`;
        code += `)])\n\n`;

        code += `fig.update_layout(\n`;
        code += `    title_text="${titleText}",\n`;
        code += `    font=dict(family="${config.fontFamily || 'sans-serif'}", size=${config.valueFontSize || 12}),\n`;
        
        if (config.backgroundColor && config.backgroundColor !== '#ffffff') {
            code += `    paper_bgcolor="${config.backgroundColor}",\n`;
            code += `    plot_bgcolor="${config.backgroundColor}"\n`;
        }
        code += `)\n\n`;
        
        code += `fig.write_html("Sankey_Diagram_Interactive.html")  # 将交互式图表保存为网页\n`;
        code += `fig.show()\n`;

        return code;
    }
});