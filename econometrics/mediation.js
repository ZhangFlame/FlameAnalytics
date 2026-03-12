/**
 * =========================================================
 * 中介效应与调节效应分析模块 (Mediation & Moderation)
 * =========================================================
 */

const calculateMediation = (yName, xName, mName, controls, data) => {
    const allVars = [yName, xName, mName, ...controls];
    const cleanData = MatrixUtils.cleanData(data, allVars);

    const step1 = window.OLS.calculate(yName, [xName, ...controls], cleanData, 'ordinary');
    const step2 = window.OLS.calculate(mName, [xName, ...controls], cleanData, 'ordinary');
    const step3 = window.OLS.calculate(yName, [xName, mName, ...controls], cleanData, 'ordinary');

    const a = step2.coefs[xName].coef;
    const sa = step2.coefs[xName].se;
    const b = step3.coefs[mName].coef;
    const sb = step3.coefs[mName].se;

    const sab = Math.sqrt(a * a * sb * sb + b * b * sa * sa);
    const sobelZ = sab === 0 ? 0 : (a * b) / sab;
    const sobelP = 2 * (1 - window.MatrixUtils.tProb(Math.abs(sobelZ), 999999));

    return { step1, step2, step3, n: cleanData.length, sobel: { z: sobelZ, p: sobelP } };
};

const calculateModeration = (yName, xName, wName, controls, data) => {
    const allVars = [yName, xName, wName, ...controls];
    const cleanData = MatrixUtils.cleanData(data, allVars);

    const xMean = MatrixUtils.mean(cleanData.map(r => parseFloat(r[xName])));
    const wMean = MatrixUtils.mean(cleanData.map(r => parseFloat(r[wName])));

    const modData = cleanData.map(row => {
        const newRow = { ...row };
        const xc = parseFloat(row[xName]) - xMean;
        const wc = parseFloat(row[wName]) - wMean;
        newRow[`${xName}_c`] = xc;
        newRow[`${wName}_c`] = wc;
        newRow[`Inter_X_W`] = xc * wc;
        return newRow;
    });

    const m1 = window.OLS.calculate(yName, [xName, wName, ...controls], cleanData, 'ordinary');
    const m2 = window.OLS.calculate(yName, [`${xName}_c`, `${wName}_c`, `Inter_X_W`, ...controls], modData, 'ordinary');

    return { m1, m2, n: cleanData.length, xNameC: `${xName}_c`, wNameC: `${wName}_c`, interName: `Inter_X_W` };
};

const generateMediationStataCode = (vars, config, fileInfo, processingSteps) => {
    const { y, x, m, c } = vars;
    const { fileName = 'dataset.dta', fileEncoding = 'utf8' } = fileInfo || {};
    const fileExt = fileName.split('.').pop().toLowerCase();

    let stY = MatrixUtils.cleanStataName(y);
    let stX = x.map(v => MatrixUtils.cleanStataName(v)).join(' ');
    let stM = MatrixUtils.cleanStataName(m);
    let stC = c.map(v => MatrixUtils.cleanStataName(v)).join(' ');

    let processStr = processingSteps && processingSteps.length > 0 ? processingSteps.join('\n') + '\n' : '';

    let code = `* ============================================\n* 自动生成的 Stata 代码\n* 模型: 中介效应检验 (Mediation)\n* ============================================\n\n`;
    code += `* 步骤1: 载入数据\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    if (processStr) code += `* 数据预处理\n${processStr}\n`;

    code += `* 步骤2: 逐步回归法\n`;
    code += `reg ${stY} ${stX} ${stC}\nestadd local cluster "无"\nest store step1\n\n`;
    code += `reg ${stM} ${stX} ${stC}\nestadd local cluster "无"\nest store step2\n\n`;
    code += `reg ${stY} ${stX} ${stM} ${stC}\nestadd local cluster "无"\nest store step3\n\n`;

    code += `* 步骤3: 导出逐步回归结果\n`;
    code += `esttab step1 step2 step3 using "results_mediation.rtf", replace ///\n`;
    code += `    prehead("{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}} \\margl720\\margr720\\margt720\\margb720") ///\n`;
    code += `    b(%9.4f) se(%9.4f) star(* 0.1 ** 0.05 *** 0.01) compress nogaps nomtitles nonotes ///\n`;
    code += `    stats(cluster N, labels("标准误类型" "观测值") fmt(%s %9.0fc)) ///\n`;
    code += `    addnotes("注：***、**、*分别表示在1%、5%、10%的水平上显著") title("表: 中介效应")\n\n`;

    code += `* 步骤4: Sobel 检验\ncapture sgmediation2 ${stY}, mv(${stM}) iv(${stX}) cv(${stC})\n`;
    return code;
};

const generateModerationStataCode = (vars, config, fileInfo, processingSteps) => {
    const { y, x, w, c } = vars;
    const { fileName = 'dataset.dta', fileEncoding = 'utf8' } = fileInfo || {};
    const fileExt = fileName.split('.').pop().toLowerCase();

    let stY = MatrixUtils.cleanStataName(y);
    let stX = x.map(v => MatrixUtils.cleanStataName(v)).join(' ');
    let stW = MatrixUtils.cleanStataName(w);
    let stC = c.map(v => MatrixUtils.cleanStataName(v)).join(' ');

    let processStr = processingSteps && processingSteps.length > 0 ? processingSteps.join('\n') + '\n' : '';

    let code = `* ============================================\n* 自动生成的 Stata 代码\n* 模型: 调节效应检验 (Moderation)\n* ============================================\n\n`;
    code += `* 步骤1: 载入数据\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    if (processStr) code += `* 数据预处理\n${processStr}\n`;

    code += `* 步骤2: 变量中心化与构建交乘项\n`;
    code += `sum ${stX}\ngen ${stX}_c = ${stX} - r(mean)\n`;
    code += `sum ${stW}\ngen ${stW}_c = ${stW} - r(mean)\n`;
    code += `gen Inter_X_W = ${stX}_c * ${stW}_c\n\n`;

    code += `* 步骤3: 回归分析\n`;
    code += `reg ${stY} ${stX} ${stW} ${stC}\nestadd local cluster "无"\nest store base_mod\n\n`;
    code += `reg ${stY} ${stX}_c ${stW}_c Inter_X_W ${stC}\nestadd local cluster "无"\nest store interact_mod\n\n`;

    code += `* 步骤4: 导出结果\n`;
    code += `esttab base_mod interact_mod using "results_moderation.rtf", replace ///\n`;
    code += `    prehead("{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}} \\margl720\\margr720\\margt720\\margb720") ///\n`;
    code += `    b(%9.4f) se(%9.4f) star(* 0.1 ** 0.05 *** 0.01) compress nogaps nomtitles nonotes ///\n`;
    code += `    stats(cluster N, labels("标准误类型" "观测值") fmt(%s %9.0fc)) ///\n`;
    code += `    addnotes("注：***、**、*分别表示在1%、5%、10%的水平上显著") title("表: 调节效应")\n`;
    return code;
};

ModelRegistry.register({
    id: 'mediation',
    category: 'econometrics',
    name: '中介效应检验',
    slots: [
        { key: 'y', label: '被解释变量 Y', type: 'single', tagType: 'y' },
        { key: 'x', label: '解释变量 X', type: 'multiple', tagType: 'x', max: 1 },
        { key: 'm', label: '中介变量 M', type: 'single', tagType: 'm' },
        { key: 'c', label: '控制变量 C', type: 'multiple', tagType: 'c' }
    ],
    extraConfigs: [], // 无额外配置，无需分组
    formulaComponent: {
        props: ['formValues'],
        template: `
            <div>
                <div style="font-size: 16px; margin-bottom: 6px;">方程1 (总效应): <span class="math-var">{{ formValues.y || 'Y' }}</span> = c<span class="math-var">{{ formValues.x?.[0] || 'X' }}</span> <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + e<sub style="font-size:10px">1</sub></div>
                <div style="font-size: 16px; margin-bottom: 6px;">方程2 (对中介): <span class="math-var">{{ formValues.m || 'M' }}</span> = a<span class="math-var">{{ formValues.x?.[0] || 'X' }}</span> <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + e<sub style="font-size:10px">2</sub></div>
                <div style="font-size: 16px;">方程3 (直接项): <span class="math-var">{{ formValues.y || 'Y' }}</span> = c'<span class="math-var">{{ formValues.x?.[0] || 'X' }}</span> + b<span class="math-var">{{ formValues.m || 'M' }}</span> <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + e<sub style="font-size:10px">3</sub></div>
            </div>
        `
    },
    resultComponent: {
        props: ['results', 'formValues', 'formatters'],
        template: `
            <div style="width: 100%;">
                <div class="stat-summary"><span>逐步回归与 Sobel 中介效应检验</span><span>观测值 (N): <strong>{{ results.n }}</strong></span></div>
                <table class="academic-table">
                    <caption>表1. 因果逐步分析估计结果</caption>
                    <thead>
                        <tr class="top-line">
                            <th rowspan="2" class="text-left">输入池</th>
                            <th>模型(1) 总效应</th><th>模型(2) 中介机制</th><th>模型(3) 直接效应</th>
                        </tr>
                        <tr class="header-sub">
                            <th>{{ formValues.y }}</th><th>{{ formValues.m }}</th><th>{{ formValues.y }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="var-name">{{ formValues.x[0] }}</td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.step1.coefs[formValues.x[0]].coef > 0}">{{ formatters.formatCoef(results.step1, formValues.x[0]) }}</span><span class="se-text">{{ formatters.formatSE(results.step1, formValues.x[0]) }}</span></div></td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.step2.coefs[formValues.x[0]].coef > 0}">{{ formatters.formatCoef(results.step2, formValues.x[0]) }}</span><span class="se-text">{{ formatters.formatSE(results.step2, formValues.x[0]) }}</span></div></td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.step3.coefs[formValues.x[0]].coef > 0}">{{ formatters.formatCoef(results.step3, formValues.x[0]) }}</span><span class="se-text">{{ formatters.formatSE(results.step3, formValues.x[0]) }}</span></div></td>
                        </tr>
                        <tr>
                            <td class="var-name">{{ formValues.m }}</td><td>-</td><td>-</td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.step3.coefs[formValues.m].coef > 0}">{{ formatters.formatCoef(results.step3, formValues.m) }}</span><span class="se-text">{{ formatters.formatSE(results.step3, formValues.m) }}</span></div></td>
                        </tr>
                        <tr>
                            <td class="var-name">_cons</td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.step1) }}</span><span class="se-text">{{ formatters.formatConstSE(results.step1) }}</span></div></td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.step2) }}</span><span class="se-text">{{ formatters.formatConstSE(results.step2) }}</span></div></td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.step3) }}</span><span class="se-text">{{ formatters.formatConstSE(results.step3) }}</span></div></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="bottom-line"><td class="text-left">标准误/聚类</td><td>普通</td><td>普通</td><td>普通</td></tr>
                        <tr><td class="text-left">控制组 (C)</td><td>{{ formValues.c.length ? 'Yes' : 'No' }}</td><td>{{ formValues.c.length ? 'Yes' : 'No' }}</td><td>{{ formValues.c.length ? 'Yes' : 'No' }}</td></tr>
                    </tfoot>
                </table>
                <div style="font-size: 13px; color: #64748b; margin: 8px auto 0; max-width: 950px; text-align: left; padding-left: 10px;">注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为普通标准误。</div>
                <div class="stat-summary" style="margin-top: 20px; border-left: 4px solid var(--primary); justify-content:flex-start;">
                    <span><strong style="color:#0f172a">Sobel 检验 (中介效应显著性评判):</strong></span>
                    <span>Z 值 = <strong>{{ results.sobel?.z.toFixed(4) }}</strong></span>
                    <span>P 值 = <strong>{{ results.sobel?.p.toFixed(4) }}</strong></span>
                    <span v-if="results.sobel?.p < 0.05" style="color: var(--success); font-weight: bold;">(拒绝原假设，存在中介效应)</span>
                    <span v-else style="color: var(--danger); font-weight: bold;">(未能证明中介效应)</span>
                </div>
            </div>
        `
    },
    validate: (vars) => vars.y && vars.x && vars.x.length === 1 && vars.m,
    run: (vars, data) => calculateMediation(vars.y, vars.x[0], vars.m, vars.c, data),
    generateCode: (vars, config, fileInfo, processingSteps) => generateMediationStataCode(vars, config, fileInfo, processingSteps)
});

ModelRegistry.register({
    id: 'moderation',
    category: 'econometrics',
    name: '调节效应检验',
    slots: [
        { key: 'y', label: '被解释变量 Y', type: 'single', tagType: 'y' },
        { key: 'x', label: '解释变量 X', type: 'multiple', tagType: 'x', max: 1 },
        { key: 'w', label: '调节变量 W', type: 'single', tagType: 'w' },
        { key: 'c', label: '控制变量 C', type: 'multiple', tagType: 'c' }
    ],
    extraConfigs: [], // 无额外配置，无需分组
    formulaComponent: {
        props: ['formValues'],
        template: `
            <div>
                <span class="math-var">{{ formValues.y || 'Y' }}</span> = α 
                + β<sub style="font-size:10px">1</sub><span class="math-var">{{ formValues.x?.[0] || 'X' }}</span> 
                + β<sub style="font-size:10px">2</sub><span class="math-var">{{ formValues.w || 'W' }}</span> 
                + β<sub style="font-size:10px">3</sub>(<span class="math-var">{{ formValues.x?.[0] || 'X' }}</span>×<span class="math-var">{{ formValues.w || 'W' }}</span>)
                <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span> + ε
            </div>
        `
    },
    resultComponent: {
        props: ['results', 'formValues', 'formatters'],
        template: `
            <div style="width: 100%;">
                <div class="stat-summary"><span>中心化调节效应估计模型</span><span>观测值 (N): <strong>{{ results.n }}</strong></span></div>
                <table class="academic-table">
                    <caption>表1. 交互作用调节回归结果 (变量已中心化)</caption>
                    <thead>
                        <tr class="top-line">
                            <th rowspan="2" class="text-left">自变量集合</th>
                            <th>模型(1) 基准拟合</th><th>模型(2) 交互作用注入</th>
                        </tr>
                        <tr class="header-sub">
                            <th>因变量: {{ formValues.y }}</th><th>因变量: {{ formValues.y }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="var-name">{{ formValues.x[0] }}</td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.m1.coefs[formValues.x[0]].coef > 0}">{{ formatters.formatCoef(results.m1, formValues.x[0]) }}</span><span class="se-text">{{ formatters.formatSE(results.m1, formValues.x[0]) }}</span></div></td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.m2.coefs[results.xNameC].coef > 0}">{{ formatters.formatCoef(results.m2, results.xNameC) }}</span><span class="se-text">{{ formatters.formatSE(results.m2, results.xNameC) }}</span></div></td>
                        </tr>
                        <tr>
                            <td class="var-name">{{ formValues.w }}</td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.m1.coefs[formValues.w].coef > 0}">{{ formatters.formatCoef(results.m1, formValues.w) }}</span><span class="se-text">{{ formatters.formatSE(results.m1, formValues.w) }}</span></div></td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.m2.coefs[results.wNameC].coef > 0}">{{ formatters.formatCoef(results.m2, results.wNameC) }}</span><span class="se-text">{{ formatters.formatSE(results.m2, results.wNameC) }}</span></div></td>
                        </tr>
                        <tr style="background-color: #fffbeb;">
                            <td class="var-name">交乘项 (X * W)</td><td>-</td>
                            <td><div class="coef-block"><span :class="{'color-pos': results.m2.coefs[results.interName].coef > 0}">{{ formatters.formatCoef(results.m2, results.interName) }}</span><span class="se-text">{{ formatters.formatSE(results.m2, results.interName) }}</span></div></td>
                        </tr>
                        <tr>
                            <td class="var-name">_cons</td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.m1) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m1) }}</span></div></td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.m2) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m2) }}</span></div></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="bottom-line"><td class="text-left">标准误/聚类</td><td>普通</td><td>普通</td></tr>
                        <tr><td class="text-left">控制组 (Controls)</td><td>{{ formValues.c.length ? 'Yes' : 'No' }}</td><td>{{ formValues.c.length ? 'Yes' : 'No' }}</td></tr>
                        <tr><td class="text-left">R² 解释力</td><td>{{ results.m1.r2 }}</td><td>{{ results.m2.r2 }}</td></tr>
                    </tfoot>
                </table>
                <div style="font-size: 13px; color: #64748b; margin: 8px auto 0; max-width: 950px; text-align: left; padding-left: 10px;">注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为普通标准误。</div>
            </div>
        `
    },
    validate: (vars) => vars.y && vars.x && vars.x.length === 1 && vars.w,
    run: (vars, data) => calculateModeration(vars.y, vars.x[0], vars.w, vars.c, data),
    generateCode: (vars, config, fileInfo, processingSteps) => generateModerationStataCode(vars, config, fileInfo, processingSteps)
});

window.MedMod = { calculateMediation, calculateModeration };