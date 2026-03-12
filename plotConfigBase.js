/**
 * =========================================================
 * plotConfigBase.js - 绘图模块公共配置零件库 (扁平独立定义)
 * BY张张 | 支持极度详细的外观、字体、色彩与排版自定义
 * =========================================================
 */

// ✨ 分组分类图表使用的“离散色盘”
window.themeColorMap = {
    'Set1': ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'],
    'Set2': ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494','#b3b3b3'],
    'Dark2': ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666'],
    'Pastel1': ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd','#fddaec','#f2f2f2'],
    'Accent': ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f','#bf5b17','#666666'],
    'Greys': ['#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525','#000000']
};

// ✨ 新增：热力图/连续数值使用的“连续渐变色盘”
window.gradientColorMap = {
    'RdBu': ['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'],
    'viridis': ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
    'RdYlGn': ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'],
    'hot': ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'],
    'cool': ['#3b4cc0', '#4ba6c7', '#6fce9b', '#b0e573', '#f9f9b3'],
    'spectral': ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
    'Blues': ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    'Reds': ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
    'Greens': ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
    'Purples': ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
    'Oranges': ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
    'Greys': ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'],
    'coolwarm': ['#3b4cc0', '#4ba6c7', '#6fce9b', '#b0e573', '#f9f9b3', '#fbb84b', '#ec775f', '#d73027', '#a50026'],
    'plasma': ['#0d0887', '#4a02a0', '#7e03a8', '#b5367a', '#de6b4b', '#fcaa3c', '#f6f64c'],
    'magma': ['#000004', '#1d1045', '#4e1463', '#851d5a', '#b42f4b', '#d95745', '#fba35f', '#fee98c']
};

window.PlotConfigBase = {
    // 1. 开关控制类
    showTitle: { key: 'showTitle', label: '显示主标题', type: 'switch', default: true },
    showValues: { key: 'showValues', label: '显示数值', type: 'switch', default: true },
    showGrid: { key: 'showGrid', label: '显示网格线', type: 'switch', default: false },
    showBorder: { key: 'showBorder', label: '显示外边框', type: 'switch', default: true },
    showEquation: { key: 'showEquation', label: '显示方程', type: 'switch', default: true },
    showAxisBorder: { key: 'showAxisBorder', label: '显示坐标轴线', type: 'switch', default: true },
    showLegend: { key: 'showLegend', label: '显示图例', type: 'switch', default: true },
    
    // 2. 文本内容自定义输入类
    customTitle: { key: 'customTitle', label: '自定义主标题 (留空默认)', type: 'input' },
    customXLabel: { key: 'customXLabel', label: '自定义 X 轴名 (留空默认)', type: 'input' },
    customYLabel: { key: 'customYLabel', label: '自定义 Y 轴名 (留空默认)', type: 'input' },

    // 3. 字体排版类
    fontFamily: { 
        key: 'fontFamily', label: '全局字体', type: 'select', options: [ 
            { label: '无衬线 (Sans-serif)', value: 'sans-serif' }, 
            { label: '等宽代码 (Monospace)', value: 'monospace' }, 
            { label: '新罗马 (Times New Roman)', value: 'Times New Roman' },
            { label: '微软雅黑 (Microsoft YaHei)', value: 'Microsoft YaHei' }
        ], default: 'sans-serif' 
    },
    fontWeight: { 
        key: 'fontWeight', label: '字体粗细', type: 'select', options: [ 
            { label: '常规 (Normal)', value: 'normal' }, { label: '加粗 (Bold)', value: 'bold' }, { label: '极细 (Lighter)', value: 'lighter' } 
        ], default: 'normal' 
    },
    titleFontSize: { 
        key: 'titleFontSize', label: '标题字号', type: 'select', options: [ 
            { label: '14px', value: 14 }, { label: '15px', value: 15 }, { label: '16px', value: 16 }, { label: '18px', value: 18 }, { label: '20px', value: 20 }, { label: '24px', value: 24 } 
        ], default: 16 
    },
    axisFontSize: { 
        key: 'axisFontSize', label: '坐标轴字体', type: 'select', options: [ 
            { label: '10px', value: 10 }, { label: '11px', value: 11 }, { label: '12px', value: 12 }, { label: '13px', value: 13 }, { label: '14px', value: 14 }, { label: '16px', value: 16 } 
        ], default: 12 
    },
    valueFontSize: { 
        key: 'valueFontSize', label: '数据标签字体', type: 'select', options: [ 
            { label: '8px', value: 8 }, { label: '9px', value: 9 }, { label: '10px', value: 10 }, { label: '11px', value: 11 }, { label: '12px', value: 12 } 
        ], default: 10 
    },
    labelRotation: { 
        key: 'labelRotation', label: 'X轴标签旋转', type: 'select', options: [ 
            { label: '0°', value: 0 }, { label: '30°', value: 30 }, { label: '45°', value: 45 }, { label: '60°', value: 60 }, { label: '90°', value: 90 } 
        ], default: 0 
    },
    
    // 4. 画板背景与网格类
    backgroundColor: { key: 'backgroundColor', label: '画板背景色', type: 'color', default: '#ffffff' },
    gridColor: { key: 'gridColor', label: '网格线颜色', type: 'color', default: '#e5e7eb' },
    gridLineType: { 
        key: 'gridLineType', label: '网格线型', type: 'select', options: [ 
            { label: '实线 (Solid)', value: 'solid' }, { label: '虚线 (Dashed)', value: 'dashed' }, { label: '点线 (Dotted)', value: 'dotted' } 
        ], default: 'dashed' 
    },

    // 5. 渐变连续色系 (常用于热力图)
    colorScheme: { 
        key: 'colorScheme', label: '渐变配色系', type: 'select', options: [ 
            { label: '红蓝经典 (RdBu)', value: 'RdBu' }, 
            { label: '蓝绿高亮 (Viridis)', value: 'viridis' }, 
            { label: '红黄绿 (RdYlGn)', value: 'RdYlGn' }, 
            { label: '暖色焰火 (Hot)', value: 'hot' }, 
            { label: '冷色冰川 (Cool)', value: 'cool' }, 
            { label: '多彩光谱 (Spectral)', value: 'spectral' }, 
            { label: '纯净渐蓝 (Blues)', value: 'Blues' }, 
            { label: '警示渐红 (Reds)', value: 'Reds' }, 
            { label: '自然渐绿 (Greens)', value: 'Greens' }, 
            { label: '贵族渐紫 (Purples)', value: 'Purples' }, 
            { label: '活力渐橙 (Oranges)', value: 'Oranges' }, 
            { label: '黑白灰阶 (Greys)', value: 'Greys' }, 
            { label: '冷暖平衡 (coolwarm)', value: 'coolwarm' }, 
            { label: '等离子 (Plasma)', value: 'plasma' }, 
            { label: '深岩浆 (Magma)', value: 'magma' } 
        ], default: 'RdBu' 
    },
    
    // 6. 分组离散色系 (主题名称，各模块内部映射到具体颜色数组)
    categoricalTheme: {
        key: 'categoricalTheme', label: '分组主题色', type: 'select', options: [
            { label: '默认明亮 (Set1)', value: 'Set1' },
            { label: '马卡龙柔和 (Set2)', value: 'Set2' },
            { label: '深沉暗色 (Dark2)', value: 'Dark2' },
            { label: '水粉柔和 (Pastel1)', value: 'Pastel1' },
            { label: '复古色盘 (Accent)', value: 'Accent' },
            { label: '黑白灰阶 (Greys)', value: 'Greys' }
        ], default: 'Set2'
    },
    
    colorbarPosition: { key: 'colorbarPosition', label: '热力条位置', type: 'select', options: [ { label: '右侧', value: 'right' }, { label: '底部', value: 'bottom' }, { label: '顶部', value: 'top' } ], default: 'right' }
};