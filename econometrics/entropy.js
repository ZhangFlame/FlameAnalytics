/**
 * 熵值法客观赋权模块
 * 支持正向和负向指标标准化
 */

const calculateEntropy = (varConfigs, data) => {
    if (!varConfigs || varConfigs.length < 2) throw new Error("熵值法需要至少2个指标");

    const varNames = varConfigs.map(c => c.name);
    
    const cleanData = data.filter(row => {
        for (let v of varNames) {
            if (row[v] === null || isNaN(parseFloat(row[v]))) return false;
        }
        return true;
    });

    const n = cleanData.length;
    const m = varNames.length;

    if (n < m) throw new Error("样本量少于指标数，无法计算");

    const standardized = {};
    const stats = {}; 
    
    varConfigs.forEach(config => {
        const v = config.name;
        const values = cleanData.map(r => parseFloat(r[v]));
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min;
        
        stats[v] = { max, min, range, direction: config.direction };
        
        standardized[v] = values.map(x => {
            let std;
            if (range === 0) std = 1;
            else if (config.direction === 'positive') std = (x - min) / range;
            else std = (max - x) / range;
            return std === 0 ? 1e-10 : std;
        });
    });

    const entropy = {};
    const proportions = {};
    
    varConfigs.forEach(config => {
        const v = config.name;
        const sum = standardized[v].reduce((a, b) => a + b, 0);
        const p = standardized[v].map(x => x / sum);
        proportions[v] = p;
        
        const k = 1 / Math.log(n);
        const e = -k * p.reduce((sum, pi) => sum + (pi * Math.log(pi)), 0);
        entropy[v] = e;
    });

    const d = {}; 
    let dSum = 0;
    
    varConfigs.forEach(config => {
        const v = config.name;
        d[v] = 1 - entropy[v];
        dSum += d[v];
    });

    const weights = {};
    varConfigs.forEach(config => {
        const v = config.name;
        weights[v] = d[v] / dSum;
    });

    const scores = cleanData.map((_, i) => {
        return varConfigs.reduce((sum, config) => {
            const v = config.name;
            return sum + weights[v] * standardized[v][i];
        }, 0);
    });

    const scoreMean = MatrixUtils.mean(scores);
    const scoreStd = MatrixUtils.std(scores);
    const scoreMin = Math.min(...scores);
    const scoreMax = Math.max(...scores);

    const result = varConfigs.map(config => ({
        name: config.name,
        weight: weights[config.name],
        entropy: entropy[config.name],
        d: d[config.name],
        direction: config.direction,
        max: stats[config.name].max,
        min: stats[config.name].min
    })).sort((a, b) => b.weight - a.weight);

    const combined = cleanData.map((row, idx) => ({ ...row, _Score: Number(scores[idx]).toFixed(5) }));
    combined.sort((a, b) => b._Score - a._Score);
    const top100 = combined.slice(0, 100);

    return {
        weights: result, n, scores,
        scoreMean: scoreMean.toFixed(4),
        scoreStd: scoreStd.toFixed(4),
        scoreMin: scoreMin.toFixed(4),
        scoreMax: scoreMax.toFixed(4),
        standardized, proportions, cleanData, top100
    };
};

const generateEntropyStataCode = (varConfigs, fileInfo, processingSteps) => {
    const vars = varConfigs.map(c => MatrixUtils.cleanStataName(c.name));
    const varStr = vars.join(' ');
    const directions = {};
    varConfigs.forEach(c => directions[MatrixUtils.cleanStataName(c.name)] = c.direction);
    
    const { fileName, fileEncoding } = fileInfo;
    const fileExt = fileName.split('.').pop().toLowerCase();

    let processStr = processingSteps && processingSteps.length > 0 ? processingSteps.join('\n') + '\n' : '';
    
    let code = `* ============================================\n* 熵值法计算 Stata 代码（一键运行版本）\n* ============================================\n\n`;
    code += `* 步骤1: 载入数据\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    if (processStr) code += `* 步骤2: 变量预处理\n${processStr}\n`;

    code += `* 步骤3: 删除缺失值（与网站预览保持一致）\n* 要求：所有参与熵值法的指标均非缺失\negen _rowmiss_entropy = rowmiss(${varStr})\ndrop if _rowmiss_entropy > 0\ndrop _rowmiss_entropy\n\n`;
    
    code += `* 步骤4: 极差标准化\n* 正向指标: (x - min) / (max - min)\n* 负向指标: (max - x) / (max - min)\n\n`;

    let tempVars = [];
    
    // 使用安全的数字后缀以绝对保证不会超限 Stata 32字符的上限
    vars.forEach((v, idx) => {
        const originalVar = varConfigs.find(c => MatrixUtils.cleanStataName(c.name) === v).name;
        const isPositive = directions[v] === 'positive';
        code += `* ${isPositive ? '正向' : '负向'}指标: ${originalVar}\n`;
        code += `egen min_${idx} = min(${v})\n`;
        code += `egen max_${idx} = max(${v})\n`;
        
        if (isPositive) {
            code += `gen std_${idx} = (${v} - min_${idx}) / (max_${idx} - min_${idx}) if (max_${idx} > min_${idx})\n`;
        } else {
            code += `gen std_${idx} = (max_${idx} - ${v}) / (max_${idx} - min_${idx}) if (max_${idx} > min_${idx})\n`;
        }
        
        code += `replace std_${idx} = 1 if (max_${idx} <= min_${idx})\n`;
        code += `replace std_${idx} = 1e-10 if std_${idx} < 1e-10\n`;
        code += `replace std_${idx} = 1 if std_${idx} > 1\n\n`;
        
        tempVars.push(`min_${idx}`, `max_${idx}`, `std_${idx}`);
    });
    
    code += `* 步骤5: 计算比重矩阵\n* P_ij = X_ij / sum(X_ij)\n\n`;
    vars.forEach((v, idx) => { 
        code += `egen sum_std_${idx} = total(std_${idx})\n`;
        code += `gen p_${idx} = std_${idx} / sum_std_${idx} if sum_std_${idx} > 0\n`;
        code += `replace p_${idx} = 0 if missing(p_${idx})\n`;
        tempVars.push(`sum_std_${idx}`, `p_${idx}`);
    });

    code += `\n* 步骤6: 计算熵值\n* E_j = -k * sum(P_ij * ln(P_ij)), k = 1/ln(n)\n\n`;
    code += `count\nscalar n = r(N)\nscalar k = 1 / ln(n)\n\n`;
    vars.forEach((v, idx) => {
        code += `gen pln_p_${idx} = p_${idx} * ln(p_${idx}) if p_${idx} > 0\n`;
        code += `replace pln_p_${idx} = 0 if p_${idx} <= 0\n`;
        code += `egen sum_pln_p_${idx} = total(pln_p_${idx})\n`;
        code += `scalar E_${idx} = -k * sum_pln_p_${idx}[1]\n`;
        tempVars.push(`pln_p_${idx}`, `sum_pln_p_${idx}`);
    });

    code += `\n* 步骤7: 计算差异系数和权重\n* D_j = 1 - E_j\n* W_j = D_j / sum(D_j)\n\n`;
    let dSums = [];
    vars.forEach((v, idx) => { 
        code += `scalar D_${idx} = 1 - E_${idx}\n`; 
        dSums.push(`D_${idx}`); 
    });
    code += `scalar D_sum = ${dSums.join(' + ')}\n\n`;
    
    code += `* 显示各指标权重\n`;
    vars.forEach((v, idx) => { 
        code += `scalar W_${idx} = D_${idx} / D_sum\n`;
        code += `display "${v} 权重: " W_${idx}\n`; 
    });

    code += `\n* 步骤8: 计算综合指数\n* composite_index = sum(std_X_j * W_j)\n\n`;
    let scoreFormula = vars.map((v, idx) => `(W_${idx} * std_${idx})`).join(' + ');
    code += `gen composite_index = ${scoreFormula}\n\n`;
    
    code += `* 查看综合指数描述统计\nsummarize composite_index\n\n`;
    
    code += `* 清理临时变量（熵值法中间过程变量）\ncapture drop ${tempVars.join(' ')}\n`;
    
    return code;
};

ModelRegistry.register({
    id: 'entropy',
    category: 'econometrics',
    name: '熵值法客观赋权',
    slots: [
        { key: 'indicators', label: '评价指标', type: 'entropy', multiple: true } 
    ],
    extraConfigs: [],

    formulaComponent: {
        props: ['formValues'],
        template: `
            <div>
                <div style="font-size: 18px; margin-bottom: 8px; line-height: 1.6;">
                    <span class="math-var">Score</span> = 
                    <span v-if="!formValues.indicators || formValues.indicators.length === 0">
                        <span class="formula-sigma">Σ</span> ( <span class="math-var">W<sub style="font-size:10px">j</sub></span> × <span class="math-var">X<sub style="font-size:10px">j</sub><sup style="font-size:10px">std</sup></span> )
                    </span>
                    <span v-else>
                        <span v-for="(item, idx) in formValues.indicators" :key="'ent'+idx">
                            <span v-if="idx > 0" style="margin: 0 4px;"> + </span>
                            <span class="math-var">W<sub style="font-size:10px">{{idx+1}}</sub></span>×<span class="math-var">{{ item.name }}</span><sup style="font-size:10px; margin-left:2px; font-weight:bold;" :style="{ color: item.direction === 'positive' ? '#10b981' : '#ef4444' }">{{ item.direction === 'positive' ? '(+)' : '(-)' }}</sup>
                        </span>
                    </span>
                </div>
                <div style="font-size: 14px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                    ( 熵值法客观赋权：基于信息量动态分配权重 W，右上角指示极差标准化的方向 )
                </div>
            </div>
        `
    },

    resultComponent: {
        props: ['results', 'extraConfigs'],
        template: `
            <div style="width: 100%;">
                <div class="stat-summary">
                    <span>客观赋权测算</span>
                    <span>有效评价样本数 (N): <strong>{{ results.n }}</strong></span>
                    <span>综合得分均值: <strong>{{ results.scoreMean }}</strong></span>
                    <span>最高得分: <strong>{{ results.scoreMax }}</strong></span>
                </div>
                <table class="academic-table" style="margin-bottom: 40px;">
                    <caption>表1. 熵值法指标体系与权重系数提取结果</caption>
                    <thead>
                        <tr class="top-line header-sub">
                            <th class="text-left">基础评价指标 (Indicator)</th>
                            <th>作用方向 (Direction)</th>
                            <th>信息熵 (Entropy)</th>
                            <th>效用值 (Redundancy)</th>
                            <th>分配权重 (Weight)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in results.weights" :key="item.name">
                            <td class="text-left"><strong>{{ item.name }}</strong></td>
                            <td><span :style="{color: item.direction==='positive' ? '#f59e0b' : '#ef4444', fontWeight:'bold'}">{{ item.direction === 'positive' ? '正向(+)' : '负向(-)' }}</span></td>
                            <td>{{ item.entropy?.toFixed(4) }}</td>
                            <td>{{ item.d?.toFixed(4) }}</td>
                            <td><strong style="color: #4361ee; font-size: 16px;">{{ (item.weight * 100).toFixed(2) }}%</strong></td>
                        </tr>
                    </tbody>
                    <tfoot><tr><td colspan="5" style="border-bottom: 2px solid #000;"></td></tr></tfoot>
                </table>

                <div style="width: 100%; text-align: center; font-weight: bold; margin: 20px 0 15px; font-size: 16px; color: #333;">表2. 样本综合得分推演排名 (Top 100 展示)</div>
                <div style="max-height: 400px; overflow-y: auto; width: 100%; max-width: 950px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 auto 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <table class="academic-table" style="margin: 0; width: 100%; border-collapse: separate; border-spacing: 0;">
                        <thead style="position: sticky; top: 0; background-color: #f1f5f9; z-index: 10;">
                            <tr>
                                <th style="border-bottom: 2px solid #000; padding: 12px 8px;">相对排名</th>
                                <th class="text-left" v-if="extraConfigs.entityVar" style="border-bottom: 2px solid #000; padding: 12px 8px;">{{ extraConfigs.entityVar }} (ID)</th>
                                <th class="text-left" v-if="extraConfigs.yearVar" style="border-bottom: 2px solid #000; padding: 12px 8px;">{{ extraConfigs.yearVar }} (Year)</th>
                                <th style="border-bottom: 2px solid #000; padding: 12px 8px;">最终测算得分 (Score)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, idx) in results.top100" :key="idx">
                                <td style="border-bottom: 1px solid #e2e8f0;">{{ idx + 1 }}</td>
                                <td class="text-left" v-if="extraConfigs.entityVar" style="border-bottom: 1px solid #e2e8f0;">{{ row[extraConfigs.entityVar] }}</td>
                                <td class="text-left" v-if="extraConfigs.yearVar" style="border-bottom: 1px solid #e2e8f0;">{{ row[extraConfigs.yearVar] }}</td>
                                <td style="border-bottom: 1px solid #e2e8f0;"><strong>{{ row._Score }}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `
    },

    validate: (vars) => vars.indicators && vars.indicators.length >= 2,
    run: (vars, data, config) => calculateEntropy(vars.indicators, data),
    generateCode: (vars, config, fileInfo, processingSteps) => generateEntropyStataCode(vars.indicators, fileInfo, processingSteps)
});

window.Entropy = { calculate: calculateEntropy, generateStataCode: generateEntropyStataCode };