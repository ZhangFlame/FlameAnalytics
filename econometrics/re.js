/**
 * =========================================================
 * RE (面板随机效应模型) 回归分析模块 - 大刊通用版
 * =========================================================
 */

const generateREStataCode = (vars, config, fileInfo, processingSteps) => {
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

    let code = `* ============================================\n* 自动生成的 Stata 代码（大刊随机效应递进矩阵）\n* ============================================\n\n`;
    if (fileExt === 'csv') code += `import delimited "${fileName}", encoding("${fileEncoding}") clear\n\n`;
    else if (fileExt === 'xlsx' || fileExt === 'xls') code += `import excel "${fileName}", firstrow clear\n\n`;
    else code += `use "${fileName}", clear\n\n`;

    code += `* 步骤2: 面板维度识别与处理\n`;

    // --- 核心修复：_rc 状态缓存，防止跳行报错 ---
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

    code += `xtset \`panel_id' ${stYear ? stYear : ''}\n`;

    if (processingSteps && processingSteps.length > 0) code += `\n* 预处理\n${processingSteps.join('\n')}\n\n`;

    code += `* 步骤3: 渐进式随机效应回归分析\n`;
    let models = [];

    code += `xtreg ${stY} ${stX}, re\nestadd local cluster "无"\nestadd local fe_entity "Yes"\nestadd local fe_time "No"\nest store m1\n`;
    models.push('m1');

    if (stCluster) {
        code += `xtreg ${stY} ${stX}, re vce(cluster \`cluster_id')\nestadd local cluster "${clusterVar}"\nestadd local fe_entity "Yes"\nestadd local fe_time "No"\nest store m2\n`;
        models.push('m2');
    } else {
        code += `xtreg ${stY} ${stX}, re vce(robust)\nestadd local cluster "稳健"\nestadd local fe_entity "Yes"\nestadd local fe_time "No"\nest store m2\n`;
        models.push('m2');
    }

    if (safeC.length > 0) {
        code += `xtreg ${stY} ${stX} ${stC}, re\nestadd local cluster "无"\nestadd local fe_entity "Yes"\nestadd local fe_time "No"\nest store m3\n`;
        models.push('m3');

        if (stCluster) {
            code += `xtreg ${stY} ${stX} ${stC}, re vce(cluster \`cluster_id')\nestadd local cluster "${clusterVar}"\nestadd local fe_entity "Yes"\nestadd local fe_time "No"\nest store m4\n`;
            models.push('m4');
        } else {
            code += `xtreg ${stY} ${stX} ${stC}, re vce(robust)\nestadd local cluster "稳健"\nestadd local fe_entity "Yes"\nestadd local fe_time "No"\nest store m4\n`;
            models.push('m4');
        }

        if (stYear) {
            code += `* 引入时间效应 (RE模型中通常作为虚拟变量加入)\n`;
            code += `xtreg ${stY} ${stX} ${stC} i.${stYear}, re\nestadd local cluster "无"\nestadd local fe_entity "Yes"\nestadd local fe_time "Yes"\nest store m5\n`;
            models.push('m5');

            if (stCluster) {
                code += `xtreg ${stY} ${stX} ${stC} i.${stYear}, re vce(cluster \`cluster_id')\nestadd local cluster "${clusterVar}"\nestadd local fe_entity "Yes"\nestadd local fe_time "Yes"\nest store m6\n`;
                models.push('m6');
            } else {
                code += `xtreg ${stY} ${stX} ${stC} i.${stYear}, re vce(robust)\nestadd local cluster "稳健"\nestadd local fe_entity "Yes"\nestadd local fe_time "Yes"\nest store m6\n`;
                models.push('m6');
            }
        }
    }

    code += `\n* 步骤4: 导出结果\n`;
    code += `esttab ${models.join(' ')} using "results_re.rtf", replace ///\n`;
    code += `    prehead(\`"{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}} \\margl720\\margr720\\margt720\\margb720"') ///\n`;
    code += `    b(%9.4f) se(%9.4f) star(* 0.1 ** 0.05 *** 0.01) ///\n`;
    code += `    compress nogaps nomtitles nonotes ///\n`;
    code += `    stats(cluster N fe_entity fe_time, labels("聚类层面" "观测值" "个体效应" "时间效应") fmt(%s %9.0fc %s %s)) ///\n`;
    code += `    addnotes("注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为相应的标准误") ///\n`;
    code += `    title("表3: 面板随机效应 (RE) 回归结果")\n`;

    return code;
};

ModelRegistry.register({
    id: 're',
    category: 'econometrics',
    name: 'RE 面板随机效应模型',
    slots: [
        { key: 'y', label: '被解释变量 Y', type: 'single', tagType: 'y' },
        { key: 'x', label: '核心自变量 X', type: 'multiple', tagType: 'x' },
        { key: 'c', label: '控制变量 C', type: 'multiple', tagType: 'c' }
    ],
    extraConfigs: [
        { key: 'entityVar', label: '个体标识', type: 'select', group: 'panel', optional: false },
        { key: 'yearVar', label: '时间标识', type: 'select', group: 'panel', optional: true },
        { key: 'clusterVar', label: '聚类层面', type: 'select', group: 'panel', optional: true }
    ],
    formulaComponent: {
        props: ['formValues'],
        template: `
            <div>
                <span class="math-var">{{ formValues.y || 'Y' }}</span> = α 
                <span v-for="(x, idx) in formValues.x" :key="'fx'+idx">+ β<sub style="font-size: 12px">{{idx+1}}</sub><span class="math-var">{{ x }}</span></span>
                <span v-if="formValues.c && formValues.c.length > 0">+ γ<span class="formula-sigma">Σ</span><span class="math-var">Controls</span></span>
                + <span class="formula-fe-tag">μ<sub style="font-size:10px">i</sub></span>+ <span class="formula-fe-tag">λ<sub style="font-size:10px">t</sub></span> + ε
            </div>
        `
    },
    resultComponent: {
        props: ['results', 'formValues', 'extraConfigs', 'allVars', 'formatters'],
        template: `
            <div style="width: 100%;">
                <table class="academic-table">
                    <caption>表1. RE 随机效应阶梯回归矩阵</caption>
                    <thead>
                        <tr class="top-line">
                            <th rowspan="2" class="text-left">变量</th>
                            <th>(1)</th><th v-if="results.m2">(2)</th>
                            <th v-if="results.m3">(3)</th><th v-if="results.m4">(4)</th>
                            <th v-if="results.m5">(5)</th><th v-if="results.m6">(6)</th>
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
                        </tr>
                        <tr><td class="var-name">_cons</td>
                            <td><div class="coef-block"><span>{{ formatters.formatConst(results.m1) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m1) }}</span></div></td>
                            <td v-if="results.m2"><div class="coef-block"><span>{{ formatters.formatConst(results.m2) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m2) }}</span></div></td>
                            <td v-if="results.m3"><div class="coef-block"><span>{{ formatters.formatConst(results.m3) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m3) }}</span></div></td>
                            <td v-if="results.m4"><div class="coef-block"><span>{{ formatters.formatConst(results.m4) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m4) }}</span></div></td>
                            <td v-if="results.m5"><div class="coef-block"><span>{{ formatters.formatConst(results.m5) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m5) }}</span></div></td>
                            <td v-if="results.m6"><div class="coef-block"><span>{{ formatters.formatConst(results.m6) }}</span><span class="se-text">{{ formatters.formatConstSE(results.m6) }}</span></div></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="bottom-line"><td class="text-left">标准误/聚类</td><td>普通</td><td v-if="results.m2">{{ extraConfigs.clusterVar || '稳健' }}</td><td v-if="results.m3">普通</td><td v-if="results.m4">{{ extraConfigs.clusterVar || '稳健' }}</td><td v-if="results.m5">普通</td><td v-if="results.m6">{{ extraConfigs.clusterVar || '稳健' }}</td></tr>
                        <tr><td class="text-left">个体效应</td><td>RE</td><td v-if="results.m2">RE</td><td v-if="results.m3">RE</td><td v-if="results.m4">RE</td><td v-if="results.m5">RE</td><td v-if="results.m6">RE</td></tr>
                        <tr><td class="text-left">时间效应</td><td>No</td><td v-if="results.m2">No</td><td v-if="results.m3">No</td><td v-if="results.m4">No</td><td v-if="results.m5">{{ extraConfigs.yearVar ? 'Yes' : 'No' }}</td><td v-if="results.m6">{{ extraConfigs.yearVar ? 'Yes' : 'No' }}</td></tr>
                        <tr><td class="text-left">观测值 (N)</td><td>{{results.m1?.n}}</td><td v-if="results.m2">{{results.m2?.n}}</td><td v-if="results.m3">{{results.m3?.n}}</td><td v-if="results.m4">{{results.m4?.n}}</td><td v-if="results.m5">{{results.m5?.n}}</td><td v-if="results.m6">{{results.m6?.n}}</td></tr>
                    </tfoot>
                </table>
                <div style="font-size: 13px; color: #64748b; margin: 8px auto 0; max-width: 950px; text-align: left; padding-left: 10px;">注：***、**、*分别表示在1%、5%、10%的水平上显著；括号内为普通标准误或稳健标准误。</div>
            </div>
        `
    },
    validate: (vars, config) => vars.y && vars.x.length > 0 && config.entityVar,
    run: (vars, data, config) => {
        const { y, x, c } = vars;
        const safeX = x.filter(v => v !== config.entityVar && v !== config.yearVar);
        const safeC = c.filter(v => v !== config.entityVar && v !== config.yearVar);
        const allX = [...safeX, ...safeC];

        let m1 = runMiniReghdfe(y, safeX, data, [], 'ordinary', config.clusterVar);
        let m2 = runMiniReghdfe(y, safeX, data, [], config.clusterVar ? 'cluster' : 'robust', config.clusterVar);
        let m3 = null, m4 = null, m5 = null, m6 = null;

        if (safeC.length > 0) {
            m3 = runMiniReghdfe(y, allX, data, [], 'ordinary', config.clusterVar);
            m4 = runMiniReghdfe(y, allX, data, [], config.clusterVar ? 'cluster' : 'robust', config.clusterVar);
            if (config.yearVar) {
                m5 = runMiniReghdfe(y, allX, data, [config.yearVar], 'ordinary', config.clusterVar);
                m6 = runMiniReghdfe(y, allX, data, [config.yearVar], config.clusterVar ? 'cluster' : 'robust', config.clusterVar);
            }
        } else if (config.yearVar) {
            m5 = runMiniReghdfe(y, safeX, data, [config.yearVar], 'ordinary', config.clusterVar);
            m6 = runMiniReghdfe(y, safeX, data, [config.yearVar], config.clusterVar ? 'cluster' : 'robust', config.clusterVar);
        }
        return { m1, m2, m3, m4, m5, m6 };
    },
    generateCode: (vars, config, fileInfo, processingSteps) => generateREStataCode(vars, config, fileInfo, processingSteps)
});