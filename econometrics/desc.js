/**
 * =========================================================
 * 描述性统计与相关系数矩阵模块
 * BY张张 | 自动化完成论文最核心的 Table 1 和 Table 2
 * =========================================================
 */

const calculateDesc = (varNames, data) => {
    if (!varNames || varNames.length === 0) throw new Error("请至少选择一个变量");
    
    // BY张张：对齐样本量，剔除任何包含缺失值的行
    const cleanDataObj = data.filter(row => {
        for (let v of varNames) {
            const val = parseFloat(row[v]);
            if (isNaN(val) || val === null || val === undefined) return false;
        }
        return true;
    });

    const n = cleanDataObj.length;
    if (n === 0) throw new Error("剔除缺失值后有效样本量为0");

    const cleanMatrix = cleanDataObj.map(row => varNames.map(v => parseFloat(row[v])));

    // 1. 关注公众号：张张小栈 —— 计算描述性统计
    const stats = varNames.map((v, i) => {
        const col = cleanMatrix.map(row => row[i]);
        return {
            name: v,
            obs: n,
            mean: MatrixUtils.mean(col).toFixed(4),
            std: MatrixUtils.std(col).toFixed(4),
            min: MatrixUtils.min(col).toFixed(4),
            max: MatrixUtils.max(col).toFixed(4)
        };
    });

    // 2. 计算 Pearson 相关系数矩阵
    const corrMatrix = Array(varNames.length).fill(0).map(() => Array(varNames.length).fill(0));
    for (let i = 0; i < varNames.length; i++) {
        for (let j = 0; j <= i; j++) {
            if (i === j) {
                corrMatrix[i][j] = "1.000";
            } else {
                const colI = cleanMatrix.map(row => row[i]);
                const colJ = cleanMatrix.map(row => row[j]);
                const meanI = MatrixUtils.mean(colI);
                const meanJ = MatrixUtils.mean(colJ);
                
                // 严谨的皮尔逊离差公式
                let num = 0, denI = 0, denJ = 0;
                for (let k = 0; k < n; k++) {
                    const diffI = colI[k] - meanI;
                    const diffJ = colJ[k] - meanJ;
                    num += diffI * diffJ;
                    denI += diffI * diffI;
                    denJ += diffJ * diffJ;
                }
                const r = (denI === 0 || denJ === 0) ? 0 : num / Math.sqrt(denI * denJ);
                corrMatrix[i][j] = r.toFixed(3);
                corrMatrix[j][i] = r.toFixed(3); 
            }
        }
    }

    return { stats, corrMatrix, varNames, n };
};

// BY张张：生成自动化的 Stata 描述性导出代码
const generateDescStataCode = (varNames, fileInfo, processingSteps) => {
    const varsStr = varNames.map(v => MatrixUtils.cleanStataName(v)).join(' ');
    const { fileName, fileEncoding } = fileInfo;
    const fileExt = fileName.split('.').pop().toLowerCase();

    let processStr = '';
    if (processingSteps && processingSteps.length > 0) {
        processStr = processingSteps.join('\n') + '\n';
    }

    let code = `* ============================================\n`;
    code += `* 描述性统计与相关系数 - 自动生成的 Stata 代码\n`;
    code += `* 关注公众号：张张小栈 获取更多技巧\n`;
    code += `* ============================================\n\n`;
    
    code += `* 步骤1: 载入数据\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    if (processStr) code += processStr;

    code += `* 步骤2: 剔除含有缺失值的样本，保持样本对齐\negen _miss = rowmiss(${varsStr})\ndrop if _miss > 0\ndrop _miss\n\n`;
    code += `* 步骤3: 输出描述性统计表并利用 esttab 导出至 Word\nsummarize ${varsStr}, detail\n`;
    code += `* (如报错请先安装 estout: ssc install estout)\n`;
    code += `estpost summarize ${varsStr}\n`;
    code += `esttab using "Desc_Stats.rtf", replace cells("count mean sd min max") noobs title("表1. 描述性统计")\n\n`;
    code += `* 步骤4: 输出 Pearson 相关系数矩阵\npwcorr ${varsStr}, star(0.05) sig\n`;
    code += `estpost correlate ${varsStr}, matrix\n`;
    code += `esttab using "Corr_Matrix.rtf", append unstack not noobs compress title("表2. 相关系数矩阵")\n`;

    return code;
};

// 注册描述性统计模型
ModelRegistry.register({
    id: 'desc',
    category: 'econometrics',
    name: '描述性统计与相关系数',
    slots: [
        { key: 'x', label: '分析变量', type: 'multiple', tagType: 'x' }
    ],
    extraConfigs: [],

    // ✨ UI 组件解耦：动态结果表格
    resultComponent: {
        props: ['results', 'formatters'],
        template: `
            <div style="width: 100%;">
                <table class="academic-table" style="margin-bottom: 40px;">
                    <caption>表1. 描述性统计汇总 (Descriptive Statistics)</caption>
                    <thead>
                        <tr class="top-line header-sub">
                            <th class="text-left">变量 (Variable)</th>
                            <th>观测值 (Obs)</th>
                            <th>均值 (Mean)</th>
                            <th>标准差 (Std. Dev.)</th>
                            <th>最小值 (Min)</th>
                            <th>最大值 (Max)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in results.stats" :key="item.name">
                            <td class="text-left"><strong>{{ item.name }}</strong></td>
                            <td>{{ item.obs }}</td><td>{{ item.mean }}</td>
                            <td>{{ item.std }}</td><td>{{ item.min }}</td><td>{{ item.max }}</td>
                        </tr>
                    </tbody>
                    <tfoot><tr><td colspan="6" style="border-bottom: 2px solid #000;"></td></tr></tfoot>
                </table>

                <table class="academic-table">
                    <caption>表2. Pearson 系数矩阵 (Correlation Matrix)</caption>
                    <thead>
                        <tr class="top-line header-sub">
                            <th class="text-left">核心变量</th>
                            <th v-for="(v, i) in results.varNames" :key="'h'+i">({{ i+1 }})</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, i) in results.corrMatrix" :key="'r'+i">
                            <td class="text-left">({{ i+1 }}) <strong>{{ results.varNames[i] }}</strong></td>
                            <td v-for="(val, j) in row" :key="'c'+j" :style="{ backgroundColor: j < i ? formatters.getHeatMapColor(val) : 'transparent' }">
                                {{ j <= i ? val : '' }}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot><tr><td :colspan="results.varNames.length + 1" style="border-bottom: 2px solid #000;"></td></tr></tfoot>
                </table>
            </div>
        `
    },

    validate: (vars) => vars.x && vars.x.length > 0,
    run: (vars, data, config) => Desc.calculate(vars.x, data),
    generateCode: (vars, config, fileInfo, processingSteps) => generateDescStataCode(vars.x, fileInfo, processingSteps)
});

window.Desc = { calculate: calculateDesc, generateStataCode: generateDescStataCode };