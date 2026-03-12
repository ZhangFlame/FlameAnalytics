/**
 * =========================================================
 * IV - 2SLS 工具变量法模块
 * BY张张 | 强制输出稳健标准误以符合高端学术规范
 * =========================================================
 */

const calculateIV = (yName, endogName, zNames, cNames, data) => {
    const allVars = [yName, endogName, ...zNames, ...cNames];
    const cleanData = MatrixUtils.cleanData(data, allVars);
    const n = cleanData.length;

    if (n < allVars.length + 5) throw new Error("样本量严重不足，无法进行 2SLS 估计");

    const Y = cleanData.map(r => [parseFloat(r[yName])]);
    const X_en = cleanData.map(r => [parseFloat(r[endogName])]);
    const C = cleanData.map(r => cNames.map(c => parseFloat(r[c])));
    const Z = cleanData.map(r => zNames.map(z => parseFloat(r[z])));

    const Z_inst = cleanData.map((_, i) => [1, ...(C[i] || []), ...(Z[i] || [])]);
    const Z_T = MatrixUtils.transpose(Z_inst);
    const ZZ_inv = MatrixUtils.invert(MatrixUtils.multiply(Z_T, Z_inst));
    const Pi = MatrixUtils.multiply(ZZ_inv, MatrixUtils.multiply(Z_T, X_en));
    const X_en_hat = MatrixUtils.multiply(Z_inst, Pi);

    const X_r = cleanData.map((_, i) => [1, ...(C[i] || [])]);
    const Xr_T = MatrixUtils.transpose(X_r);
    const beta_r = MatrixUtils.multiply(MatrixUtils.invert(MatrixUtils.multiply(Xr_T, X_r)), MatrixUtils.multiply(Xr_T, X_en));
    const pred_r = MatrixUtils.multiply(X_r, beta_r);
    const rss_r = X_en.reduce((sum, y, i) => sum + Math.pow(y[0] - pred_r[i][0], 2), 0);

    const pred_u = X_en_hat;
    const rss_u = X_en.reduce((sum, y, i) => sum + Math.pow(y[0] - pred_u[i][0], 2), 0);
    const fStat1 = ((rss_r - rss_u) / zNames.length) / (rss_u / (n - 1 - cNames.length - zNames.length));

    const X_hat = cleanData.map((_, i) => [1, ...(C[i] || []), X_en_hat[i][0]]);
    const Xh_T = MatrixUtils.transpose(X_hat);
    const XhXh_inv = MatrixUtils.invert(MatrixUtils.multiply(Xh_T, X_hat));
    const Beta_iv = MatrixUtils.multiply(XhXh_inv, MatrixUtils.multiply(Xh_T, Y));

    const X_real = cleanData.map((_, i) => [1, ...(C[i] || []), X_en[i][0]]);
    const Y_pred_real = MatrixUtils.multiply(X_real, Beta_iv);
    const residuals = Y.map((y, i) => [y[0] - Y_pred_real[i][0]]);

    const rss = residuals.reduce((sum, r) => sum + r[0] * r[0], 0);
    const k2 = cNames.length + 1;

    // IV 使用 Huber-White 稳健标准误
    const meat = Array(k2 + 1).fill(0).map(() => Array(k2 + 1).fill(0));
    for (let i = 0; i < n; i++) {
        const e2 = residuals[i][0] * residuals[i][0];
        for (let r = 0; r <= k2; r++) {
            for (let c = 0; c <= k2; c++) {
                meat[r][c] += X_hat[i][r] * X_hat[i][c] * e2;
            }
        }
    }
    let varCovar = MatrixUtils.multiply(MatrixUtils.multiply(XhXh_inv, meat), XhXh_inv);
    const df_r = n / (n - k2 - 1);
    varCovar = varCovar.map(row => row.map(v => v * df_r));

    const coefs = {};
    const varNamesStage2 = ['_cons', ...cNames, endogName];

    for (let i = 0; i < varNamesStage2.length; i++) {
        const b = Beta_iv[i][0];
        const se = Math.sqrt(Math.max(0, varCovar[i][i]));
        const t = b / se;
        const p = MatrixUtils.tProb(t, n - k2 - 1);
        coefs[varNamesStage2[i]] = { coef: b, se: se, t: t, p: p };
    }

    return { coefs, n, fStat1, rss };
};

const generateIVStataCode = (vars, config, fileInfo, processingSteps) => {
    const { y, x, z, c } = vars;
    const { fileName = 'dataset.dta', fileEncoding = 'utf8' } = fileInfo || {};
    const fileExt = fileName.split('.').pop().toLowerCase();

    let stY = MatrixUtils.cleanStataName(y);
    let stX = x.map(v => MatrixUtils.cleanStataName(v)).join(' ');
    let stZ = z.map(v => MatrixUtils.cleanStataName(v)).join(' ');
    let stC = c.map(v => MatrixUtils.cleanStataName(v)).join(' ');

    let processStr = processingSteps && processingSteps.length > 0 ? processingSteps.join('\n') + '\n' : '';

    let code = `* ============================================\n* 自动生成的 Stata 代码（一键运行版本）\n* 模型: 工具变量法 2SLS\n* ============================================\n\n`;
    code += `* 步骤1: 载入数据\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    if (processStr) code += `* 数据预处理\n${processStr}\n`;

    code += `* 步骤2: 工具变量法 2SLS 估计\n`;
    code += `* (1) 第一阶段：检验弱工具变量\n`;
    code += `reg ${stX} ${stZ} ${stC}\n`;
    code += `test ${stZ}\n\n`;

    code += `* (2) 第二阶段：执行 2SLS 回归\n`;
    code += `ivregress 2sls ${stY} ${stC} (${stX} = ${stZ}), robust\n`;
    code += `estadd local cluster "稳健"\n`;
    code += `est store iv_model\n\n`;

    code += `* 步骤3: 导出结果\n`;
    code += `esttab iv_model using "results.rtf", replace ///\n`;
    code += `    prehead("{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}} \\margl720\\margr720\\margt720\\margb720") ///\n`;
    code += `    b(%9.4f) se(%9.4f) star(* 0.1 ** 0.05 *** 0.01) compress nogaps nomtitles nonotes ///\n`;
    code += `    stats(cluster N, labels("标准误类型" "观测值") fmt(%s %9.0fc)) ///\n`;
    code += `    addnotes("注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为稳健标准误") ///\n`;
    code += `    title("表: IV-2SLS 回归结果")\n`;

    return code;
};

ModelRegistry.register({
    id: 'iv',
    category: 'econometrics',
    name: '两阶段最小二乘法',
    slots: [
        { key: 'y', label: '被解释变量 Y', type: 'single', tagType: 'y' },
        { key: 'x', label: '内生变量 X', type: 'multiple', tagType: 'x', max: 1 },
        { key: 'z', label: '外生变量 Z', type: 'multiple', tagType: 'z' },
        { key: 'c', label: '控制变量 C', type: 'multiple', tagType: 'c' }
    ],
    extraConfigs: [], // 无额外配置，无需分组
    formulaComponent: {
        props: ['formValues'],
        template: `
            <div>
                <div style="font-size: 16px; margin-bottom: 8px;">
                    第一阶段: <span class="math-var">{{ formValues.x?.[0] || 'Endog_X' }}</span> = π<sub style="font-size:10px">0</sub>
                    <span v-for="(z, idx) in formValues.z" :key="'fz'+idx">+ π<sub style="font-size:10px">{{idx+1}}</sub><span class="math-var">{{ z }}</span></span>
                    <span v-if="formValues.c && formValues.c.length > 0">+ θ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + ν
                </div>
                <div style="font-size: 16px;">
                    第二阶段: <span class="math-var">{{ formValues.y || 'Y' }}</span> = β<sub style="font-size:10px">0</sub> 
                    + β<sub style="font-size:10px">1</sub><span class="math-var">{{ formValues.x?.[0] || 'Endog_X' }}</span><sup style="font-size:10px;color:#fbbf24;">(IV_hat)</sup>
                    <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + ε
                </div>
            </div>
        `
    },
    resultComponent: {
        props: ['results', 'formValues', 'formatters'],
        template: `
            <div style="width: 100%;">
                <div class="stat-summary">
                    <span>2SLS 工具变量回归</span>
                    <span>观测值 (N): <strong>{{ results.n }}</strong></span>
                    <span>
                        <span style="color:#64748b;">第一阶段 F检验值(测弱工具):</span> 
                        <strong :style="{ color: results.fStat1 > 10 ? '#059669' : '#dc2626'}">{{ results.fStat1?.toFixed(2) }}</strong> 
                        <span v-if="results.fStat1 > 10" style="color: #059669;">(>10, 拒绝弱IV)</span>
                    </span>
                </div>
                <table class="academic-table">
                    <caption>表1. 工具变量法 (2SLS) 第二阶段参数估计结果</caption>
                    <thead>
                        <tr class="top-line header-sub">
                            <th class="text-left">变量名称</th>
                            <th>因变量 (Y): {{ formValues.y }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(val, v) in results.coefs" :key="v">
                            <td class="var-name">{{ v }}</td>
                            <td>
                                <div class="coef-block">
                                    <span :class="{'color-pos': val.coef > 0, 'color-neg': val.coef < 0}">{{ formatters.formatCoefDirect(val) }}</span>
                                    <span class="se-text">({{ val.se.toFixed(4) }})</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="bottom-line">
                            <td class="text-left">标准误/聚类</td>
                            <td>稳健</td>
                        </tr>
                        <tr>
                            <td class="text-left">外生控制组 (C)</td>
                            <td>Yes</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="font-size: 13px; color: #64748b; margin: 8px auto 0; max-width: 950px; text-align: left; padding-left: 10px;">
                    注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为稳健标准误。
                </div>
            </div>
        `
    },
    validate: (vars) => vars.y && vars.x && vars.x.length === 1 && vars.z && vars.z.length > 0,
    run: (vars, data, config) => calculateIV(vars.y, vars.x[0], vars.z, vars.c, data),
    generateCode: (vars, config, fileInfo, processingSteps) => generateIVStataCode(vars, config, fileInfo, processingSteps)
});