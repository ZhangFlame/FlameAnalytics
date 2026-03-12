/**
 * =========================================================
 * 期刊级绘图模块 - 中国行政区划地图热力图 (抗形变完美版)
 * BY张张 | 彻底解决小屏/全屏/拖拽导致的图表重置与变形问题
 * =========================================================
 */

ModelRegistry.register({
    id: 'plot_map_china',
    category: 'plotting',
    name: '中国行政区热力地图',
    slots: [
        { key: 'province', label: '省份/地区列', type: 'single', tagType: 'c' },
        { key: 'value', label: '观测数值', type: 'single', tagType: 'm' } 
    ],
    extraConfigs: [
        { type: 'title', label: '📊 地图数据与数值上限' },
        window.PlotConfigBase.customTitle,
        { key: 'subTitle', label: '副标题 (单位等说明)', type: 'input', default: '数据来源：统计数据' },
        { key: 'maxVal', label: '视觉映射最大值', type: 'select', options: [ {label:'100', value:100}, {label:'1000', value:1000}, {label:'10000', value:10000}, {label:'100000', value:100000}, {label:'150000', value:150000} ], default: 15000 },
        
        { type: 'title', label: '🎨 颜色主题色系' },
        { key: 'colorTheme', label: '热力颜色基调', type: 'select', options: [ {label:'红底 (Red)', value:'red'}, {label:'蓝底 (Blue)', value:'blue'}, {label:'绿底 (Green)', value:'green'}, {label:'紫底 (Purple)', value:'purple'} ], default: 'red' },
        
        { type: 'title', label: '📝 字体与排版' },
        window.PlotConfigBase.titleFontSize,
        { key: 'valueFontSize', label: '数据标签字体', type: 'select', options: [ {label:'8px', value:8}, {label:'10px', value:10}, {label:'12px', value:12} ], default: 10 },
        { key: 'useShortName', label: '使用简称(防重叠)', type: 'switch', default: true }
    ],
    validate: (vars) => vars.province && vars.value,

    run: (vars, data) => {
        const { province, value } = vars;
        const mapDataMap = new Map(); 

        data.forEach(r => {
            const pVal = r[province];
            const vVal = r[value];

            if (pVal === null || pVal === undefined || pVal === '') return;
            if (vVal === null || vVal === undefined || vVal === '') return;

            let name = String(pVal).trim();
            if (["北京", "天津", "上海", "重庆"].includes(name)) name += "市";
            else if (["内蒙古", "西藏"].includes(name)) name += "自治区";
            else if (name === "新疆") name = "新疆维吾尔自治区";
            else if (name === "广西") name = "广西壮族自治区";
            else if (name === "宁夏") name = "宁夏回族自治区";
            else if (name === "香港" || name === "澳门") name += "特别行政区";
            else if (!name.endsWith("省") && !name.endsWith("市") && !name.endsWith("区")) name += "省";

            let cleanNumStr = String(vVal).replace(/[^\d.-]/g, '');
            let rawValue = parseFloat(cleanNumStr);
            if (isNaN(rawValue)) rawValue = 0; 

            mapDataMap.set(name, rawValue);
        });

        const mapData = Array.from(mapDataMap, ([name, val]) => ({ name, value: val }));
        return { mapData, pName: province, vName: value };
    },

    resultComponent: {
        props: ['results', 'extraConfigs', 'configSchema', 'variables', 'predefineColors'],
        // ✨ 修复 1：去除 myChart 的响应式，仅保留布尔值用于控制 UI 按钮
        data() { return { mapLoaded: false, chartReady: false }; },
        mounted() {
            if (!this.results || !this.$refs.chartRef) return;
            
            // ✨ 修复 1：将实例挂载到 this 上，但不放入 data()，彻底逃脱 Vue Proxy 的魔爪！
            this._myChart = window.echarts.init(this.$refs.chartRef);
            this.chartReady = true;
            
            if (window.echarts.getMap('china')) {
                this.mapLoaded = true;
                this.renderChart();
            } else {
                this._myChart.showLoading({ text: '正在加载地图数据...' });
                fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
                    .then(res => res.json())
                    .then(geoJson => {
                        window.echarts.registerMap('china', geoJson);
                        this.mapLoaded = true;
                        this._myChart.hideLoading();
                        this.renderChart();
                    })
                    .catch(err => {
                        console.error('加载地图数据失败:', err);
                        this._myChart.hideLoading();
                        this._myChart.showLoading({ text: '地图数据加载失败，请检查网络', color: '#ef4444', textColor: '#ef4444' });
                    });
            }

            this.$watch('extraConfigs', this.renderChart, { deep: true });
            this.$watch('results', this.renderChart, { deep: true });
            
            // ✨ 修复 3：使用现代浏览器原生的 ResizeObserver 监听 DIV 自身的变变，精确到像素级，无惧排版延迟！
            this._resizeObserver = new ResizeObserver(() => {
                if (this._myChart) this._myChart.resize();
            });
            this._resizeObserver.observe(this.$refs.chartRef);
        },
        // ✨ 修复 2：将 Vue 2 的 beforeDestroy 修正为 Vue 3 的 unmounted，防止内存泄漏和幽灵事件
        unmounted() {
            if (this._resizeObserver) this._resizeObserver.disconnect();
            if (this._myChart) { this._myChart.dispose(); this._myChart = null; }
        },
        methods: {
            renderChart() {
                // 全部替换为 this._myChart
                if (!this._myChart || !this.results || !this.mapLoaded) return;
                const cfg = this.extraConfigs;
                
                let colorRange = ['#FFF0F0', '#FFCCCC', '#FF9999', '#FF6666', '#FF3333', '#CC0000']; 
                if (cfg.colorTheme === 'blue') {
                    colorRange = ['#F0F8FF', '#CCE5FF', '#99CCFF', '#66B2FF', '#3399FF', '#0066CC'];
                } else if (cfg.colorTheme === 'green') {
                    colorRange = ['#F0FFF0', '#CCFFCC', '#99FF99', '#66FF66', '#33CC33', '#009900'];
                } else if (cfg.colorTheme === 'purple') {
                    colorRange = ['#F8F0FF', '#E5CCFF', '#CC99FF', '#B266FF', '#9933FF', '#6600CC'];
                }

                const option = {
                    backgroundColor: '#f8fafc',
                    title: { 
                        text: cfg.customTitle || '中国各省级行政区热力地图',
                        subtext: cfg.subTitle !== undefined && cfg.subTitle !== null ? cfg.subTitle : '数据来源：统计数据',
                        left: 'center', top: '2%',
                        textStyle: { fontSize: cfg.titleFontSize || 20, color: '#1e293b', fontWeight: 'bold' }
                    },
                    tooltip: { 
                        trigger: 'item', 
                        formatter: '{b}: {c}',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderColor: '#ccc',
                        borderWidth: 1,
                        textStyle: { color: '#333' }
                    },
                    visualMap: {
                        min: 0,
                        max: cfg.maxVal || 15000,
                        left: '10%',
                        bottom: '10%',
                        text: ['高', '低'],
                        calculable: true,
                        inRange: { color: colorRange },
                        textStyle: { fontSize: cfg.valueFontSize || 10 }
                    },
                    series: [{
                        name: this.results.vName,
                        type: 'map',
                        map: 'china',
                        roam: true, 
                        zoom: 1.2,  
                        label: { 
                            show: true, 
                            fontSize: cfg.valueFontSize || 10, 
                            color: '#000',
                            formatter: (params) => {
                                if (!cfg.useShortName) return params.name;
                                if (!params.name) return '';
                                return params.name
                                    .replace(/维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区/g, '')
                                    .replace(/(省|市)$/, '');
                            }
                        },
                        itemStyle: { borderColor: '#ffffff', borderWidth: 1 },
                        emphasis: {
                            label: { show: true, fontWeight: 'bold' },
                            itemStyle: {
                                areaColor: '#fcd34d', 
                                borderColor: '#000',
                                borderWidth: 1,
                                shadowBlur: 10,
                                shadowColor: 'rgba(0, 0, 0, 0.3)'
                            }
                        },
                        data: this.results.mapData
                    }]
                };
                this._myChart.setOption(option, true);
            },
            downloadChart() {
                if (!this._myChart) return;
                const link = document.createElement('a');
                link.href = this._myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#f8fafc' });
                link.download = `china_map_${Date.now()}.png`;
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
                                中国地图设置
                            </button>
                        </template>
                        <div class="plot-edit-container">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">地图参数配置（点击空白处关闭）</div>
                            <config-grid :config-schema="configSchema" :model-value="extraConfigs" :variables="variables" :predefine-colors="predefineColors"></config-grid>
                        </div>
                    </el-popover>
                    <button class="plot-action-btn btn-download-plot" @click="downloadChart" :disabled="!chartReady">保存 PNG</button>
                </div>
                <div ref="chartRef" style="width: 100%; max-width: 900px; height: 650px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"></div>
            </div>
        `
    },

    generateCode: (vars, config, fileInfo) => {
        const { fileName = 'dataset.csv' } = fileInfo || {};
        const { province, value } = vars;
        
        let colorRangeStr = '["#FFF0F0", "#FFCCCC", "#FF9999", "#FF6666", "#FF3333", "#CC0000"]'; 
        if (config.colorTheme === 'blue') {
            colorRangeStr = '["#F0F8FF", "#CCE5FF", "#99CCFF", "#66B2FF", "#3399FF", "#0066CC"]';
        } else if (config.colorTheme === 'green') {
            colorRangeStr = '["#F0FFF0", "#CCFFCC", "#99FF99", "#66FF66", "#33CC33", "#009900"]';
        } else if (config.colorTheme === 'purple') {
            colorRangeStr = '["#F8F0FF", "#E5CCFF", "#CC99FF", "#B266FF", "#9933FF", "#6600CC"]';
        }

        const pySubTitle = config.subTitle !== undefined && config.subTitle !== null ? config.subTitle : '数据来源：统计数据';
        
        const jsFormatterCode = config.useShortName !== false 
            ? `JsCode("function(params){if(!params.name)return ''; return params.name.replace(/维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区/g, '').replace(/(省|市)$/, '');}")`
            : `JsCode("function(params){return params.name}")`;

        return `# ============================================
# 学术级中国各省级行政区热力地图 (Pyecharts)
# 注: 运行前请确保已安装库：pip install pyecharts pandas
# ============================================
import pandas as pd
from pyecharts import options as opts
from pyecharts.charts import Map
from pyecharts.commons.utils import JsCode

# 1. 读取清洗数据
df = pd.read_csv(r"${fileName}")
df_clean = df.dropna(subset=['${province}', '${value}'])

# 强力清洗：应对 Excel 中文本型数字
df_clean['${value}'] = pd.to_numeric(df_clean['${value}'].astype(str).str.replace(r'[^0-9.-]', '', regex=True), errors='coerce').fillna(0)

# 简单名字标准化补全处理，确保匹配 pyecharts 地图全称规范
def normalize_province_name(name):
    name = str(name).strip()
    if name in ["北京", "天津", "上海", "重庆"]: return name + "市"
    if name in ["内蒙古", "西藏"]: return name + "自治区"
    if name == "新疆": return "新疆维吾尔自治区"
    if name == "广西": return "广西壮族自治区"
    if name == "宁夏": return "宁夏回族自治区"
    if name in ["香港", "澳门"]: return name + "特别行政区"
    if not name.endswith("省") and not name.endswith("市") and not name.endswith("区"): return name + "省"
    return name

df_clean['Normalize_Province'] = df_clean['${province}'].apply(normalize_province_name)

# 如果是面板数据(包含多年份)，按省份取均值
df_agg = df_clean.groupby('Normalize_Province')['${value}'].mean().reset_index()

# 将数据转换为 pyecharts Map 需要的元组列表格式
map_data_list = list(zip(df_agg['Normalize_Province'], df_agg['${value}']))

# 2. 创建地图实例与配置项
map_chart = (
    Map(init_opts=opts.InitOpts(width="1400px", height="1000px"))
    .set_global_opts(
        title_opts=opts.TitleOpts(
            title="${config.customTitle || "中国各省级行政区数据分布"}",
            subtitle="${pySubTitle}",
            title_textstyle_opts=opts.TextStyleOpts(font_size=${config.titleFontSize || 20}, font_weight="bold"),
            pos_left="center"
        ),
        visualmap_opts=opts.VisualMapOpts(
            max_=${config.maxVal || 15000},
            is_calculable=True,
            range_text=["高", "低"],
            orient="horizontal",
            pos_left="center",
            pos_top="12%",
            textstyle_opts=opts.TextStyleOpts(font_size=${config.valueFontSize || 10}),
            range_color=${colorRangeStr}
        ),
        legend_opts=opts.LegendOpts(is_show=False)
    )
    .add(
        series_name="${value}",
        data_pair=map_data_list,
        maptype="china",
        label_opts=opts.LabelOpts(
            is_show=True,
            font_size=${config.valueFontSize || 10},
            formatter=${jsFormatterCode}
        ),
        itemstyle_opts=opts.ItemStyleOpts(
            border_color="#ffffff",
            border_width=1,
        ),
        emphasis_itemstyle_opts=opts.ItemStyleOpts(
            border_color="rgba(0, 0, 0, 0.2)",
            border_width=4,
            opacity=0.9
        )
    )
    .set_series_opts(
        tooltip_opts=opts.TooltipOpts(
            trigger="item",
            formatter="{b}: {c}",
            background_color="rgba(255, 255, 255, 0.9)",
            border_color="#ddd",
            border_width=1,
            textstyle_opts=opts.TextStyleOpts(color="#333")
        )
    )
)

# 3. 渲染导出为交互式网页
html_file = "China_Map_Heatmap.html"
map_chart.render(html_file)
print(f"✅ 图表已生成！双击或在浏览器中打开: {html_file}")
`;
    }
});