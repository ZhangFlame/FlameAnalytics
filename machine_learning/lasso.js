/**
 * =========================================================
 * Machine Learning 模块 - Lasso 特征选择与回归
 * BY张张 | 内置原生 JavaScript LassoCV 交叉验证自动寻优
 * =========================================================
 */
(function () {
    // 内部工具函数
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr => { if(arr.length <= 1) return 0; const m = mean(arr); return arr.reduce((sq, n) => sq + Math.pow(n - m, 2), 0) / arr.length; };
    const mse = (yTrue, yPred) => yTrue.reduce((sum, y, i) => sum + Math.pow(y - yPred[i], 2), 0) / yTrue.length;
    const r2 = (yTrue, yPred) => { const varTotal = variance(yTrue) * yTrue.length; const resTotal = yTrue.reduce((sum, y, i) => sum + Math.pow(y - yPred[i], 2), 0); return varTotal === 0 ? 0 : 1 - (resTotal / varTotal); };

    // 软阈值函数
    const softThreshold = (rho, lambda) => {
        if (rho < -lambda) return rho + lambda;
        if (rho > lambda) return rho - lambda;
        return 0;
    };

    // 优化的坐标下降法引擎
    const fitCoordinateDescent = (X_std, y_cen, alpha, maxIter, tol, w_init) => {
        const n = X_std.length;
        const p = X_std[0].length;
        let w = w_init ? [...w_init] : Array(p).fill(0);
        
        let r = [...y_cen];
        for (let i = 0; i < n; i++) {
            let pred = 0;
            for (let j = 0; j < p; j++) pred += w[j] * X_std[i][j];
            r[i] -= pred;
        }

        for (let iter = 0; iter < maxIter; iter++) {
            let maxDiff = 0;
            for (let j = 0; j < p; j++) {
                let old_wj = w[j];
                let rho_j = 0;
                for (let i = 0; i < n; i++) {
                    rho_j += X_std[i][j] * (r[i] + old_wj * X_std[i][j]);
                }
                w[j] = softThreshold(rho_j / n, alpha);
                let diff = w[j] - old_wj;
                if (diff !== 0) {
                    for (let i = 0; i < n; i++) r[i] -= diff * X_std[i][j];
                    maxDiff = Math.max(maxDiff, Math.abs(diff));
                }
            }
            if (maxDiff < tol) break;
        }
        return w;
    };

    ModelRegistry.register({
        id: 'lasso',
        category: 'machine_learning',
        name: 'Lasso 回归',
        slots: [
            { key: 'y', label: '目标变量 Y', type: 'single', tagType: 'y' },
            { key: 'x', label: '特征变量 X (多选)', type: 'multiple', tagType: 'x' }
        ],
        extraConfigs: [
            { type: 'title', label: '⚙️ 模型与参数设置' },
            { key: 'cv', label: '交叉验证折数', type: 'select', options: [ { label: '3折', value: 3 }, { label: '5折', value: 5 }, { label: '10折', value: 10 } ], default: 5 },
            { key: 'maxIter', label: '最大迭代次数', type: 'input', default: 10000 },
            { key: 'tol', label: '收敛容忍度', type: 'input', default: 0.0001 },
            {
                key: 'testSize', label: '测试集比例', type: 'select', options: [
                    { label: '10%', value: '0.1' },
                    { label: '20%', value: '0.2' },
                    { label: '30%', value: '0.3' }
                ], default: '0.2'
            }
        ],
        formulaComponent: {
            props: ['formValues'],
            template: `
                <div style="font-size: 18px;">
                    <span class="math-var">Loss</span> = 
                    <span class="formula-sigma">Σ</span> [ <span class="math-var">{{ formValues.y || 'Y' }}</span> - ( α 
                    <span v-for="(x, idx) in formValues.x" :key="'lassox'+idx">+ β<sub style="font-size: 12px">{{idx+1}}</sub><span class="math-var">{{ x }}</span></span> ) ]<sup>2</sup> 
                    + λ <span class="formula-sigma">Σ</span> | β<sub style="font-size: 12px">j</sub> |
                </div>
            `
        },
        validate: (vars) => vars.y && vars.x && vars.x.length > 0,
        run: (vars, data, config) => {
            const { y, x } = vars;
            const testSize = parseFloat(config.testSize || '0.2');
            const cv = parseInt(config.cv) || 5;
            const maxIter = parseInt(config.maxIter) || 10000;
            const tol = parseFloat(config.tol) || 0.0001;

            let cleanData = MatrixUtils.cleanData(data, [y, ...x]);

            const shuffled = [...cleanData].sort(() => 0.5 - Math.random());
            const splitIdx = Math.floor(shuffled.length * (1 - testSize));
            const trainData = shuffled.slice(0, splitIdx);
            const testData = shuffled.slice(splitIdx);

            if (trainData.length < cv) throw new Error('训练集样本量过小，无法满足交叉验证折数，请调低折数或增加数据。');

            const X_train = trainData.map(r => x.map(f => parseFloat(r[f])));
            const y_train = trainData.map(r => parseFloat(r[y]));
            const X_test = testData.map(r => x.map(f => parseFloat(r[f])));
            const y_test = testData.map(r => parseFloat(r[y]));

            const n = X_train.length;
            const p = x.length;

            // 1. 标准化训练集
            let means = Array(p).fill(0), stds = Array(p).fill(0);
            let X_train_scaled = Array(n).fill(0).map(() => Array(p).fill(0));
            for (let j = 0; j < p; j++) {
                const col = X_train.map(row => row[j]);
                means[j] = mean(col);
                stds[j] = Math.sqrt(variance(col)) || 1;
                for (let i = 0; i < n; i++) X_train_scaled[i][j] = (X_train[i][j] - means[j]) / stds[j];
            }
            let yMean = mean(y_train);
            let y_train_cen = y_train.map(v => v - yMean);

            // 2. 确定 Alpha 路径范围
            let max_alpha = 0;
            for(let j=0; j<p; j++) {
                let dot = 0;
                for(let i=0; i<n; i++) dot += X_train_scaled[i][j] * y_train_cen[i];
                max_alpha = Math.max(max_alpha, Math.abs(dot) / n);
            }
            
            const num_alphas = 40;
            const eps = 1e-3;
            let alphas_path = [];
            for (let i = 0; i < num_alphas; i++) {
                alphas_path.push(max_alpha * Math.pow(eps, i / (num_alphas - 1)));
            }
            
            // 3. 交叉验证寻优
            let mse_path = Array(num_alphas).fill(0);
            let foldsX = [], foldsY = [];
            let foldSize = Math.floor(n / cv);
            
            for(let k=0; k<cv; k++) {
                let start = k * foldSize;
                let end = k === cv - 1 ? n : (k + 1) * foldSize;
                foldsX.push(X_train_scaled.slice(start, end));
                foldsY.push(y_train_cen.slice(start, end));
            }

            for (let k=0; k<cv; k++) {
                let valX = foldsX[k], valY = foldsY[k];
                let trX = [], trY = [];
                for (let j=0; j<cv; j++) {
                    if (j !== k) { trX.push(...foldsX[j]); trY.push(...foldsY[j]); }
                }
                
                let current_w = Array(p).fill(0);
                for (let aIdx=0; aIdx<num_alphas; aIdx++) {
                    current_w = fitCoordinateDescent(trX, trY, alphas_path[aIdx], maxIter, tol, current_w);
                    let err = 0;
                    for(let i=0; i<valX.length; i++) {
                        let pred = 0;
                        for(let f=0; f<p; f++) pred += valX[i][f] * current_w[f];
                        err += Math.pow(valY[i] - pred, 2);
                    }
                    mse_path[aIdx] += err / valX.length;
                }
            }

            let bestAlphaIdx = 0;
            let minMSE = Infinity;
            for (let i=0; i<num_alphas; i++) {
                if (mse_path[i] < minMSE) { minMSE = mse_path[i]; bestAlphaIdx = i; }
            }
            let bestAlpha = alphas_path[bestAlphaIdx];

            // 4. 用最优 Alpha 重训模型并获取系数
            let w_scaled = fitCoordinateDescent(X_train_scaled, y_train_cen, bestAlpha, maxIter, tol, null);
            let coefs = w_scaled.map((w, j) => w / stds[j]);
            let intercept = yMean - coefs.reduce((sum, c, j) => sum + c * means[j], 0);

            let y_pred = X_test.map(row => {
                let sum = intercept;
                for (let j = 0; j < p; j++) sum += row[j] * coefs[j];
                return sum;
            });

            // 5. 为全量特征绘制 LARS 正则化路径
            let X_full_scaled = Array(cleanData.length).fill(0).map(() => Array(p).fill(0));
            let y_full_cen = Array(cleanData.length).fill(0);
            
            let full_means = Array(p).fill(0), full_stds = Array(p).fill(0);
            let raw_X = cleanData.map(r => x.map(f => parseFloat(r[f])));
            let raw_y = cleanData.map(r => parseFloat(r[y]));
            let full_yMean = mean(raw_y);

            for (let j = 0; j < p; j++) {
                const col = raw_X.map(row => row[j]);
                full_means[j] = mean(col);
                full_stds[j] = Math.sqrt(variance(col)) || 1;
                for (let i = 0; i < cleanData.length; i++) X_full_scaled[i][j] = (raw_X[i][j] - full_means[j]) / full_stds[j];
            }
            for (let i = 0; i < cleanData.length; i++) y_full_cen[i] = raw_y[i] - full_yMean;

            let path_coefs = Array(p).fill(0).map(() => []);
            let current_w_full = Array(p).fill(0);
            for (let a of alphas_path) {
                current_w_full = fitCoordinateDescent(X_full_scaled, y_full_cen, a, maxIter, tol, current_w_full);
                for (let j = 0; j < p; j++) path_coefs[j].push(current_w_full[j]); 
            }

            let resultCoefs = x.map((name, i) => ({ name, value: coefs[i] }));
            let scatterPoints = y_test.map((actual, i) => [actual, y_pred[i]]);
            
            return {
                bestAlpha,
                coefs: resultCoefs,
                path: { alphas: alphas_path, coefs: path_coefs, features: x },
                scatterPoints,
                minVal: Math.min(...y_test, ...y_pred),
                maxVal: Math.max(...y_test, ...y_pred),
                metrics: {
                    mse: mse(y_test, y_pred).toFixed(4),
                    r2: r2(y_test, y_pred).toFixed(4),
                    trainN: n, testN: testData.length
                },
                n: cleanData.length,
                y_test, y_pred
            };
        },
        resultComponent: {
            props: ['results'],
            data() { return { coefChart: null, scatterChart: null, pathChart: null }; },
            computed: {
                nonZeroCount() {
                    return this.results.coefs.filter(c => Math.abs(c.value) > 1e-4).length;
                }
            },
            mounted() {
                this.renderCharts();
                this.$watch('results', this.renderCharts, { deep: true });
                this._resizeHandler = () => {
                    if (this.coefChart) this.coefChart.resize();
                    if (this.scatterChart) this.scatterChart.resize();
                    if (this.pathChart) this.pathChart.resize();
                };
                window.addEventListener('resize', this._resizeHandler);
            },
            beforeDestroy() {
                window.removeEventListener('resize', this._resizeHandler);
                if (this.coefChart) { this.coefChart.dispose(); this.coefChart = null; }
                if (this.scatterChart) { this.scatterChart.dispose(); this.scatterChart = null; }
                if (this.pathChart) { this.pathChart.dispose(); this.pathChart = null; }
            },
            methods: {
                renderCharts() {
                    this.$nextTick(() => {
                        if (!this.results) return;

                        if (this.$refs.coefChart) {
                            if (!this.coefChart) this.coefChart = window.echarts.init(this.$refs.coefChart);
                            const xAxisData = this.results.coefs.map(f => f.name);
                            const seriesData = this.results.coefs.map(f => {
                                const isZero = Math.abs(f.value) < 1e-4;
                                return {
                                    value: f.value.toFixed(4),
                                    itemStyle: { color: isZero ? '#94a3b8' : '#ef4444' }
                                };
                            });
                            
                            const coefOption = {
                                title: { text: 'Lasso回归系数\n(红色=非零, 灰色=零)', left: 'center', textStyle: { fontSize: 13, fontWeight: 'bold' } },
                                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                                grid: { left: '10%', right: '5%', bottom: '20%', top: '25%', containLabel: true },
                                xAxis: { name: '特征编号', type: 'category', data: xAxisData, axisLabel: { interval: 0, rotate: 30 } },
                                yAxis: { name: '系数值', type: 'value' },
                                series: [{
                                    name: '系数', type: 'bar', data: seriesData,
                                    itemStyle: { borderColor: '#000', borderWidth: 0.5, opacity: 0.8 }
                                }]
                            };
                            this.coefChart.setOption(coefOption, true); 
                        }

                        if (this.$refs.scatterChart) {
                            if (!this.scatterChart) this.scatterChart = window.echarts.init(this.$refs.scatterChart);
                            const lineData = [[this.results.minVal, this.results.minVal], [this.results.maxVal, this.results.maxVal]];
                            const scatterOption = {
                                title: { text: '预测值 vs 实际值', left: 'center', textStyle: { fontSize: 13, fontWeight: 'bold' } },
                                tooltip: { trigger: 'item', formatter: '实际值: {c[0]}<br/>预测值: {c[1]}' },
                                grid: { left: '10%', right: '10%', bottom: '20%', top: '25%', containLabel: true },
                                xAxis: { name: '实际值', type: 'value', scale: true },
                                yAxis: { name: '预测值', type: 'value', scale: true },
                                series: [
                                    {
                                        name: '预测点', type: 'scatter', data: this.results.scatterPoints,
                                        itemStyle: { color: '#3b82f6', borderColor: '#fff', borderWidth: 1, opacity: 0.7 }, symbolSize: 8
                                    },
                                    {
                                        name: '拟合线', type: 'line', data: lineData,
                                        lineStyle: { color: '#ef4444', type: 'dashed', width: 2 }, symbol: 'none'
                                    }
                                ]
                            };
                            this.scatterChart.setOption(scatterOption, true);
                        }

                        if (this.$refs.pathChart) {
                            if (!this.pathChart) this.pathChart = window.echarts.init(this.$refs.pathChart);
                            const { alphas, coefs, features } = this.results.path;
                            
                            const seriesPath = features.map((feat, idx) => {
                                const dataPairs = alphas.map((a, i) => [a, coefs[idx][i]]);
                                return {
                                    name: feat, type: 'line', data: dataPairs, symbol: 'none', smooth: true, lineStyle: { width: 2 }
                                };
                            });

                            const pathOption = {
                                title: { text: 'Lasso正则化路径\n(系数随α增大逐步变为零)', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
                                tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
                                grid: { left: '8%', right: '15%', bottom: '15%', top: '25%', containLabel: true },
                                xAxis: { 
                                    name: '正则化参数 α', type: 'log', inverse: true, 
                                    nameLocation: 'middle', nameGap: 25, splitLine: { show: false } 
                                },
                                yAxis: { name: '系数值', type: 'value' },
                                series: seriesPath
                            };
                            this.pathChart.setOption(pathOption, true);
                        }
                    });
                }
            },
            template: `
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding: 10px 0;">
                    
                    <table class="academic-table" style="margin-bottom: 25px; width: 100%; max-width: 850px;">
                        <caption>模型性能评估 (基于 LassoCV 交叉验证)</caption>
                        <thead>
                            <tr>
                                <th>最优 α 值</th><th>非零特征数</th><th>测试集 R²</th><th>测试集 MSE</th><th>训练集/测试集</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-weight: bold; color: #ef4444;">{{ results.bestAlpha.toFixed(4) }}</td>
                                <td style="font-weight: bold;">{{ nonZeroCount }} / {{ results.coefs.length }}</td>
                                <td style="color: #10b981; font-weight: bold; font-size: 16px;">{{ results.metrics.r2 }}</td>
                                <td>{{ results.metrics.mse }}</td>
                                <td>{{ results.metrics.trainN }} / {{ results.metrics.testN }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="width: 100%; max-width: 950px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-bottom: 20px;">
                        <div ref="coefChart" style="flex: 1; min-width: 400px; height: 350px; background: #fff; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                        <div ref="scatterChart" style="flex: 1; min-width: 400px; height: 350px; background: #fff; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                    </div>

                    <div style="width: 100%; max-width: 950px; margin-bottom: 20px;">
                        <div ref="pathChart" style="width: 100%; height: 400px; background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                    </div>

                </div>
            `
        },
        generateCode: (vars, config, fileInfo) => {
            const { fileName = 'dataset.csv' } = fileInfo || {};
            const { y, x } = vars;
            const testSize = config.testSize || '0.2';
            const cv = config.cv || 5;

            let code = `# ============================================\n`;
            code += `# Lasso 回归分析与特征筛选 (Scikit-Learn)\n`;
            code += `# 包含：LassoCV 交叉验证寻优 + LARS 正则化路径图\n`;
            code += `# ============================================\n\n`;

            code += `import numpy as np\n`;
            code += `import pandas as pd\n`;
            code += `import matplotlib.pyplot as plt\n`;
            code += `from sklearn.linear_model import LassoCV, lars_path\n`;
            code += `from sklearn.preprocessing import StandardScaler\n`;
            code += `from sklearn.model_selection import train_test_split\n`;
            code += `from sklearn.metrics import r2_score, mean_squared_error\n\n`;

            code += `# 设置中文字体，确保中文正常显示，英文优先使用 Times New Roman\n`;
            code += `plt.rcParams["font.family"] = ["Times New Roman", "Microsoft YaHei", "SimHei"]\n`;
            code += `plt.rcParams['axes.unicode_minus'] = False  # 解决负号显示问题\n\n`;

            code += `# ========== 1. 数据预处理 ==========\n`;
            code += `df = pd.read_csv(r"${fileName}")\n`;
            code += `features = [${x.map(v => `"${v}"`).join(', ')}]\n`;
            code += `target = "${y}"\n`;
            code += `df = df.dropna(subset=features + [target])\n\n`;

            code += `X = df[features]\n`;
            code += `y = df[target]\n`;
            code += `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=${testSize}, random_state=42)\n\n`;

            code += `scaler = StandardScaler()\n`;
            code += `X_train_scaled = scaler.fit_transform(X_train)\n`;
            code += `X_test_scaled = scaler.transform(X_test)\n\n`;

            code += `# ========== 2. 交叉验证寻找最优 Alpha ==========\n`;
            code += `lasso_cv = LassoCV(cv=${cv}, random_state=42, max_iter=${config.maxIter || 10000}, tol=${config.tol || 0.0001})\n`;
            code += `lasso_cv.fit(X_train_scaled, y_train)\n\n`;

            code += `print("=" * 50)\n`;
            code += `print("Lasso回归结果")\n`;
            code += `print("=" * 50)\n`;
            code += `print(f"最优正则化参数 α = {lasso_cv.alpha_:.4f}")\n`;
            code += `print(f"非零系数个数: {np.sum(lasso_cv.coef_ != 0)}")\n`;
            code += `print(f"\\n回归系数:")\n`;
            code += `for i, coef in enumerate(lasso_cv.coef_):\n`;
            code += `    if abs(coef) > 0.01:\n`;
            code += `        print(f"  特征{i+1}: {coef:.4f}")\n\n`;

            code += `# ========== 3. 模型评估 ==========\n`;
            code += `y_pred = lasso_cv.predict(X_test_scaled)\n`;
            code += `print(f"\\n测试集 R² = {r2_score(y_test, y_pred):.4f}")\n`;
            code += `print(f"测试集 MSE = {mean_squared_error(y_test, y_pred):.4f}\\n")\n\n`;

            code += `# ========== 4. 可视化图表 1：系数与拟合效果 ==========\n`;
            code += `fig, axes = plt.subplots(1, 2, figsize=(12, 5))\n\n`;
            
            code += `# 左图：系数对比\n`;
            code += `ax1 = axes[0]\n`;
            code += `x_pos = np.arange(len(features))\n`;
            code += `colors = ['#ef4444' if c != 0 else '#94a3b8' for c in lasso_cv.coef_]\n`;
            code += `ax1.bar(x_pos, lasso_cv.coef_, color=colors, alpha=0.7, edgecolor='black', linewidth=0.5)\n`;
            code += `ax1.axhline(y=0, color='black', linestyle='-', linewidth=0.5)\n`;
            code += `ax1.set_xlabel('特征编号', fontsize=12)\n`;
            code += `ax1.set_ylabel('系数值', fontsize=12)\n`;
            code += `ax1.set_title('Lasso回归系数\\n(红色=非零, 灰色=零)', fontsize=13, fontweight='bold')\n`;
            code += `ax1.set_xticks(x_pos[::2])\n`;
            code += `ax1.grid(True, alpha=0.3, axis='y')\n\n`;

            code += `# 右图：预测 vs 实际\n`;
            code += `ax2 = axes[1]\n`;
            code += `ax2.scatter(y_test, y_pred, c='#3b82f6', alpha=0.6, edgecolors='white', s=60)\n`;
            code += `ax2.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)\n`;
            code += `ax2.set_xlabel('实际值', fontsize=12)\n`;
            code += `ax2.set_ylabel('预测值', fontsize=12)\n`;
            code += `ax2.set_title('预测值 vs 实际值', fontsize=13, fontweight='bold')\n`;
            code += `ax2.grid(True, alpha=0.3)\n\n`;
            code += `plt.tight_layout()\n`;
            code += `plt.show()\n\n`;

            code += `# ========== 5. 可视化图表 2：正则化路径 ==========\n`;
            code += `scaler_full = StandardScaler()\n`;
            code += `X_full_scaled = scaler_full.fit_transform(X)\n`;
            code += `alphas, _, coefs = lars_path(X_full_scaled, y, method='lasso')\n\n`;

            code += `plt.figure(figsize=(10, 6))\n`;
            code += `colors = plt.cm.tab10(np.linspace(0, 1, len(features)))\n`;
            code += `for i in range(len(features)):\n`;
            code += `    plt.plot(alphas, coefs[i], color=colors[i % 10], linewidth=2, label=f'特征{i+1}')\n\n`;

            code += `plt.xscale('log')\n`;
            code += `plt.xlabel('正则化参数 α', fontsize=12)\n`;
            code += `plt.ylabel('系数值', fontsize=12)\n`;
            code += `plt.title('Lasso正则化路径\\n(系数随α增大逐步变为零)', fontsize=14, fontweight='bold')\n`;
            code += `plt.axhline(y=0, color='black', linestyle='--', linewidth=0.5)\n`;
            code += `plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=9)\n`;
            code += `plt.grid(True, alpha=0.3)\n`;
            code += `plt.tight_layout()\n`;
            code += `plt.show()\n\n`;

            code += `print("=" * 50)\n`;
            code += `print("正则化路径分析")\n`;
            code += `print("=" * 50)\n`;
            code += `print("随着α增大（从右向左看）：")\n`;
            code += `print("1. 不重要特征的系数最先变为零")\n`;
            code += `print("2. 重要特征的系数最后才变为零")\n`;
            code += `print("3. 可以据此判断特征的相对重要性")\n`;

            return code;
        }
    });
})();