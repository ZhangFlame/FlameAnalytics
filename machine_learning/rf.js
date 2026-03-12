/**
 * =========================================================
 * Machine Learning 模块 - 随机森林 (Random Forest)
 * BY张张 | 支持分类 (Classification) 与 回归 (Regression)
 * 完美还原 Scikit-learn 超参数体系与标准可视化
 * =========================================================
 */
(function () {
    // === 内部统计与数学工具 ===
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr => { if (arr.length <= 1) return 0; const m = mean(arr); return arr.reduce((sq, n) => sq + Math.pow(n - m, 2), 0) / arr.length; };
    const mse = (yTrue, yPred) => yTrue.reduce((sum, y, i) => sum + Math.pow(y - yPred[i], 2), 0) / yTrue.length;
    const mae = (yTrue, yPred) => yTrue.reduce((sum, y, i) => sum + Math.abs(y - yPred[i]), 0) / yTrue.length;
    const r2 = (yTrue, yPred) => { const varTotal = variance(yTrue) * yTrue.length; const resTotal = yTrue.reduce((sum, y, i) => sum + Math.pow(y - yPred[i], 2), 0); return varTotal === 0 ? 0 : 1 - (resTotal / varTotal); };
    
    // 分类专用工具 (Gini不纯度与众数投票)
    const gini = arr => {
        if (arr.length === 0) return 0;
        const counts = {};
        for(let v of arr) counts[v] = (counts[v] || 0) + 1;
        let impurity = 1;
        for(let k in counts) { let prob = counts[k] / arr.length; impurity -= prob * prob; }
        return impurity;
    };
    const mode = arr => {
        const counts = {}; let max = 0; let res = arr[0];
        for(let v of arr) { counts[v] = (counts[v] || 0) + 1; if(counts[v] > max) { max = counts[v]; res = v; } }
        return res;
    };
    const accuracy = (yTrue, yPred) => yTrue.filter((y, i) => String(y) === String(yPred[i])).length / yTrue.length;

    // === 决策树核心引擎 ===
    class DecisionTree {
        constructor(taskType = 'regression', maxDepth = 5, minSamplesSplit = 2, minSamplesLeaf = 1, maxFeatures = 'sqrt') {
            this.taskType = taskType;
            this.maxDepth = maxDepth;
            this.minSamplesSplit = minSamplesSplit;
            this.minSamplesLeaf = minSamplesLeaf;
            this.maxFeatures = maxFeatures;
            this.tree = null;
            this.featureImportances = {};
        }

        fit(X, y, featureNames) {
            featureNames.forEach(f => this.featureImportances[f] = 0);
            this.tree = this._buildTree(X, y, 0);
        }

        _buildTree(X, y, depth) {
            const n = y.length;
            const currentImpurity = this.taskType === 'regression' ? variance(y) : gini(y);
            const leafValue = this.taskType === 'regression' ? mean(y) : mode(y);

            if ((this.maxDepth && depth >= this.maxDepth) || n < this.minSamplesSplit || currentImpurity === 0) {
                return { isLeaf: true, value: leafValue };
            }

            let bestSplit = null;
            let minImpurity = Infinity;
            const p = X[0].length;

            let featuresToTry = [];
            for(let j = 0; j < p; j++) featuresToTry.push(j);
            if (this.maxFeatures === 'sqrt') {
                const numF = Math.max(1, Math.floor(Math.sqrt(p)));
                featuresToTry = featuresToTry.sort(() => 0.5 - Math.random()).slice(0, numF);
            } else if (this.maxFeatures === 'log2') {
                const numF = Math.max(1, Math.floor(Math.log2(p)));
                featuresToTry = featuresToTry.sort(() => 0.5 - Math.random()).slice(0, numF);
            }

            for (let j of featuresToTry) {
                const thresholds = [...new Set(X.map(row => row[j]))].sort((a, b) => a - b);
                for (let i = 0; i < thresholds.length - 1; i++) {
                    const threshold = (thresholds[i] + thresholds[i + 1]) / 2;
                    let leftY = [], rightY = [];
                    for (let k = 0; k < n; k++) {
                        if (X[k][j] <= threshold) leftY.push(y[k]); else rightY.push(y[k]);
                    }
                    
                    if (leftY.length < this.minSamplesLeaf || rightY.length < this.minSamplesLeaf) continue;
                    
                    let currImp;
                    if (this.taskType === 'regression') currImp = (leftY.length * variance(leftY) + rightY.length * variance(rightY)) / n;
                    else currImp = (leftY.length * gini(leftY) + rightY.length * gini(rightY)) / n;

                    if (currImp < minImpurity) {
                        minImpurity = currImp;
                        bestSplit = { featureIdx: j, threshold: threshold, leftX: [], leftY: [], rightX: [], rightY: [] };
                    }
                }
            }

            if (!bestSplit) return { isLeaf: true, value: leafValue };

            const impurityReduction = currentImpurity - minImpurity;

            for (let k = 0; k < n; k++) {
                if (X[k][bestSplit.featureIdx] <= bestSplit.threshold) {
                    bestSplit.leftX.push(X[k]); bestSplit.leftY.push(y[k]);
                } else {
                    bestSplit.rightX.push(X[k]); bestSplit.rightY.push(y[k]);
                }
            }

            return {
                isLeaf: false, featureIdx: bestSplit.featureIdx, impurityReduction: impurityReduction * n,
                threshold: bestSplit.threshold,
                left: this._buildTree(bestSplit.leftX, bestSplit.leftY, depth + 1),
                right: this._buildTree(bestSplit.rightX, bestSplit.rightY, depth + 1)
            };
        }

        _predictOne(x, node) {
            if (node.isLeaf) return node.value;
            if (x[node.featureIdx] <= node.threshold) return this._predictOne(x, node.left);
            else return this._predictOne(x, node.right);
        }

        predict(X) { return X.map(x => this._predictOne(x, this.tree)); }

        _accumulateImportance(node, featureNames) {
            if (node.isLeaf) return;
            this.featureImportances[featureNames[node.featureIdx]] += node.impurityReduction;
            this._accumulateImportance(node.left, featureNames);
            this._accumulateImportance(node.right, featureNames);
        }
    }

    // === 随机森林组合引擎 (支持真实 OOB 计算) ===
    class RandomForest {
        constructor(taskType = 'regression', nTrees = 100, maxDepth = null, minSamplesSplit = 2, minSamplesLeaf = 1, maxFeatures = 'sqrt', bootstrap = true, oobScore = true) {
            this.taskType = taskType; this.nTrees = nTrees; this.maxDepth = maxDepth;
            this.minSamplesSplit = minSamplesSplit; this.minSamplesLeaf = minSamplesLeaf;
            this.maxFeatures = maxFeatures; this.bootstrap = bootstrap; this.oobScore = oobScore;
        }

        fit(X, y, featureNames) {
            this.trees = [];
            this.importances = {};
            featureNames.forEach(f => this.importances[f] = 0);

            const n = X.length;
            this.oobPredictions = Array(n).fill(null).map(() => []);

            for (let t = 0; t < this.nTrees; t++) {
                const sampleX = []; const sampleY = [];
                const inSample = new Set();
                
                if (this.bootstrap) {
                    for (let i = 0; i < n; i++) {
                        const idx = Math.floor(Math.random() * n);
                        sampleX.push(X[idx]); sampleY.push(y[idx]);
                        inSample.add(idx);
                    }
                } else {
                    for (let i = 0; i < n; i++) { sampleX.push(X[i]); sampleY.push(y[i]); inSample.add(i); }
                }

                const tree = new DecisionTree(this.taskType, this.maxDepth, this.minSamplesSplit, this.minSamplesLeaf, this.maxFeatures);
                tree.fit(sampleX, sampleY, featureNames);
                tree._accumulateImportance(tree.tree, featureNames);

                if (this.bootstrap && this.oobScore) {
                    for (let i = 0; i < n; i++) {
                        if (!inSample.has(i)) this.oobPredictions[i].push(tree._predictOne(X[i], tree.tree));
                    }
                }

                for (let f of featureNames) this.importances[f] += tree.featureImportances[f];
                this.trees.push(tree);
            }

            if (this.bootstrap && this.oobScore) {
                let validOobYTrue = [], validOobYPred = [];
                for (let i = 0; i < n; i++) {
                    if (this.oobPredictions[i].length > 0) {
                        validOobYTrue.push(y[i]);
                        if (this.taskType === 'regression') validOobYPred.push(mean(this.oobPredictions[i]));
                        else validOobYPred.push(mode(this.oobPredictions[i]));
                    }
                }
                if (validOobYTrue.length > 0) {
                    if (this.taskType === 'regression') this.oobScoreVal = r2(validOobYTrue, validOobYPred);
                    else this.oobScoreVal = accuracy(validOobYTrue, validOobYPred);
                } else this.oobScoreVal = null;
            } else {
                this.oobScoreVal = null;
            }

            const sumImp = Object.values(this.importances).reduce((a, b) => a + b, 0) || 1;
            for (let f in this.importances) this.importances[f] = (this.importances[f] / sumImp) * 100;
            return this.importances;
        }

        predict(X) {
            const predictions = this.trees.map(t => t.predict(X));
            if (this.taskType === 'regression') return X.map((_, i) => mean(predictions.map(preds => preds[i])));
            else return X.map((_, i) => mode(predictions.map(preds => preds[i])));
        }
    }

    // ==========================================
    // 注册模型 (接入 Vue UI)
    // ==========================================
    ModelRegistry.register({
        id: 'random_forest',
        category: 'machine_learning',
        name: '随机森林回归/分类',
        slots: [
            { key: 'y', label: '目标变量 Y', type: 'single', tagType: 'y' },
            { key: 'x', label: '特征变量 X (多选)', type: 'multiple', tagType: 'x' }
        ],
        extraConfigs: [
            { type: 'title', label: '⚙️ 核心任务与结构' },
            { key: 'taskType', label: '模型任务类型', type: 'select', options: [ {label:'回归任务', value:'regression'}, {label:'分类任务', value:'classification'} ], default: 'regression' },
            { key: 'nTrees', label: '决策树数量', type: 'input', default: 100 },
            { key: 'maxDepth', label: '最大深度 (留空不限)', type: 'input', default: '' },
            { key: 'maxFeatures', label: '特征采样', type: 'select', options: [ {label:'sqrt (特征数平方根)', value:'sqrt'}, {label:'log2', value:'log2'}, {label:'None (全部特征)', value:'None'} ], default: 'sqrt' },

            { type: 'title', label: '🌳 树节点剪枝' },
            { key: 'minSamplesSplit', label: '分裂所需最小样本', type: 'input', default: 2 },
            { key: 'minSamplesLeaf', label: '叶节点最少样本', type: 'input', default: 1 },

            { type: 'title', label: '🎲 采样与评估验证' },
            { key: 'bootstrap', label: '使用自助采样', type: 'switch', default: true },
            { key: 'oobScore', label: '计算袋外得分', type: 'switch', default: true },
            { key: 'testSize', label: '测试集划分比例', type: 'select', options: [ { label: '8:2 (测试集20%)', value: '0.2' }, { label: '7:3 (测试集30%)', value: '0.3' }, { label: '9:1 (测试集10%)', value: '0.1' } ], default: '0.2' }
        ],
        formulaComponent: {
            props: ['formValues', 'extraConfigs'],
            template: `
                <div style="font-size: 20px;">
                    <span class="math-var">{{ formValues.y || 'Y' }}</span> = 
                    <span style="font-weight:bold; color: #10b981; margin: 0 4px;">{{ extraConfigs.taskType === 'classification' ? 'RandomForestClassifier' : 'RandomForestRegressor' }}</span>(
                    <span v-for="(x, idx) in formValues.x" :key="x">
                        <span class="math-var">{{ x }}</span><span v-if="idx < formValues.x.length - 1" style="color:white;">, </span>
                    </span>
                    <span v-if="!formValues.x || formValues.x.length === 0" style="color: #94a3b8; font-style: italic;"> Features... </span>
                    )
                </div>
            `
        },
        validate: (vars) => vars.y && vars.x && vars.x.length > 0,
        run: (vars, data, config) => {
            const { y, x } = vars;
            const taskType = config.taskType || 'regression';
            const testSize = parseFloat(config.testSize || '0.2');
            
            const nTrees = parseInt(config.nTrees) || 100;
            const maxDepth = config.maxDepth ? parseInt(config.maxDepth) : null;
            const minSamplesSplit = parseInt(config.minSamplesSplit) || 2;
            const minSamplesLeaf = parseInt(config.minSamplesLeaf) || 1;

            let cleanData = MatrixUtils.cleanData(data, [y, ...x]);

            const shuffled = [...cleanData].sort(() => 0.5 - Math.random());
            const splitIdx = Math.floor(shuffled.length * (1 - testSize));
            const trainData = shuffled.slice(0, splitIdx);
            const testData = shuffled.slice(splitIdx);

            if (trainData.length === 0 || testData.length === 0) throw new Error('训练集或测试集为空，请检查数据量。');

            const X_train = trainData.map(r => x.map(f => parseFloat(r[f])));
            const y_train = trainData.map(r => taskType === 'regression' ? parseFloat(r[y]) : String(r[y]));
            const X_test = testData.map(r => x.map(f => parseFloat(r[f])));
            const y_test = testData.map(r => taskType === 'regression' ? parseFloat(r[y]) : String(r[y]));

            const model = new RandomForest(taskType, nTrees, maxDepth, minSamplesSplit, minSamplesLeaf, config.maxFeatures, config.bootstrap, config.oobScore);
            const rawImportances = model.fit(X_train, y_train, x);
            const oobScoreVal = model.oobScoreVal;
            const y_pred = model.predict(X_test);

            const sortedImportances = Object.entries(rawImportances)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            let metrics = { trainN: trainData.length, testN: testData.length };
            let scatterPoints = [];
            let minVal = 0, maxVal = 0;
            let classReport = null;

            if (taskType === 'regression') {
                metrics.mse = mse(y_test, y_pred).toFixed(4);
                metrics.mae = mae(y_test, y_pred).toFixed(4);
                metrics.r2 = r2(y_test, y_pred).toFixed(4);
                scatterPoints = y_test.map((actual, i) => [actual, y_pred[i]]);
                minVal = Math.min(...y_test, ...y_pred);
                maxVal = Math.max(...y_test, ...y_pred);
            } else {
                metrics.accuracy = (accuracy(y_test, y_pred)).toFixed(4);
                const classes = [...new Set(y_test)].sort();
                classReport = [];
                classes.forEach(c => {
                    let tp = 0, fp = 0, fn = 0;
                    for(let i=0; i<y_test.length; i++) {
                        if (y_test[i] === c && y_pred[i] === c) tp++;
                        if (y_test[i] !== c && y_pred[i] === c) fp++;
                        if (y_test[i] === c && y_pred[i] !== c) fn++;
                    }
                    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
                    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
                    const f1 = precision + recall === 0 ? 0 : 2 * (precision * recall) / (precision + recall);
                    const support = tp + fn;
                    classReport.push({ class: c, precision: precision.toFixed(4), recall: recall.toFixed(4), f1: f1.toFixed(4), support });
                });
            }

            return {
                taskType, importances: sortedImportances,
                scatterPoints, minVal, maxVal,
                metrics, n: cleanData.length,
                y_test, y_pred, oobScoreVal, classReport
            };
        },
        resultComponent: {
            props: ['results'],
            data() { return { impChart: null, scatterChart: null }; },
            computed: {
                predictionTable() {
                    if (!this.results || !this.results.y_test || !this.results.y_pred) return [];
                    const actuals = this.results.y_test.slice(0, 10);
                    const preds = this.results.y_pred.slice(0, 10);
                    return actuals.map((a, i) => ({ actual: a, predicted: preds[i] }));
                }
            },
            mounted() {
                this.renderCharts();
                this.$watch('results', this.renderCharts, { deep: true });
                this._resizeHandler = () => {
                    if (this.impChart) this.impChart.resize();
                    if (this.scatterChart) this.scatterChart.resize();
                };
                window.addEventListener('resize', this._resizeHandler);
            },
            beforeDestroy() {
                window.removeEventListener('resize', this._resizeHandler);
                if (this.impChart) { this.impChart.dispose(); this.impChart = null; }
                if (this.scatterChart) { this.scatterChart.dispose(); this.scatterChart = null; }
            },
            methods: {
                renderCharts() {
                    this.$nextTick(() => {
                        if (!this.results) return;

                        if (this.$refs.importanceChart) {
                            if (!this.impChart) this.impChart = window.echarts.init(this.$refs.importanceChart);
                            const yAxisData = this.results.importances.map(f => f.name).reverse();
                            const seriesData = this.results.importances.map(f => f.value.toFixed(2)).reverse();
                            const impOption = {
                                title: { text: '随机森林特征重要性', left: 'center', textStyle: { fontSize: 16 } },
                                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                                grid: { left: '3%', right: '15%', bottom: '10%', top: '22%', containLabel: true },
                                xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { formatter: '{value}%' } },
                                yAxis: { type: 'category', data: yAxisData, axisTick: { show: false }, axisLabel: { fontWeight: 'bold' } },
                                series: [{
                                    name: '重要性', type: 'bar', data: seriesData,
                                    itemStyle: { color: '#2563eb', borderRadius: [0, 4, 4, 0] },
                                    label: { show: true, position: 'right', formatter: '{c}%' }
                                }]
                            };
                            this.impChart.setOption(impOption, true); 
                        }

                        if (this.results.taskType === 'regression') {
                            if (this.$refs.scatterChart) {
                                if (!this.scatterChart) this.scatterChart = window.echarts.init(this.$refs.scatterChart);
                                const lineData = [[this.results.minVal, this.results.minVal], [this.results.maxVal, this.results.maxVal]];
                                const scatterOption = {
                                    title: { text: '随机森林回归: 真实值 vs 预测值', left: 'center', textStyle: { fontSize: 16 } },
                                    tooltip: { trigger: 'item', formatter: '真实值: {c[0]}<br/>预测值: {c[1]}' },
                                    grid: { left: '10%', right: '10%', bottom: '10%', top: '22%', containLabel: true },
                                    xAxis: { name: '真实值', type: 'value', scale: true },
                                    yAxis: { name: '预测值', type: 'value', scale: true },
                                    series: [
                                        {
                                            name: '散点', type: 'scatter', data: this.results.scatterPoints,
                                            itemStyle: { color: 'transparent', borderColor: '#475569', borderWidth: 1, opacity: 0.6 }
                                        },
                                        {
                                            name: '理想拟合线', type: 'line', data: lineData,
                                            lineStyle: { color: '#ef4444', type: 'dashed', width: 2 }, symbol: 'none'
                                        }
                                    ]
                                };
                                this.scatterChart.setOption(scatterOption, true);
                            }
                        } else {
                            if (this.scatterChart) {
                                this.scatterChart.dispose();
                                this.scatterChart = null;
                            }
                        }
                    });
                }
            },
            template: `
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding: 10px 0;">
                    
                    <table class="academic-table" style="margin-bottom: 25px; width: 100%; max-width: 850px;">
                        <caption>{{ results.taskType === 'regression' ? '回归' : '分类' }}模型评估 (测试集)</caption>
                        <thead>
                            <tr v-if="results.taskType === 'regression'">
                                <th>解释度 (R²)</th><th>均方误差 (MSE)</th><th>平均绝对误差 (MAE)</th><th v-if="results.oobScoreVal !== null">袋外得分 (OOB)</th><th>训练集/测试集</th>
                            </tr>
                            <tr v-else>
                                <th>测试集准确率 (Accuracy)</th><th v-if="results.oobScoreVal !== null">袋外得分 (OOB)</th><th>训练集/测试集</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="results.taskType === 'regression'">
                                <td style="color: #10b981; font-weight: bold; font-size: 16px;">{{ results.metrics.r2 }}</td>
                                <td>{{ results.metrics.mse }}</td>
                                <td>{{ results.metrics.mae }}</td>
                                <td v-if="results.oobScoreVal !== null">{{ results.oobScoreVal.toFixed(4) }}</td>
                                <td>{{ results.metrics.trainN }} / {{ results.metrics.testN }}</td>
                            </tr>
                            <tr v-else>
                                <td style="color: #10b981; font-weight: bold; font-size: 16px;">{{ results.metrics.accuracy }}</td>
                                <td v-if="results.oobScoreVal !== null">{{ results.oobScoreVal.toFixed(4) }}</td>
                                <td>{{ results.metrics.trainN }} / {{ results.metrics.testN }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div v-if="results.taskType === 'classification'" style="width: 100%; max-width: 850px; margin-bottom: 25px;">
                        <table class="academic-table" style="font-size: 14px;">
                            <caption>分类报告 (Classification Report)</caption>
                            <thead>
                                <tr><th>类别 (Class)</th><th>精确率 (Precision)</th><th>召回率 (Recall)</th><th>F1-Score</th><th>样本数 (Support)</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in results.classReport" :key="row.class">
                                    <td style="font-weight: bold;">{{ row.class }}</td>
                                    <td>{{ row.precision }}</td>
                                    <td>{{ row.recall }}</td>
                                    <td>{{ row.f1 }}</td>
                                    <td>{{ row.support }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style="width: 100%; max-width: 900px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-bottom: 20px;">
                        <div ref="importanceChart" style="flex: 1; min-width: 400px; height: 380px; background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                        <div v-if="results.taskType === 'regression'" ref="scatterChart" style="flex: 1; min-width: 400px; height: 380px; background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                    </div>

                    <div style="margin-top: 10px; width: 100%; max-width: 900px; overflow-x: auto;">
                        <table class="academic-table" style="font-size: 13px;">
                            <caption>测试集预测抽样（前10条）</caption>
                            <thead>
                                <tr><th>样本序号</th><th>真实值 (Actual)</th><th>模型预测值 (Predicted)</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, idx) in predictionTable" :key="idx">
                                    <td>{{ idx + 1 }}</td>
                                    <td>{{ typeof item.actual === 'number' ? item.actual.toFixed(4) : item.actual }}</td>
                                    <td>{{ typeof item.predicted === 'number' ? item.predicted.toFixed(4) : item.predicted }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style="font-size: 13px; color: #64748b; background: #f8fafc; padding: 12px 16px; border-radius: 6px; width: 100%; max-width: 900px; border-left: 4px solid #3b82f6; line-height: 1.6; margin-top: 25px; text-align: left;">
                        <strong>💡 张张温馨提示：</strong>网页端基于纯 JS 引擎进行计算，受限于浏览器单线程算力，此处结果仅供参考与效果预览。为了处理大体量全量数据、获得绝对最高精度，并生成高水平的期刊插图，请务必点击右侧「分析代码」，一键复制完整的 Python 脚本至本地环境运行验证！
                    </div>

                </div>
            `
        },
        generateCode: (vars, config, fileInfo, processingSteps) => {
            const { fileName = 'dataset.csv' } = fileInfo || {};
            const { y, x } = vars;
            
            const taskType = config.taskType || 'regression';
            const testSize = config.testSize || '0.2';
            const nTrees = config.nTrees || 100;
            const maxDepth = config.maxDepth ? config.maxDepth : 'None';
            const minSamplesSplit = config.minSamplesSplit || 2;
            const minSamplesLeaf = config.minSamplesLeaf || 1;
            const maxFeaturesStr = config.maxFeatures === 'None' ? 'None' : `'${config.maxFeatures}'`;
            const bootstrapStr = config.bootstrap ? 'True' : 'False';
            const oobScoreStr = config.oobScore ? 'True' : 'False';

            let code = `# ============================================\n`;
            code += `# 随机森林${taskType === 'regression' ? '回归' : '分类'}分析 (Scikit-Learn)\n`;
            code += `# ============================================\n\n`;

            code += `import numpy as np\n`;
            code += `import pandas as pd\n`;
            code += `import matplotlib.pyplot as plt\n`;
            
            if (taskType === 'classification') {
                code += `from sklearn.ensemble import RandomForestClassifier\n`;
                code += `from sklearn.model_selection import train_test_split\n`;
                code += `from sklearn.metrics import accuracy_score, classification_report, confusion_matrix\n\n`;
            } else {
                code += `from sklearn.ensemble import RandomForestRegressor\n`;
                code += `from sklearn.model_selection import train_test_split\n`;
                code += `from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error\n\n`;
            }

            code += `# 设置中文字体\n`;
            code += `plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']\n`;
            code += `plt.rcParams['axes.unicode_minus'] = False\n\n`;

            code += `# 1. 加载并清洗数据\n`;
            code += `df = pd.read_csv(r"${fileName}")\n`;
            code += `features = [${x.map(v => `"${v}"`).join(', ')}]\n`;
            code += `target = "${y}"\n`;
            code += `df = df.dropna(subset=features + [target])\n\n`;

            code += `# 2. 划分训练集和测试集\n`;
            code += `X = df[features]\n`;
            code += `y = df[target]\n`;
            code += `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=${testSize}, random_state=42)\n\n`;

            code += `# 3. 创建随机森林模型\n`;
            if (taskType === 'classification') {
                code += `rf = RandomForestClassifier(\n`;
            } else {
                code += `rf = RandomForestRegressor(\n`;
            }
            code += `    n_estimators=${nTrees},          # 决策树数量\n`;
            code += `    max_depth=${maxDepth},           # 树的最大深度 (None表示不限制)\n`;
            code += `    min_samples_split=${minSamplesSplit},     # 节点分裂所需最小样本数\n`;
            code += `    min_samples_leaf=${minSamplesLeaf},      # 叶节点最小样本数\n`;
            code += `    max_features=${maxFeaturesStr},       # 每次分裂考虑的特征数\n`;
            code += `    bootstrap=${bootstrapStr},         # 是否使用自助采样\n`;
            code += `    oob_score=${oobScoreStr},         # 是否计算袋外得分\n`;
            code += `    n_jobs=-1               # 并行计算 (-1表示使用所有CPU核)\n`;
            code += `)\n\n`;

            code += `# 4. 训练模型\n`;
            code += `rf.fit(X_train, y_train)\n\n`;

            code += `# 5. 预测与评估\n`;
            code += `y_pred = rf.predict(X_test)\n`;
            
            code += `print("=" * 50)\n`;
            code += `print("随机森林${taskType === 'regression' ? '回归' : '分类'}结果")\n`;
            code += `print("=" * 50)\n`;

            if (taskType === 'classification') {
                code += `print(f"\\n测试集准确率: {accuracy_score(y_test, y_pred):.4f}")\n`;
                if (config.oobScore) code += `print(f"袋外得分(OOB): {rf.oob_score_:.4f}")\n`;
                code += `print("\\n分类报告:")\n`;
                code += `print(classification_report(y_test, y_pred))\n\n`;
            } else {
                code += `print(f"\\nR² 分数: {r2_score(y_test, y_pred):.4f}")\n`;
                code += `print(f"均方误差(MSE): {mean_squared_error(y_test, y_pred):.4f}")\n`;
                code += `print(f"平均绝对误差(MAE): {mean_absolute_error(y_test, y_pred):.4f}")\n`;
                if (config.oobScore) code += `print(f"袋外得分(OOB): {rf.oob_score_:.4f}")\n\n`;
            }

            code += `# 6. 特征重要性排序\n`;
            code += `importances = rf.feature_importances_\n`;
            code += `indices = np.argsort(importances)[::-1]\n\n`;
            code += `print("\\n特征重要性排名:")\n`;
            code += `for i, idx in enumerate(indices):\n`;
            code += `    print(f"  {i+1}. {features[idx]}: {importances[idx]:.4f}")\n\n`;

            if (taskType === 'classification') {
                code += `# 7. 可视化特征重要性 (分类风格)\n`;
                code += `plt.figure(figsize=(10, 6))\n`;
                code += `colors = plt.cm.viridis(np.linspace(0.2, 0.8, len(importances)))\n`;
                code += `plt.bar(range(len(importances)), importances[indices], color=colors)\n`;
                code += `plt.xticks(range(len(importances)), [features[i] for i in indices], rotation=45)\n`;
                code += `plt.xlabel('特征', fontsize=12)\n`;
                code += `plt.ylabel('重要性', fontsize=12)\n`;
                code += `plt.title('随机森林特征重要性', fontsize=14)\n`;
                code += `plt.tight_layout()\n`;
                code += `plt.savefig('rf_feature_importance.png', dpi=150, bbox_inches='tight')\n`;
                code += `plt.show()\n`;
            } else {
                code += `# 7. 可视化预测结果 (回归散点风格)\n`;
                code += `plt.figure(figsize=(10, 6))\n`;
                code += `plt.scatter(y_test, y_pred, alpha=0.6, edgecolors='k', linewidth=0.5)\n`;
                code += `plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)\n`;
                code += `plt.xlabel('真实值', fontsize=12)\n`;
                code += `plt.ylabel('预测值', fontsize=12)\n`;
                code += `plt.title('随机森林回归: 真实值 vs 预测值', fontsize=14)\n`;
                code += `plt.grid(True, alpha=0.3)\n`;
                code += `plt.tight_layout()\n`;
                code += `plt.savefig('rf_regression.png', dpi=150, bbox_inches='tight')\n`;
                code += `plt.show()\n`;
            }

            return code;
        }
    });
})();