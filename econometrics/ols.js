/**
 * =========================================================
 * OLS (普通最小二乘法) 回归分析模块 - 大刊 6 列递进版
 * BY张张 | 支持同方差、聚类稳健、智能过滤完美共线性
 * =========================================================
 */

const calculateOLS = (yName, xNames, data, seType = 'ordinary', clusterVar = null) => {
    const allVars = [yName, ...xNames];
    const cleanData = data.filter(row => {
        for (let v of allVars) {
            if (row[v] === null || row[v] === undefined || row[v] === '' || isNaN(parseFloat(row[v]))) return false;
        }
        if (clusterVar && (row[clusterVar] === null || row[clusterVar] === undefined || row[clusterVar] === '')) return false;
        return true;
    });

    const n = cleanData.length;
    const k = xNames.length;
    if (n < k + 1) throw new Error("样本量不足，无法进行回归分析");

    const Y = cleanData.map(row => [parseFloat(row[yName])]);
    const X = cleanData.map(row => [1, ...xNames.map(x => parseFloat(row[x]))]);

    const X_T = MatrixUtils.transpose(X);
    const XTX = MatrixUtils.multiply(X_T, X);
    const XTX_inv = MatrixUtils.invert(XTX);
    const XTY = MatrixUtils.multiply(X_T, Y);
    const beta = MatrixUtils.multiply(XTX_inv, XTY);

    const Y_pred = MatrixUtils.multiply(X, beta);
    const residuals = Y.map((y, i) => [y[0] - Y_pred[i][0]]);
    const rss = residuals.reduce((sum, r) => sum + r[0] * r[0], 0);
    const sigma2 = rss / (n - k - 1);

    let varCovar;
    if (seType === 'cluster' && clusterVar) {
        const clusters = {};
        cleanData.forEach((row, i) => { const c = row[clusterVar]; if (!clusters[c]) clusters[c] = []; clusters[c].push(i); });
        const G = Object.keys(clusters).length;
        const meat = Array(k + 1).fill(0).map(() => Array(k + 1).fill(0));
        Object.values(clusters).forEach(idxList => {
            const clusterResiduals = idxList.map(i => residuals[i]);
            const clusterX = idxList.map(i => X[i]);
            const clusterScore = MatrixUtils.multiply(MatrixUtils.transpose(clusterX), clusterResiduals);
            for (let i = 0; i <= k; i++) for (let j = 0; j <= k; j++) meat[i][j] += clusterScore[i][0] * clusterScore[j][0];
        });
        varCovar = MatrixUtils.multiply(MatrixUtils.multiply(XTX_inv, meat), XTX_inv);
        const df = (G / (G - 1)) * ((n - 1) / (n - k - 1));
        varCovar = varCovar.map(row => row.map(v => v * df));
    } else if (seType === 'robust') {
        const meat = Array(k + 1).fill(0).map(() => Array(k + 1).fill(0));
        for (let i = 0; i < n; i++) {
            const e2 = residuals[i][0] * residuals[i][0];
            for (let r = 0; r <= k; r++) {
                for (let c = 0; c <= k; c++) {
                    meat[r][c] += X[i][r] * X[i][c] * e2;
                }
            }
        }
        varCovar = MatrixUtils.multiply(MatrixUtils.multiply(XTX_inv, meat), XTX_inv);
        const df_r = n / (n - k - 1);
        varCovar = varCovar.map(row => row.map(v => v * df_r));
    } else {
        varCovar = XTX_inv.map(row => row.map(v => v * sigma2));
    }

    const yMean = MatrixUtils.mean(Y.map(r => r[0]));
    const tss = Y.reduce((sum, y) => sum + Math.pow(y[0] - yMean, 2), 0);
    const r2 = 1 - rss / tss;
    const adjR2 = 1 - (rss / (n - k - 1)) / (tss / (n - 1));
    const fStat = ((tss - rss) / k) / (rss / (n - k - 1));

    const vifs = {};
    if (k > 1) {
        try {
            const corrMat = MatrixUtils.correlationMatrix(cleanData, xNames);
            const corrMatInv = MatrixUtils.invert(corrMat);
            for (let i = 0; i < k; i++) vifs[xNames[i]] = corrMatInv[i][i].toFixed(2);
        } catch (e) { xNames.forEach(name => vifs[name] = "N/A"); }
    } else if (k === 1) vifs[xNames[0]] = "1.00";

    const coefs = {};
    for (let i = 0; i <= k; i++) {
        const b = beta[i][0]; const se = Math.sqrt(Math.max(0, varCovar[i][i]));
        const t = b / se; const p = MatrixUtils.tProb(t, n - k - 1);
        if (i === 0) coefs['_cons'] = { coef: b, se: se, t: t, p: p };
        else coefs[xNames[i - 1]] = { coef: b, se: se, t: t, p: p, vif: vifs[xNames[i - 1]] };
    }

    return { coefs, n, k, r2: r2.toFixed(4), adjR2: adjR2.toFixed(4), fStat: fStat.toFixed(2) };
};

const generateOLSStataCode = (vars, config, fileInfo, processingSteps) => {
    const { y, x, c } = vars;
    const { clusterVar, entityVar, yearVar } = config;
    const { fileName = 'dataset.dta', fileEncoding = 'utf8' } = fileInfo || {};
    const fileExt = fileName.split('.').pop().toLowerCase();

    let stY = MatrixUtils.cleanStataName(y);
    let safeX = x.filter(v => v !== entityVar && v !== yearVar).map(v => MatrixUtils.cleanStataName(v));
    let safeC = c.filter(v => v !== entityVar && v !== yearVar).map(v => MatrixUtils.cleanStataName(v));
    let stX = safeX.join(' ');
    let stC = safeC.join(' ');

    let stCluster = clusterVar ? MatrixUtils.cleanStataName(clusterVar) : '';
    let stEntity = entityVar ? MatrixUtils.cleanStataName(entityVar) : '';
    let stYear = yearVar ? MatrixUtils.cleanStataName(yearVar) : '';

    let code = `* ============================================\n* 自动生成的 Stata 代码（大刊顶刊一键运行版）\n* 请确保已安装：ssc install reghdfe, ssc install estout\n* ============================================\n\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    code += `* 步骤2: 面板维度识别与处理\n`;

    if (stCluster) {
        code += `capture confirm numeric variable ${stCluster}\n`;
        code += `local c_is_str = _rc\n`;
        code += `if \`c_is_str' encode ${stCluster}, gen(${stCluster}_id)\n`;
        code += `if \`c_is_str' local cluster_id "${stCluster}_id"\n`;
        code += `if !\`c_is_str' local cluster_id "${stCluster}"\n`;
    }
    if (stEntity) {
        code += `capture confirm numeric variable ${stEntity}\n`;
        code += `local p_is_str = _rc\n`;
        code += `if \`p_is_str' encode ${stEntity}, gen(${stEntity}_id)\n`;
        code += `if \`p_is_str' local panel_id "${stEntity}_id"\n`;
        code += `if !\`p_is_str' local panel_id "${stEntity}"\n`;
    }

    if (stYear) code += `capture destring ${stYear}, replace force\n`;

    if (processingSteps && processingSteps.length > 0) code += `\n* 变量原地预处理\n${processingSteps.join('\n')}\n\n`;

    code += `* 步骤3: 渐进式回归分析 (6列模型矩阵)\n`;
    let models = [];

    code += `reg ${stY} ${stX}\nestadd local cluster "无"\nestadd local fe_entity "No"\nestadd local fe_time "No"\nest store m1\n`;
    models.push('m1');

    if (stCluster) {
        code += `reg ${stY} ${stX}, vce(cluster \`cluster_id')\nestadd local cluster "${clusterVar}"\nestadd local fe_entity "No"\nestadd local fe_time "No"\nest store m2\n`;
        models.push('m2');
    } else {
        code += `reg ${stY} ${stX}, robust\nestadd local cluster "稳健"\nestadd local fe_entity "No"\nestadd local fe_time "No"\nest store m2\n`;
        models.push('m2');
    }

    if (safeC.length > 0) {
        code += `reg ${stY} ${stX} ${stC}\nestadd local cluster "无"\nestadd local fe_entity "No"\nestadd local fe_time "No"\nest store m3\n`;
        models.push('m3');

        if (stCluster) {
            code += `reg ${stY} ${stX} ${stC}, vce(cluster \`cluster_id')\nestadd local cluster "${clusterVar}"\nestadd local fe_entity "No"\nestadd local fe_time "No"\nest store m4\n`;
            models.push('m4');
        } else {
            code += `reg ${stY} ${stX} ${stC}, robust\nestadd local cluster "稳健"\nestadd local fe_entity "No"\nestadd local fe_time "No"\nest store m4\n`;
            models.push('m4');
        }

        code += `\n* VIF共线性检验\nvif\n\n`;

        if (stEntity || stYear) {
            let absorbStr = [stEntity ? "`panel_id'" : "", stYear ? stYear : ""].filter(v => v).join(" ");
            code += `* 引入高维固定效应\n`;
            code += `reghdfe ${stY} ${stX} ${stC}, absorb(${absorbStr})\nestadd local cluster "无"\nestadd local fe_entity "${stEntity ? 'Yes' : 'No'}"\nestadd local fe_time "${stYear ? 'Yes' : 'No'}"\nest store m5\n`;
            models.push('m5');

            if (stCluster) {
                code += `reghdfe ${stY} ${stX} ${stC}, absorb(${absorbStr}) vce(cluster \`cluster_id')\nestadd local cluster "${clusterVar}"\nestadd local fe_entity "${stEntity ? 'Yes' : 'No'}"\nestadd local fe_time "${stYear ? 'Yes' : 'No'}"\nest store m6\n`;
                models.push('m6');
            } else {
                code += `reghdfe ${stY} ${stX} ${stC}, absorb(${absorbStr}) vce(robust)\nestadd local cluster "稳健"\nestadd local fe_entity "${stEntity ? 'Yes' : 'No'}"\nestadd local fe_time "${stYear ? 'Yes' : 'No'}"\nest store m6\n`;
                models.push('m6');
            }
        }
    } else {
        code += `\n* VIF共线性检验\nvif\n\n`;
    }

    code += `\n* 步骤4: 导出结果\n`;
    code += `esttab ${models.join(' ')} using "results_ols.rtf", replace ///\n`;
    code += `    prehead(\`"{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}} \\margl720\\margr720\\margt720\\margb720"') ///\n`;
    code += `    b(%9.4f) se(%9.4f) star(* 0.1 ** 0.05 *** 0.01) ///\n`;
    code += `    compress nogaps nomtitles nonotes ///\n`;
    code += `    stats(cluster N fe_entity fe_time, labels("聚类层面" "观测值" "个体效应" "时间效应") fmt(%s %9.0fc %s %s)) ///\n`;
    code += `    addnotes("注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为相应的标准误") ///\n`;
    code += `    title("表1: OLS 多元线性回归结果")\n`;

    return code;
};

ModelRegistry.register({
    id: 'ols',
    category: 'econometrics',
    name: 'OLS 多元线性回归',
    slots: [
        { key: 'y', label: '被解释变量 Y', type: 'single', tagType: 'y' },
        { key: 'x', label: '解释变量 X', type: 'multiple', tagType: 'x' },
        { key: 'c', label: '控制变量 C', type: 'multiple', tagType: 'c' }
    ],
    extraConfigs: [
        // 全部归入 basic 组（显示为“基本设置”）
        { key: 'entityVar', label: '个体标识', type: 'select', group: 'basic', optional: true },
        { key: 'yearVar', label: '时间标识', type: 'select', group: 'basic', optional: true },
        { key: 'clusterVar', label: '聚类层面', type: 'select', group: 'basic', optional: true },
        {
            key: 'seType', label: '标准误类型', type: 'select', group: 'basic', options: [
                { label: '普通标准误', value: 'ordinary' },
                { label: '稳健标准误', value: 'robust' },
                { label: '聚类稳健', value: 'cluster' }
            ], default: 'ordinary'
        }
    ],
    formulaComponent: {
        props: ['formValues'],
        template: `
            <div>
                <span class="math-var">{{ formValues.y || 'Y' }}</span> = α 
                <span v-for="(x, idx) in formValues.x" :key="'fx'+idx">+ β<sub style="font-size: 12px">{{idx+1}}</sub><span class="math-var">{{ x }}</span></span>
                <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + ε
            </div>
        `
    },
    resultComponent: {
        props: ['results', 'formValues', 'extraConfigs', 'allVars', 'formatters'],
        methods: {
            getVifVal(v) {
                return this.results.m3?.coefs[v]?.vif || this.results.m1?.coefs[v]?.vif || '-';
            },
            getVifStyle(v) {
                const vif = this.getVifVal(v);
                if (vif === '-' || vif === 'N/A') return 'color: #94a3b8; font-weight: normal; border: none; background: transparent;';
                const val = parseFloat(vif);
                if (val >= 10) {
                    return 'border: 1px solid #fca5a5; background-color: #fef2f2; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;';
                } else {
                    return 'border: 1px solid #86efac; background-color: #f0fdf4; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;';
                }
            }
        },
        template: `
            <div style="width: 100%;">
                <table class="academic-table">
                    <caption>表1. 混合回归与双向固定效应演进阵列 (Pooled OLS to TWFE)</caption>
                    <thead>
                        <tr class="top-line">
                            <th rowspan="2" class="text-left">解释变量</th>
                            <th>(1)</th><th v-if="results.m2">(2)</th>
                            <th v-if="results.m3">(3)</th><th v-if="results.m4">(4)</th>
                            <th v-if="results.m5">(5)</th><th v-if="results.m6">(6)</th>
                            <th rowspan="2" style="border-left: 1px solid #e2e8f0; padding-left: 15px; color: #475569;">VIF判定</th>
                        </tr>
                        <tr class="header-sub">
                            <th>{{formValues.y}}</th><th v-if="results.m2">{{formValues.y}}</th>
                            <th v-if="results.m3">{{formValues.y}}</th><th v-if="results.m4">{{formValues.y}}</th>
                            <th v-if="results.m5">{{formValues.y}}</th><th v-if="results.m6">{{formValues.y}}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="v in allVars" :key="v" v-show="v !== extraConfigs.entityVar && v !== extraConfigs.yearVar">
                            <td class="var-name">{{ v }}</td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.m1?.coefs[v]?.coef > 0}">{{ formatters.formatCoef(results.m1, v) }}</span><span class="se-text">{{ formatters.formatSE(results.m1, v) }}</span></div></td>
                            <td v-if="results.m2"><div class="coef-block"><span :class="{'color-pos': results.m2?.coefs[v]?.coef > 0}">{{ formatters.formatCoef(results.m2, v) }}</span><span class="se-text">{{ formatters.formatSE(results.m2, v) }}</span></div></td>
                            <td v-if="results.m3"><div class="coef-block"><span :class="{'color-pos': results.m3?.coefs[v]?.coef > 0}">{{ formatters.formatCoef(results.m3, v) }}</span><span class="se-text">{{ formatters.formatSE(results.m3, v) }}</span></div></td>
                            <td v-if="results.m4"><div class="coef-block"><span :class="{'color-pos': results.m4?.coefs[v]?.coef > 0}">{{ formatters.formatCoef(results.m4, v) }}</span><span class="se-text">{{ formatters.formatSE(results.m4, v) }}</span></div></td>
                            <td v-if="results.m5"><div class="coef-block"><span :class="{'color-pos': results.m5?.coefs[v]?.coef > 0}">{{ formatters.formatCoef(results.m5, v) }}</span><span class="se-text">{{ formatters.formatSE(results.m5, v) }}</span></div></td>
                            <td v-if="results.m6"><div class="coef-block"><span :class="{'color-pos': results.m6?.coefs[v]?.coef > 0}">{{ formatters.formatCoef(results.m6, v) }}</span><span class="se-text">{{ formatters.formatSE(results.m6, v) }}</span></div></td>
                            
                            <td style="border-left: 1px solid #e2e8f0; padding-left: 15px;">
                                <span :style="getVifStyle(v)">
                                    {{ getVifVal(v) }}
                                </span>
                            </td>
                        </tr>
                        <tr><td class="var-name">_cons</td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.m1) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m1) }}</span></div></td>
                            <td v-if="results.m2"><div class="coef-block"><span>{{ formatters.formatConst(results.m2) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m2) }}</span></div></td>
                            <td v-if="results.m3"><div class="coef-block"><span>{{ formatters.formatConst(results.m3) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m3) }}</span></div></td>
                            <td v-if="results.m4"><div class="coef-block"><span>{{ formatters.formatConst(results.m4) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m4) }}</span></div></td>
                            <td v-if="results.m5">-</td><td v-if="results.m6">-</td>
                            <td style="border-left: 1px solid #e2e8f0; padding-left: 15px; color: #94a3b8;">-</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="bottom-line">
                            <td class="text-left">标准误/聚类</td>
                            <td>普通</td><td v-if="results.m2">{{ extraConfigs.clusterVar || '稳健' }}</td><td v-if="results.m3">普通</td>
                            <td v-if="results.m4">{{ extraConfigs.clusterVar || '稳健' }}</td><td v-if="results.m5">普通</td><td v-if="results.m6">{{ extraConfigs.clusterVar || '稳健' }}</td>
                            <td style="border-left: 1px solid #e2e8f0;"></td>
                        </tr>
                        <tr><td class="text-left">个体效应</td><td>No</td><td v-if="results.m2">No</td><td v-if="results.m3">No</td><td v-if="results.m4">No</td><td v-if="results.m5">{{ extraConfigs.entityVar ? 'Yes' : 'No' }}</td><td v-if="results.m6">{{ extraConfigs.entityVar ? 'Yes' : 'No' }}</td><td style="border-left: 1px solid #e2e8f0;"></td></tr>
                        <tr><td class="text-left">时间效应</td><td>No</td><td v-if="results.m2">No</td><td v-if="results.m3">No</td><td v-if="results.m4">No</td><td v-if="results.m5">{{ extraConfigs.yearVar ? 'Yes' : 'No' }}</td><td v-if="results.m6">{{ extraConfigs.yearVar ? 'Yes' : 'No' }}</td><td style="border-left: 1px solid #e2e8f0;"></td></tr>
                        <tr><td class="text-left">观测值 (N)</td><td>{{results.m1?.n}}</td><td v-if="results.m2">{{results.m2?.n}}</td><td v-if="results.m3">{{results.m3?.n}}</td><td v-if="results.m4">{{results.m4?.n}}</td><td v-if="results.m5">{{results.m5?.n}}</td><td v-if="results.m6">{{results.m6?.n}}</td><td style="border-left: 1px solid #e2e8f0;"></td></tr>
                    </tfoot>
                </table>
                <div style="font-size: 13px; color: #64748b; margin: 8px auto 0; max-width: 950px; text-align: left; padding-left: 10px;">注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为普通、稳健或聚类稳健标准误。最右侧 VIF 列智能报告了多重共线性（<span style="color: #16a34a; font-weight: bold;">绿色</span>表示 VIF &lt; 10 判定安全通过，<span style="color: #ef4444; font-weight: bold;">红色</span>代表 VIF ≥ 10 具有潜在共线性风险）。</div>
            </div>
        `
    },
    validate: (vars) => vars.y && vars.x && vars.x.length > 0,
    run: (vars, data, config) => {
        const { y, x, c } = vars;
        const safeX = x.filter(v => v !== config.entityVar && v !== config.yearVar);
        const safeC = c.filter(v => v !== config.entityVar && v !== config.yearVar);
        const allX = [...safeX, ...safeC];

        const getSeType = (type) => {
            if (type === 'cluster') return 'cluster';
            if (type === 'robust') return 'robust';
            return 'ordinary';
        };

        let m1 = calculateOLS(y, safeX, data, 'ordinary', config.clusterVar);
        let m2 = calculateOLS(y, safeX, data, getSeType(config.seType), config.clusterVar);
        let m3 = null, m4 = null, m5 = null, m6 = null;

        if (safeC.length > 0) {
            m3 = calculateOLS(y, allX, data, 'ordinary', config.clusterVar);
            m4 = calculateOLS(y, allX, data, getSeType(config.seType), config.clusterVar);
        }

        if ((safeC.length > 0 || safeX.length > 0) && (config.entityVar || config.yearVar)) {
            let absVars = [config.entityVar, config.yearVar].filter(v => v);
            let targetX = safeC.length > 0 ? allX : safeX;
            m5 = runMiniReghdfe(y, targetX, data, absVars, 'ordinary', config.clusterVar);
            m6 = runMiniReghdfe(y, targetX, data, absVars, getSeType(config.seType), config.clusterVar);
        }
        return { m1, m2, m3, m4, m5, m6 };
    },
    generateCode: (vars, config, fileInfo, processingSteps) => generateOLSStataCode(vars, config, fileInfo, processingSteps)
});

window.OLS = { calculate: calculateOLS };