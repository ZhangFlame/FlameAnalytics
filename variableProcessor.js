/**
 * =========================================================
 * 变量处理引擎 - 支持取对数、缩尾、标准化等原地突变操作
 * BY张张 | 独立封装，便于维护与复用
 * =========================================================
 */

(function() {
    // 从全局 Vue 中获取 ref
    const { ref } = Vue;

    // 核心状态
    const activeToOriginalMap = ref({}); // 映射关系：[处理后的变量名] -> [原始变量名]
    const processingCmds = ref({});      // 代码历史：[原始变量名] -> [{stata: '...', python: '...'}]
    const appliedProcessing = ref({});   // UI展示：[当前变量名] -> [处理按钮上显示的三个字]

    // 处理类型对应的中文名
    const methodNames = {
        log: '取对数',
        log1: '加一取对数',
        winsor: '缩尾处理',
        lag: '滞后一期',
        std: '标准化',
        center: '中心化',
        diff: '一阶差分'
    };

    // 依赖容器（由外部通过 setDeps 注入）
    let deps = null;

    /**
     * 设置外部依赖（必须在调用 processVar 前执行）
     * @param {Object} externalDeps - 包含以下字段的对象：
     *   - rawData: ref (原始数据数组)
     *   - originalRawData: ref (原始数据深拷贝)  // 注意：现在是 ref
     *   - variables: ref (变量名列表)
     *   - extraConfigs: ref (额外配置，如 entityVar)
     *   - hasResult: ref (是否有计算结果)
     *   - runAnalysis: Function (重新运行分析)
     *   - generateStataCode: Function (重新生成代码)
     *   - updateSlots: Function (更新槽位变量名)
     *   - cleanStataName: Function (清洗变量名)
     */
    const setDeps = (externalDeps) => {
        deps = externalDeps;
    };

    /**
     * 计算缩尾分位数
     * @private
     */
    const getQuantiles = (rawData, currentVarName) => {
        const vals = rawData.value
            .map(r => parseFloat(r[currentVarName]))
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);
        return {
            p1: vals.length ? vals[Math.floor(vals.length * 0.01)] : 0,
            p99: vals.length ? vals[Math.floor(vals.length * 0.99)] : 0
        };
    };

    /**
     * 核心处理函数：对指定变量执行突变操作
     * @param {string} currentVarName - 当前变量名
     * @param {string} method - 操作类型：log/log1/winsor/lag/std/center/diff/restore
     */
    const processVar = (currentVarName, method) => {
        if (!deps) {
            console.error('VariableProcessor: 依赖未设置，请先调用 setDeps');
            return;
        }

        const {
            rawData,
            originalRawData,  // 现在是 ref
            variables,
            extraConfigs,
            hasResult,
            runAnalysis,
            generateStataCode,
            updateSlots,
            cleanStataName
        } = deps;

        let origName = currentVarName;
        // 追溯该变量的最原始户口本
        for (const [k, v] of Object.entries(activeToOriginalMap.value)) {
            if (k === currentVarName) origName = v;
        }

        // ----- 还原操作 -----
        if (method === 'restore') {
            if (origName === currentVarName) return; // 没处理过，无需还原

            // 从深拷贝矩阵中恢复数据（注意：originalRawData 现在是 ref，需通过 .value 获取数组）
            const originalArray = originalRawData.value;
            rawData.value.forEach((row, i) => {
                row[origName] = originalArray[i][origName];
                if (origName !== currentVarName) delete row[currentVarName];
            });
            rawData.value = [...rawData.value]; // 强制 Vue 响应式刷新

            const idx = variables.value.indexOf(currentVarName);
            if (idx !== -1) variables.value.splice(idx, 1, origName);
            updateSlots(currentVarName, origName);

            // 清理痕迹
            delete activeToOriginalMap.value[origName];
            delete activeToOriginalMap.value[currentVarName];
            delete appliedProcessing.value[origName];
            delete appliedProcessing.value[currentVarName];

            const newCmds = { ...processingCmds.value };
            delete newCmds[origName];
            processingCmds.value = newCmds;

            ElementPlus.ElMessage.success(`✅ 已还原变量至初始状态：${origName}`);
            if (hasResult.value) {
                runAnalysis();
            } else {
                generateStataCode();
            }
            return;
        }

        // ----- 突变计算 -----
        let newName = '';
        let stataCmd = '';
        let pyCmd = '';

        if (!activeToOriginalMap.value[currentVarName]) {
            activeToOriginalMap.value[currentVarName] = currentVarName;
            origName = currentVarName;
        }

        const q = method === 'winsor' ? getQuantiles(rawData, currentVarName) : null;

        // 计算均值和标准差（标准化/中心化使用）
        let meanVal = 0,
            stdVal = 0;
        if (method === 'std' || method === 'center') {
            const vals = rawData.value
                .map(r => parseFloat(r[currentVarName]))
                .filter(v => !isNaN(v));
            if (vals.length > 0) {
                meanVal = vals.reduce((a, b) => a + b, 0) / vals.length;
                stdVal = Math.sqrt(
                    vals.reduce((sq, n) => sq + Math.pow(n - meanVal, 2), 0) /
                        (vals.length - 1)
                );
            }
        }

        rawData.value.forEach((row, index) => {
            const x = parseFloat(row[currentVarName]);
            const sOld = cleanStataName(currentVarName);

            if (method === 'log') {
                if (index === 0) {
                    newName = `ln_${currentVarName}`;
                    stataCmd = `gen ${cleanStataName(newName)} = ln(${sOld})`;
                    pyCmd = `df['${newName}'] = np.log(df['${currentVarName}'])`;
                }
                row[newName] = isNaN(x) || x <= 0 ? null : Math.log(x);
            } else if (method === 'log1') {
                if (index === 0) {
                    newName = `ln1_${currentVarName}`;
                    stataCmd = `gen ${cleanStataName(newName)} = ln(${sOld} + 1)`;
                    pyCmd = `df['${newName}'] = np.log(df['${currentVarName}'] + 1)`;
                }
                row[newName] = isNaN(x) || x <= -1 ? null : Math.log(x + 1);
            } else if (method === 'winsor') {
                if (index === 0) {
                    newName = `w_${currentVarName}`;
                    stataCmd = `* 提示：需安装 winsor2: ssc install winsor2\nwinsor2 ${sOld}, generate(${cleanStataName(newName)}) cuts(1 99)`;
                    pyCmd = `from scipy.stats.mstats import winsorize\ndf['${newName}'] = winsorize(df['${currentVarName}'], limits=[0.01, 0.01])`;
                }
                row[newName] = isNaN(x) ? null : (x < q.p1 ? q.p1 : x > q.p99 ? q.p99 : x);
            } else if (method === 'std') {
                if (index === 0) {
                    newName = `Z_${currentVarName}`;
                    stataCmd = `egen ${cleanStataName(newName)} = std(${sOld})`;
                    pyCmd = `df['${newName}'] = (df['${currentVarName}'] - df['${currentVarName}'].mean()) / df['${currentVarName}'].std()`;
                }
                row[newName] = isNaN(x) ? null : (x - meanVal) / stdVal;
            } else if (method === 'center') {
                if (index === 0) {
                    newName = `C_${currentVarName}`;
                    stataCmd = `sum ${sOld}\ngen ${cleanStataName(newName)} = ${sOld} - r(mean)`;
                    pyCmd = `df['${newName}'] = df['${currentVarName}'] - df['${currentVarName}'].mean()`;
                }
                row[newName] = isNaN(x) ? null : x - meanVal;
            } else if (method === 'lag') {
                if (index === 0) {
                    newName = `L_${currentVarName}`;
                    stataCmd = `* 需确保面板已 xtset\ngen ${cleanStataName(newName)} = L.${sOld}`;
                    pyCmd = extraConfigs.value.entityVar
                        ? `df['${newName}'] = df.groupby('${extraConfigs.value.entityVar}')['${currentVarName}'].shift(1)`
                        : `df['${newName}'] = df['${currentVarName}'].shift(1)`;
                }
                if (index === 0) {
                    row[newName] = null;
                } else {
                    const prevRow = rawData.value[index - 1];
                    row[newName] =
                        extraConfigs.value.entityVar &&
                        row[extraConfigs.value.entityVar] !== prevRow[extraConfigs.value.entityVar]
                            ? null
                            : prevRow[currentVarName];
                }
            } else if (method === 'diff') {
                if (index === 0) {
                    newName = `D_${currentVarName}`;
                    stataCmd = `* 需确保面板已 xtset\ngen ${cleanStataName(newName)} = D.${sOld}`;
                    pyCmd = extraConfigs.value.entityVar
                        ? `df['${newName}'] = df.groupby('${extraConfigs.value.entityVar}')['${currentVarName}'].diff(1)`
                        : `df['${newName}'] = df['${currentVarName}'].diff(1)`;
                }
                if (index === 0) {
                    row[newName] = null;
                } else {
                    const prevRow = rawData.value[index - 1];
                    row[newName] =
                        extraConfigs.value.entityVar &&
                        row[extraConfigs.value.entityVar] !== prevRow[extraConfigs.value.entityVar]
                            ? null
                            : isNaN(x) || isNaN(parseFloat(prevRow[currentVarName]))
                            ? null
                            : x - parseFloat(prevRow[currentVarName]);
                }
            }
            // 剔除旧变量
            delete row[currentVarName];
        });

        rawData.value = [...rawData.value]; // 强制刷新表格

        // 保存映射状态
        activeToOriginalMap.value[newName] = origName;
        delete activeToOriginalMap.value[currentVarName];

        appliedProcessing.value[newName] = methodNames[method];
        delete appliedProcessing.value[currentVarName];

        // 保存代码历史
        const newCmds = { ...processingCmds.value };
        if (!newCmds[origName]) newCmds[origName] = [];
        newCmds[origName].push({ stata: stataCmd, python: pyCmd });
        processingCmds.value = newCmds;

        // 替换左侧列表变量名
        const idx = variables.value.indexOf(currentVarName);
        if (idx !== -1) {
            variables.value.splice(idx, 1, newName);
        }
        updateSlots(currentVarName, newName);

        ElementPlus.ElMessage.success(`✅ 变量已更名为：${newName}，运算公式与底层代码已同步更新！`);

        // 如果处于分析状态，则立即重新执行计算
        if (hasResult.value) {
            runAnalysis();
        } else {
            generateStataCode();
        }
    };

    // 暴露给外部使用的接口
    window.VariableProcessor = {
        activeToOriginalMap,
        processingCmds,
        appliedProcessing,
        setDeps,
        processVar
    };
})();