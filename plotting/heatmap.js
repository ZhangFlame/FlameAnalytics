/**
 * =========================================================
 * 期刊级绘图模块 - 相关系数热力图（极致细节版 & 聚类分析）
 * BY张张 | 引入超强动态排版引擎，彻底解决长文字与顶部/底部图例的重叠
 * =========================================================
 */
ModelRegistry.register({
    id: 'plot_heatmap',
    category: 'plotting',
    name: '热力图',
    slots: [
        { key: 'x', label: '分析变量 (多选)', type: 'multiple', tagType: 'x' }
    ],
    extraConfigs: [
        { type: 'title', label: '📊 相关系数设置' },
        { 
            key: 'corrMethod', label: '相关系数类型', type: 'select', 
            options: [
                { label: '皮尔森 (Pearson)', value: 'pearson' },
                { label: '斯皮尔曼 (Spearman)', value: 'spearman' },
                { label: '肯德尔 (Kendall)', value: 'kendall' }
            ], default: 'pearson' 
        },
        
        { type: 'title', label: '🧬 层次聚类分析 (Clustermap)' },
        { key: 'enableClustering', label: '开启层次聚类', type: 'switch', default: false },
        { key: 'clusterMethod', label: '聚类方法', type: 'select', options: [ {label:'ward', value:'ward'}, {label:'single', value:'single'}, {label:'complete', value:'complete'}, {label:'average', value:'average'} ], default: 'ward' },

        { type: 'title', label: '🎨 基础与配色设置' },
        { key: 'customTitle', label: '自定义主标题 (留空默认)', type: 'input', default: '' },
        window.PlotConfigBase.showTitle,
        window.PlotConfigBase.showValues,
        { key: 'maskUpper', label: '隐藏上三角阵 (聚类模式下无效)', type: 'switch', default: false },
        window.PlotConfigBase.colorScheme,
        window.PlotConfigBase.colorbarPosition,
        window.PlotConfigBase.backgroundColor,
        
        { type: 'title', label: '📐 边框与排版' },
        { key: 'borderColor', label: '格子边框色', type: 'color', default: '#ffffff' },
        { key: 'borderWidth', label: '格子边框宽', type: 'select', options: [ { label: '0(无边框)', value: 0 }, { label: '0.5', value: 0.5 }, { label: '1', value: 1 }, { label: '1.5', value: 1.5 }, { label: '2', value: 2 }, { label: '3', value: 3 } ], default: 1 },
        window.PlotConfigBase.showAxisBorder,

        { type: 'title', label: '📝 字体与标签 (全局)' },
        window.PlotConfigBase.fontFamily,
        window.PlotConfigBase.fontWeight,
        window.PlotConfigBase.titleFontSize,
        window.PlotConfigBase.axisFontSize,
        window.PlotConfigBase.valueFontSize
    ],
    validate: (vars) => vars.x && vars.x.length > 1,

    run: (vars, data, config) => {
        const { x } = vars;
        const cleanData = MatrixUtils.cleanData(data, x);
        const corrMats = {
            pearson: MatrixUtils.correlationMatrix(cleanData, x),
            spearman: MatrixUtils.spearmanCorrelationMatrix(cleanData, x),
            kendall: MatrixUtils.kendallCorrelationMatrix(cleanData, x)
        };
        return { corrMats, vars: x, n: cleanData.length };
    },

    resultComponent: {
        props: ['results', 'extraConfigs', 'configSchema', 'variables', 'predefineColors'],
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
                const colorRange = window.gradientColorMap[cfg.colorScheme] || window.gradientColorMap['RdBu'];
                const method = cfg.corrMethod || 'pearson';
                const currentMat = this.results.corrMats[method];
                let finalHeatData = [];
                for (let i = 0; i < this.results.vars.length; i++) {
                    for (let j = 0; j < this.results.vars.length; j++) {
                        if (cfg.maskUpper && !cfg.enableClustering && j > i) continue;
                        finalHeatData.push([j, i, parseFloat(currentMat[i][j].toFixed(3))]);
                    }
                }

                const isVertical = cfg.colorbarPosition === 'right' || cfg.colorbarPosition === 'left';
                
                // ✨ 终极动态排版引擎
                let gridTop = 'center';
                let gridSize = 420; // 左右分布时，方阵维持最大化
                let vmTop = 'auto';
                let vmBottom = 'auto';
                let vmLeft = 'auto';
                let vmRight = 'auto';

                if (cfg.colorbarPosition === 'top') {
                    // 当图例在顶部：主绘图区整体下移，并微微缩小腾出绝对空间
                    vmTop = cfg.showTitle !== false ? 60 : 20;
                    vmLeft = 'center';
                    gridTop = 150; 
                    gridSize = 380; 
                } else if (cfg.colorbarPosition === 'bottom') {
                    // 当图例在底部：主绘图区整体大幅上移，给倾斜的底部长文字预留高达 220px 的“真空区”
                    vmBottom = 20;
                    vmLeft = 'center';
                    gridTop = cfg.showTitle !== false ? 70 : 50; 
                    gridSize = 380; 
                } else if (cfg.colorbarPosition === 'left') {
                    vmLeft = '5%';
                    vmTop = 'center';
                } else { // right
                    vmRight = '5%';
                    vmTop = 'center';
                }
                
                const visualMapOption = {
                    min: -1, max: 1, calculable: true, precision: 2,
                    orient: isVertical ? 'vertical' : 'horizontal',
                    left: vmLeft,
                    right: vmRight,
                    top: vmTop,
                    bottom: vmBottom,
                    itemWidth: 20,   // 厚度
                    itemHeight: 300, // 长度
                    inRange: { color: colorRange },
                    textStyle: { color: '#333', fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight }
                };

                const option = {
                    backgroundColor: cfg.backgroundColor || '#ffffff',
                    ...(cfg.showTitle !== false ? {
                        title: { 
                            text: cfg.customTitle || `热力图 (N=${this.results.n})`, 
                            left: 'center', 
                            top: '2%', 
                            textStyle: { fontSize: cfg.titleFontSize || 16, fontWeight: cfg.fontWeight || 'bold', fontFamily: cfg.fontFamily, color: '#2c3e50' } 
                        }
                    } : {}),
                    tooltip: {
                        position: 'top', textStyle: { fontFamily: cfg.fontFamily },
                        formatter: (params) => `${this.results.vars[params.data[1]]} ~ ${this.results.vars[params.data[0]]}<br>相关系数: ${params.data[2].toFixed(3)}`
                    },
                    // ✨ 交给引擎接管正方形大小与位置
                    grid: { width: gridSize, height: gridSize, left: 'center', top: gridTop, containLabel: false },
                    xAxis: {
                        type: 'category', data: this.results.vars,
                        axisLabel: { interval: 0, rotate: 45, margin: 12, fontSize: cfg.axisFontSize || 11, fontWeight: cfg.fontWeight, fontFamily: cfg.fontFamily },
                        splitArea: { show: true }, axisLine: { show: cfg.showAxisBorder }, axisTick: { show: cfg.showAxisBorder }
                    },
                    yAxis: {
                        type: 'category', data: this.results.vars,
                        axisLabel: { margin: 12, fontSize: cfg.axisFontSize || 11, fontWeight: cfg.fontWeight, fontFamily: cfg.fontFamily },
                        splitArea: { show: true }, axisLine: { show: cfg.showAxisBorder }, axisTick: { show: cfg.showAxisBorder }
                    },
                    visualMap: visualMapOption,
                    series: [{
                        name: '相关系数', type: 'heatmap', data: finalHeatData,
                        label: { show: cfg.showValues, formatter: (p) => p.data[2].toFixed(2), fontSize: cfg.valueFontSize || 10, fontFamily: cfg.fontFamily, fontWeight: cfg.fontWeight || '500', color: '#1e293b', textShadowBlur: 2, textShadowColor: '#ffffff' },
                        itemStyle: { borderColor: cfg.borderColor || '#fff', borderWidth: cfg.borderWidth || 1, borderRadius: 0 }, 
                        emphasis: { itemStyle: { borderColor: '#333', borderWidth: 2 } }
                    }]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.extraConfigs.backgroundColor || '#fff' });
                link.download = `heatmap_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
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
                                热力图编辑
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #334155;">热力图编辑（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">保存 PNG</button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 850px; height: 700px; background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo, processingSteps) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { x } = vars;
        const method = config.corrMethod || 'pearson';

        let cmap;
        switch (config.colorScheme) {
            case 'RdBu': cmap = 'RdBu_r'; break;
            case 'viridis': cmap = 'viridis'; break;
            case 'RdYlGn': cmap = 'RdYlGn_r'; break;
            case 'hot': cmap = 'hot'; break;
            case 'cool': cmap = 'cool'; break;
            case 'spectral': cmap = 'Spectral_r'; break;
            case 'Blues': cmap = 'Blues'; break;
            case 'Reds': cmap = 'Reds'; break;
            case 'coolwarm': cmap = 'coolwarm'; break;
            default: cmap = 'RdBu_r';
        }

        let code = `# ============================================\n# 学术级相关系数热力图 / 聚类图\n# ============================================\n\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nimport numpy as np\n\n`;
        code += `plt.rcParams['font.sans-serif'] = ['Times New Roman', 'Microsoft YaHei', 'SimHei']\n`;
        if (config.fontFamily && config.fontFamily !== 'sans-serif') {
            code += `plt.rcParams['font.family'] = '${config.fontFamily}'\n`;
        }
        code += `plt.rcParams['axes.unicode_minus'] = False\n\n`;
        
        if (config.backgroundColor && config.backgroundColor !== '#ffffff') {
            code += `plt.rcParams['figure.facecolor'] = '${config.backgroundColor}'\n\n`;
        }

        code += `df = pd.read_csv("${fileName}")\n`;
        code += `vars_to_plot = [${x.map(v => `"${v}"`).join(', ')}]\ndf_clean = df[vars_to_plot].dropna()\n\n`;
        code += `# 计算 ${method} 相关系数\n`;
        if (method === 'pearson') code += `corr = df_clean.corr(method='pearson')\n`;
        else if (method === 'spearman') code += `corr = df_clean.corr(method='spearman')\n`;
        else if (method === 'kendall') code += `corr = df_clean.corr(method='kendall')\n`;
        
        code += `\n`;

        if (config.enableClustering) {
            code += `# 使用 sns.clustermap 绘制带有系统聚类树的热力图\n`;
            code += `cm = sns.clustermap(corr, method='${config.clusterMethod || 'ward'}', annot=${config.showValues}, fmt=".2f", cmap='${cmap}', center=0, \n            figsize=(14, 14), linewidths=${config.borderWidth || 1}, linecolor='${config.borderColor || '#ffffff'}',\n            vmin=-1, vmax=1,\n            cbar_pos=(0.02, 0.8, 0.05, 0.18) if "${config.colorbarPosition}" in ["left", "right", "top", "bottom"] else None,\n            annot_kws={"size": ${config.valueFontSize || 10}, "weight": "${config.fontWeight || 'normal'}"})\n\n`;
            
            if (config.showTitle) {
                const titleTxt = config.customTitle || `${method} 相关性矩阵与聚类分析`;
                code += `cm.fig.subplots_adjust(top=0.90)\n`;
                code += `cm.fig.suptitle('${titleTxt}', fontsize=${config.titleFontSize || 20}, y=0.95, fontweight='${config.fontWeight || 'bold'}')\n`;
            }
            code += `plt.setp(cm.ax_heatmap.get_xticklabels(), rotation=${config.labelRotation || 45}, ha='right', fontsize=${config.axisFontSize || 10})\n`;
            code += `plt.setp(cm.ax_heatmap.get_yticklabels(), fontsize=${config.axisFontSize || 10})\n`;
            code += `plt.savefig("Correlation_Clustermap.pdf", format='pdf', bbox_inches='tight')\n`;
            code += `plt.show()\n`;

        } else {
            code += `plt.figure(figsize=(10, 8), dpi=300)\n\n`;
            const maskStr = config.maskUpper ? `mask=np.triu(np.ones_like(corr, dtype=bool))` : `mask=None`;
            code += `sns.heatmap(corr, annot=${config.showValues}, fmt=".2f", cmap='${cmap}', center=0, \n            square=True, linewidths=${config.borderWidth || 1}, linecolor='${config.borderColor || '#ffffff'}',\n            vmin=-1, vmax=1,\n            cbar_kws={"shrink": 0.8, "label": "Correlation", "orientation": "${config.colorbarPosition === 'bottom' || config.colorbarPosition === 'top' ? 'horizontal' : 'vertical'}"},\n            annot_kws={"size": ${config.valueFontSize || 10}, "weight": "${config.fontWeight || 'normal'}"}, ${maskStr})\n\n`;
            
            if (config.showTitle) {
                const titleTxt = config.customTitle || `${method} 相关系数热力图`;
                code += `plt.title('${titleTxt}', fontsize=${config.titleFontSize || 18}, pad=20, fontweight='${config.fontWeight || 'bold'}')\n`;
            }
            code += `plt.xticks(rotation=${config.labelRotation || 45}, ha='right', fontsize=${config.axisFontSize || 11})\nplt.yticks(fontsize=${config.axisFontSize || 11})\nplt.tight_layout()\nplt.savefig("Correlation_Heatmap.pdf", format='pdf', bbox_inches='tight')\nplt.show()\n`;
        }
        
        return code;
    }
});