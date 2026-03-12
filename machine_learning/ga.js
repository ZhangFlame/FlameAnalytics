/**
 * =========================================================
 * Machine Learning 模块 - 遗传算法寻优 (Genetic Algorithm)
 * BY张张 | 基于样本数据集建模 + 多维特征组合最优化
 * =========================================================
 */
(function () {
    // 内部统计工具
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr => { if (arr.length <= 1) return 0; const m = mean(arr); return arr.reduce((sq, n) => sq + Math.pow(n - m, 2), 0) / (arr.length - 1); };

    // 软阈值函数 (Lasso 坐标下降专用)
    const softThreshold = (rho, lambda) => {
        if (rho < -lambda) return rho + lambda;
        if (rho > lambda) return rho - lambda;
        return 0;
    };

    // 坐标下降法求解 Lasso (原生 JS 引擎)
    const fitCoordinateDescent = (X_std, y_cen, alpha, maxIter, tol) => {
        const n = X_std.length;
        const p = X_std[0].length;
        let w = Array(p).fill(0);
        let r = [...y_cen];
        for (let iter = 0; iter < maxIter; iter++) {
            let maxDiff = 0;
            for (let j = 0; j < p; j++) {
                let old_wj = w[j];
                let rho_j = 0;
                for (let i = 0; i < n; i++) rho_j += X_std[i][j] * (r[i] + old_wj * X_std[i][j]);
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
        id: 'ga',
        category: 'machine_learning',
        name: '遗传算法寻优',
        slots: [
            { key: 'y', label: '寻优目标变量 Y', type: 'single', tagType: 'y' },
            { key: 'x', label: '可调自变量 X (多选)', type: 'multiple', tagType: 'x' }
        ],
        extraConfigs: [
            { type: 'title', label: '🎯 寻优目标与拟合设置' },
            { key: 'optDirection', label: '优化方向', type: 'select', options: [ {label:'寻找最大值 (Maximize)', value:'max'}, {label:'寻找最小值 (Minimize)', value:'min'} ], default: 'max' },
            { key: 'regMethod', label: '拟合方程 (改变权重分配)', type: 'select', options: [
                {label: '普通最小二乘法 (OLS - 寻找绝对真理)', value: 'ols'},
                {label: '岭回归 (L2 弱惩罚 α=1)', value: 'ridge_1'},
                {label: '岭回归 (L2 中惩罚 α=10)', value: 'ridge_10'},
                {label: '岭回归 (L2 强惩罚 α=100 - 强制打散权重)', value: 'ridge_100'},
                {label: '岭回归 (L2 极强惩罚 α=1000)', value: 'ridge_1000'},
                {label: 'Lasso (L1 弱惩罚 α=0.01)', value: 'lasso_0.01'},
                {label: 'Lasso (L1 强惩罚 α=0.1 - 强制特征归零)', value: 'lasso_0.1'}
            ], default: 'ridge_10' },

            { type: 'title', label: '⚙️ 算法基础参数' },
            { key: 'popSize', label: '种群规模', type: 'input', default: 50 },
            { key: 'chromLenPerVar', label: '单变量染色体长度', type: 'select', options: [ {label:'10位 (较低精度)', value:10}, {label:'15位 (标准精度)', value:15}, {label:'20位 (高精度)', value:20} ], default: 15 },
            { key: 'maxGen', label: '最大进化代数', type: 'input', default: 100 },
            
            { type: 'title', label: '🧬 遗传算子概率' },
            { key: 'pc', label: '交叉概率', type: 'input', default: 0.8 },
            { key: 'pm', label: '变异概率', type: 'input', default: 0.02 }
        ],
        formulaComponent: {
            props: ['formValues', 'extraConfigs'],
            template: `
                <div style="font-size: 16px; line-height: 1.8;">
                    <span style="font-weight:bold; color: #10b981;">1. 数据建模:</span> 
                    <span class="math-var">{{ formValues.y || 'Y' }}</span> = β<sub style="font-size:12px">0</sub> + Σ β<sub style="font-size:12px">i</sub> <span class="math-var">X<sub style="font-size:12px">i</sub></span>
                    <br>
                    <span style="font-weight:bold; color: #3b82f6;">2. 遗传寻优:</span> 
                    寻找最优的 <span class="math-var">X<sub style="font-size:12px">i</sub></span> 组合，使得 <span class="math-var">{{ formValues.y || 'Y' }}</span> 达到{{ extraConfigs.optDirection === 'min' ? '最小' : '最大' }}值
                </div>
            `
        },
        validate: (vars) => vars.y && vars.x && vars.x.length > 0,
        run: (vars, data, config) => {
            const { y, x } = vars;
            const POP_SIZE = parseInt(config.popSize) || 50;
            const CHROM_LEN_PER_VAR = parseInt(config.chromLenPerVar) || 15;
            const MAX_GEN = parseInt(config.maxGen) || 100;
            const PC = parseFloat(config.pc) || 0.8;
            const PM = parseFloat(config.pm) || 0.02;
            const OPT_DIR = config.optDirection || 'max';
            const numVars = x.length;
            const TOTAL_CHROM_LEN = numVars * CHROM_LEN_PER_VAR;

            const regMethod = config.regMethod || 'ridge_10';
            const isLasso = regMethod.startsWith('lasso');
            let alpha_val = 0;
            if (regMethod !== 'ols') alpha_val = parseFloat(regMethod.split('_')[1]);

            const cleanData = MatrixUtils.cleanData(data, [y, ...x]);
            if (cleanData.length <= numVars + 1) throw new Error('样本量太少，无法拟合回归模型！');

            // 1. 提取变量并进行标准化
            const X_mat = cleanData.map(r => x.map(v => parseFloat(r[v])));
            const Y_mat = cleanData.map(r => parseFloat(r[y]));
            
            const x_means = [], x_stds = [];
            for(let j = 0; j < numVars; j++) {
                const col = X_mat.map(row => row[j]);
                x_means.push(mean(col));
                const v = variance(col);
                x_stds.push(v === 0 ? 1 : Math.sqrt(v));
            }
            const y_mean = mean(Y_mat);
            const y_var = variance(Y_mat);
            const y_std = y_var === 0 ? 1 : Math.sqrt(y_var);

            const X_cen = X_mat.map(row => row.map((val, j) => (val - x_means[j]) / x_stds[j]));
            const Y_cen = Y_mat.map(val => (val - y_mean) / y_std);

            // 2. 根据用户选择执行回归
            let beta_std = [];
            if (isLasso) {
                beta_std = fitCoordinateDescent(X_cen, Y_cen, alpha_val, 10000, 1e-4);
            } else {
                const XT = MatrixUtils.transpose(X_cen);
                let XTX = MatrixUtils.multiply(XT, X_cen);
                for(let i = 0; i < numVars; i++) {
                    XTX[i][i] += regMethod === 'ols' ? 1e-8 : alpha_val; 
                }
                const XTX_inv = MatrixUtils.invert(XTX);
                const XTY = MatrixUtils.multiply(XT, Y_cen.map(v => [v]));
                beta_std = MatrixUtils.multiply(XTX_inv, XTY).map(row => row[0]);
            }

            // 3. 系数还原至原始量纲
            const coefs = [];
            let intercept = y_mean;
            for(let j = 0; j < numVars; j++) {
                const b = beta_std[j] * (y_std / x_stds[j]);
                coefs.push(b);
                intercept -= b * x_means[j];
            }

            // 4. 提取样本数据上下界
            const bounds = x.map(v => {
                const vals = cleanData.map(r => parseFloat(r[v]));
                return { min: Math.min(...vals), max: Math.max(...vals) };
            });

            // 5. 编码与计算函数
            const decode = (chromosome) => {
                let decodedVars = [];
                for (let i = 0; i < numVars; i++) {
                    let chunk = chromosome.slice(i * CHROM_LEN_PER_VAR, (i + 1) * CHROM_LEN_PER_VAR);
                    let decimal = 0;
                    for (let j = 0; j < CHROM_LEN_PER_VAR; j++) {
                        decimal += chunk[j] * Math.pow(2, CHROM_LEN_PER_VAR - 1 - j);
                    }
                    let val = bounds[i].min + decimal * (bounds[i].max - bounds[i].min) / (Math.pow(2, CHROM_LEN_PER_VAR) - 1);
                    decodedVars.push(val);
                }
                return decodedVars;
            };

            const calculateY = (x_vals) => {
                return intercept + x_vals.reduce((sum, val, idx) => sum + val * coefs[idx], 0);
            };

            // 6. 初始化种群
            let pop = Array(POP_SIZE).fill(0).map(() => 
                Array(TOTAL_CHROM_LEN).fill(0).map(() => Math.random() < 0.5 ? 1 : 0)
            );

            let best_history = [];
            let avg_history = [];
            let elite_individual = null;
            let elite_y_val = OPT_DIR === 'max' ? -Infinity : Infinity;

            // 7. 遗传进化
            for (let gen = 0; gen < MAX_GEN; gen++) {
                let y_vals = pop.map(ind => calculateY(decode(ind)));

                let current_best_idx = 0;
                let current_best_y = y_vals[0];
                let current_worst_idx = 0;
                let current_worst_y = y_vals[0];
                
                for(let i=1; i<POP_SIZE; i++) {
                    if (OPT_DIR === 'max') {
                        if(y_vals[i] > current_best_y) { current_best_y = y_vals[i]; current_best_idx = i; }
                        if(y_vals[i] < current_worst_y) { current_worst_y = y_vals[i]; current_worst_idx = i; }
                    } else {
                        if(y_vals[i] < current_best_y) { current_best_y = y_vals[i]; current_best_idx = i; }
                        if(y_vals[i] > current_worst_y) { current_worst_y = y_vals[i]; current_worst_idx = i; }
                    }
                }

                if (gen > 0 && elite_individual !== null) {
                    pop[current_worst_idx] = [...elite_individual];
                    y_vals[current_worst_idx] = elite_y_val;
                    current_best_y = elite_y_val;
                    for(let i=0; i<POP_SIZE; i++) {
                        if (OPT_DIR === 'max' && y_vals[i] > current_best_y) current_best_y = y_vals[i];
                        if (OPT_DIR === 'min' && y_vals[i] < current_best_y) current_best_y = y_vals[i];
                    }
                }

                if (elite_individual === null || 
                   (OPT_DIR === 'max' && current_best_y > elite_y_val) || 
                   (OPT_DIR === 'min' && current_best_y < elite_y_val)) {
                    elite_individual = [...pop[current_best_idx]];
                    elite_y_val = current_best_y;
                }

                best_history.push(elite_y_val);
                avg_history.push(mean(y_vals));

                let fit_vals = [];
                let min_y = Math.min(...y_vals);
                let max_y = Math.max(...y_vals);
                let range = max_y - min_y;
                if (range === 0) range = 1; 

                for(let i=0; i<POP_SIZE; i++) {
                    if (OPT_DIR === 'max') fit_vals.push((y_vals[i] - min_y) / range + 1e-3);
                    else fit_vals.push((max_y - y_vals[i]) / range + 1e-3);
                }

                let sum_fit = fit_vals.reduce((a, b) => a + b, 0);

                let new_pop = [];
                for(let i=0; i<POP_SIZE; i++) {
                    let r = Math.random() * sum_fit;
                    let acc = 0, sel_idx = POP_SIZE - 1;
                    for(let j=0; j<POP_SIZE; j++) {
                        acc += fit_vals[j];
                        if(acc >= r) { sel_idx = j; break; }
                    }
                    new_pop.push([...pop[sel_idx]]);
                }
                pop = new_pop;

                for (let i = 0; i < POP_SIZE - 1; i += 2) {
                    if (Math.random() < PC) {
                        let point = Math.floor(Math.random() * (TOTAL_CHROM_LEN - 1)) + 1;
                        for (let j = point; j < TOTAL_CHROM_LEN; j++) {
                            let temp = pop[i][j]; pop[i][j] = pop[i+1][j]; pop[i+1][j] = temp;
                        }
                    }
                }

                for (let i = 0; i < POP_SIZE; i++) {
                    for (let j = 0; j < TOTAL_CHROM_LEN; j++) {
                        if (Math.random() < PM) pop[i][j] = 1 - pop[i][j];
                    }
                }
            }

            const best_x_vals = decode(elite_individual);

            return {
                targetName: y, 
                featureNames: [...x], 
                intercept, coefs, bounds,
                best_history, avg_history, 
                best_x_vals, best_y: elite_y_val,
                maxGen: MAX_GEN, optDirection: OPT_DIR
            };
        },
        resultComponent: {
            props: ['results'],
            data() { return { chartInst: null }; },
            mounted() {
                this.renderChart();
                this.$watch('results', this.renderChart, { deep: true });
                this._resizeHandler = () => { if (this.chartInst) this.chartInst.resize(); };
                window.addEventListener('resize', this._resizeHandler);
            },
            beforeDestroy() {
                window.removeEventListener('resize', this._resizeHandler);
                if (this.chartInst) { this.chartInst.dispose(); this.chartInst = null; }
            },
            methods: {
                renderChart() {
                    this.$nextTick(() => {
                        if (!this.results || !this.$refs.curveChart) return;
                        
                        if (this.chartInst && this.chartInst.getDom() !== this.$refs.curveChart) {
                            this.chartInst.dispose();
                            this.chartInst = null;
                        }
                        
                        if (!this.chartInst) {
                            this.chartInst = window.echarts.init(this.$refs.curveChart);
                        } else {
                            this.chartInst.clear(); 
                        }
                        
                        const generations = Array.from({length: this.results.maxGen}, (_, i) => i);
                        const final_best = this.results.best_history[this.results.best_history.length - 1];

                        const min_val = Math.min(...this.results.best_history, ...this.results.avg_history);
                        const max_val = Math.max(...this.results.best_history, ...this.results.avg_history);
                        const buffer = (max_val - min_val) * 0.1 || 1;

                        const option = {
                            title: { text: `遗传算法收敛曲线 (${this.results.optDirection === 'max' ? '最大化' : '最小化'})`, left: 'center', textStyle: { fontSize: 15, fontWeight: 'bold' } },
                            tooltip: { trigger: 'axis' },
                            legend: { data: ['种群平均预测值', '最优个体预测值'], bottom: 0 },
                            grid: { left: '10%', right: '10%', bottom: '15%', top: '15%', containLabel: true },
                            xAxis: { name: '进化代数', type: 'category', data: generations, boundaryGap: false },
                            yAxis: { name: `目标变量 ${this.results.targetName}`, type: 'value', min: (min_val - buffer).toFixed(2), max: (max_val + buffer).toFixed(2), scale: true },
                            series: [
                                {
                                    name: '种群平均预测值', type: 'line', data: this.results.avg_history,
                                    itemStyle: { color: '#f59e0b' }, lineStyle: { width: 2 }, symbol: 'none'
                                },
                                {
                                    name: '最优个体预测值', type: 'line', data: this.results.best_history,
                                    itemStyle: { color: '#3b82f6' }, lineStyle: { width: 2.5 }, symbol: 'none',
                                    markPoint: {
                                        data: [
                                            { 
                                                coord: [generations.length - 1, final_best],
                                                value: `最优解: ${final_best.toFixed(4)}`,
                                                itemStyle: { color: '#3b82f6' },
                                                label: { color: '#fff', fontSize: 11 }
                                            }
                                        ]
                                    }
                                }
                            ]
                        };
                        this.chartInst.setOption(option, true);
                    });
                }
            },
            template: `
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding: 10px 0;">
                    
                    <div style="width: 100%; max-width: 900px; background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                        <div style="font-weight: bold; color: #475569; margin-bottom: 8px;">多元回归方程</div>
                        <div style="font-family: 'Times New Roman', serif; font-size: 16px; color: #0f172a;">
                            {{ results.targetName }} = {{ results.intercept.toFixed(4) }} 
                            <span v-for="(feat, idx) in results.featureNames" :key="feat">
                                {{ results.coefs[idx] >= 0 ? '+' : '-' }} {{ Math.abs(results.coefs[idx]).toFixed(4) }} × {{ feat }}
                            </span>
                        </div>
                    </div>

                    <div style="width: 100%; max-width: 900px; display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
                        <table class="academic-table" style="flex: 1; margin: 0;">
                            <caption>最优变量组合解 (Optimal Solution)</caption>
                            <thead>
                                <tr><th>自变量 (X)</th><th>寻优推荐值</th><th>变量边界限制</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="(feat, idx) in results.featureNames" :key="feat">
                                    <td style="font-weight: bold;">{{ feat }}</td>
                                    <td style="color: #ef4444; font-weight: bold;">{{ results.best_x_vals[idx].toFixed(4) }}</td>
                                    <td style="color: #64748b; font-size: 12px;">[{{ results.bounds[idx].min.toFixed(2) }}, {{ results.bounds[idx].max.toFixed(2) }}]</td>
                                </tr>
                            </tbody>
                        </table>

                        <div style="width: 250px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                            <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">预计{{ results.optDirection === 'max' ? '最大化' : '最小化' }}结果 (Y)</div>
                            <div style="font-size: 28px; font-weight: bold; color: #10b981;">{{ results.best_y.toFixed(4) }}</div>
                            <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">基于回归方程推算得出</div>
                        </div>
                    </div>

                    <div style="width: 100%; max-width: 900px; margin-bottom: 20px;">
                        <div ref="curveChart" style="width: 100%; height: 450px; background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                    </div>

                    <div style="font-size: 13px; color: #64748b; background: #f8fafc; padding: 12px 16px; border-radius: 6px; width: 100%; max-width: 900px; border-left: 4px solid #3b82f6; line-height: 1.6; text-align: left;">
                        <strong>💡 温馨提示：</strong>网页端计算受限于浏览器单线程算力，此处结果仅供参考与效果预览。为确保学术严谨性并生成用于期刊发表的高清图表，请务必点击右侧「分析代码」，复制生成的 Python 脚本至本地环境运行验证。
                    </div>

                </div>
            `
        },
        generateCode: (vars, config, fileInfo) => {
            const { fileName = 'dataset.csv' } = fileInfo || {};
            const { y, x } = vars;
            const POP_SIZE = config.popSize || 50;
            const CHROM_LEN_PER_VAR = config.chromLenPerVar || 15;
            const MAX_GEN = config.maxGen || 100;
            const PC = config.pc || 0.8;
            const PM = config.pm || 0.02;
            const OPT_DIR = config.optDirection || 'max';
            
            const regMethod = config.regMethod || 'ridge_10';
            const isLasso = regMethod.startsWith('lasso');
            let alpha_val = 0;
            if (regMethod !== 'ols') alpha_val = parseFloat(regMethod.split('_')[1]);

            let code = `"""\n`;
            code += `遗传算法寻优 (Genetic Algorithm Optimization)\n`;
            code += `1. 读取数据集，利用回归算法拟合目标函数方程\n`;
            code += `2. 提取变量上下界边界 (Min/Max)\n`;
            code += `3. 利用遗传算法寻找最优的特征组合，使预测值 ${y} 达到${OPT_DIR === 'max' ? '最大' : '最小'}\n`;
            code += `"""\n\n`;

            code += `import numpy as np\n`;
            code += `import pandas as pd\n`;
            code += `import random\n`;
            code += `import matplotlib.pyplot as plt\n`;
            
            if (isLasso) {
                code += `from sklearn.linear_model import Lasso\n\n`;
            } else if (regMethod === 'ols') {
                code += `from sklearn.linear_model import LinearRegression\n\n`;
            } else {
                code += `from sklearn.linear_model import Ridge\n\n`;
            }

            code += `# ===================== 中文字体设置 =====================\n`;
            code += `plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']\n`;
            code += `plt.rcParams['axes.unicode_minus'] = False\n\n`;

            code += `# ===================== 1. 数据读取与建模 =====================\n`;
            code += `df = pd.read_csv(r"${fileName}")\n`;
            code += `features = [${x.map(v => `"${v}"`).join(', ')}]\n`;
            code += `target = "${y}"\n`;
            code += `df = df.dropna(subset=features + [target])\n\n`;

            code += `X_data = df[features].values\n`;
            code += `Y_data = df[target].values\n\n`;

            code += `# 拟合多元方程\n`;
            if (isLasso) {
                code += `model = Lasso(alpha=${alpha_val})\n`;
            } else if (regMethod === 'ols') {
                code += `model = LinearRegression()\n`;
            } else {
                code += `model = Ridge(alpha=${alpha_val})\n`;
            }
            
            code += `model.fit(X_data, Y_data)\n`;
            code += `coefs = model.coef_\n`;
            code += `intercept = model.intercept_\n\n`;

            code += `# 自动提取各个特征的上下界约束\n`;
            code += `x_bounds = [(X_data[:, i].min(), X_data[:, i].max()) for i in range(len(features))]\n\n`;

            code += `# ===================== 2. 算法参数配置 =====================\n`;
            code += `POP_SIZE = ${POP_SIZE}             # 种群规模\n`;
            code += `CHROM_LEN_PER_VAR = ${CHROM_LEN_PER_VAR}    # 每个变量的染色体长度\n`;
            code += `NUM_VARS = len(features)\n`;
            code += `TOTAL_CHROM_LEN = NUM_VARS * CHROM_LEN_PER_VAR\n`;
            code += `PC = ${PC}                   # 交叉概率\n`;
            code += `PM = ${PM}                  # 变异概率\n`;
            code += `MAX_GEN = ${MAX_GEN}              # 最大进化代数\n`;
            code += `OPT_DIR = '${OPT_DIR}'            # 优化方向 ('max'或'min')\n\n`;

            code += `# ===================== 3. 编码与解码 =====================\n`;
            code += `def decode(chromosome):\n`;
            code += `    x_vals = []\n`;
            code += `    for i in range(NUM_VARS):\n`;
            code += `        chunk = chromosome[i * CHROM_LEN_PER_VAR : (i + 1) * CHROM_LEN_PER_VAR]\n`;
            code += `        decimal = sum(chunk[j] * (2 ** (CHROM_LEN_PER_VAR - 1 - j)) for j in range(CHROM_LEN_PER_VAR))\n`;
            code += `        low, high = x_bounds[i]\n`;
            code += `        val = low + decimal * (high - low) / (2 ** CHROM_LEN_PER_VAR - 1)\n`;
            code += `        x_vals.append(val)\n`;
            code += `    return np.array(x_vals)\n\n`;

            code += `# ===================== 4. 适应度函数 =====================\n`;
            code += `def calculate_y(chromosome):\n`;
            code += `    x_vals = decode(chromosome)\n`;
            code += `    return intercept + np.sum(coefs * x_vals)\n\n`;

            code += `# ===================== 5. 遗传操作 =====================\n`;
            code += `def selection(pop, y_vals):\n`;
            code += `    min_y = np.min(y_vals)\n`;
            code += `    max_y = np.max(y_vals)\n`;
            code += `    range_y = max_y - min_y if max_y - min_y != 0 else 1.0\n`;
            code += `    if OPT_DIR == 'max':\n`;
            code += `        fit_vals = (y_vals - min_y) / range_y + 1e-3\n`;
            code += `    else:\n`;
            code += `        fit_vals = (max_y - y_vals) / range_y + 1e-3\n\n`;
            code += `    total = np.sum(fit_vals)\n`;
            code += `    probs = fit_vals / total if total > 0 else np.ones(POP_SIZE) / POP_SIZE\n`;
            code += `    indices = np.random.choice(POP_SIZE, size=POP_SIZE, p=probs)\n`;
            code += `    return pop[indices].copy()\n\n`;

            code += `def crossover(pop):\n`;
            code += `    new_pop = pop.copy()\n`;
            code += `    for i in range(0, POP_SIZE - 1, 2):\n`;
            code += `        if random.random() < PC:\n`;
            code += `            point = random.randint(1, TOTAL_CHROM_LEN - 1)\n`;
            code += `            new_pop[i, point:], new_pop[i+1, point:] = new_pop[i+1, point:].copy(), new_pop[i, point:].copy()\n`;
            code += `    return new_pop\n\n`;

            code += `def mutation(pop):\n`;
            code += `    new_pop = pop.copy()\n`;
            code += `    for i in range(POP_SIZE):\n`;
            code += `        for j in range(TOTAL_CHROM_LEN):\n`;
            code += `            if random.random() < PM:\n`;
            code += `                new_pop[i, j] = 1 - new_pop[i, j]\n`;
            code += `    return new_pop\n\n`;

            code += `# ===================== 6. 主算法 =====================\n`;
            code += `def genetic_algorithm():\n`;
            code += `    pop = np.random.randint(0, 2, (POP_SIZE, TOTAL_CHROM_LEN))\n`;
            code += `    best_y_history = []\n`;
            code += `    avg_y_history = []\n`;
            code += `    elite_individual = None\n`;
            code += `    elite_y = float('-inf') if OPT_DIR == 'max' else float('inf')\n\n`;
            
            code += `    for gen in range(MAX_GEN):\n`;
            code += `        y_vals = np.array([calculate_y(ind) for ind in pop])\n\n`;
            
            code += `        if OPT_DIR == 'max':\n`;
            code += `            current_best_idx = np.argmax(y_vals)\n`;
            code += `            current_worst_idx = np.argmin(y_vals)\n`;
            code += `        else:\n`;
            code += `            current_best_idx = np.argmin(y_vals)\n`;
            code += `            current_worst_idx = np.argmax(y_vals)\n\n`;

            code += `        current_best_y = y_vals[current_best_idx]\n\n`;

            code += `        if gen > 0 and elite_individual is not None:\n`;
            code += `            pop[current_worst_idx] = elite_individual.copy()\n`;
            code += `            y_vals[current_worst_idx] = elite_y\n`;
            code += `            current_best_y = elite_y\n`;
            code += `            for i in range(POP_SIZE):\n`;
            code += `                if (OPT_DIR == 'max' and y_vals[i] > current_best_y) or \\\n`;
            code += `                   (OPT_DIR == 'min' and y_vals[i] < current_best_y):\n`;
            code += `                    current_best_y = y_vals[i]\n\n`;

            code += `        if elite_individual is None or \\\n`;
            code += `           (OPT_DIR == 'max' and current_best_y > elite_y) or \\\n`;
            code += `           (OPT_DIR == 'min' and current_best_y < elite_y):\n`;
            code += `            elite_individual = pop[current_best_idx].copy()\n`;
            code += `            elite_y = current_best_y\n\n`;
            
            code += `        best_y_history.append(elite_y)\n`;
            code += `        avg_y_history.append(np.mean(y_vals))\n\n`;
            
            code += `        if gen % 20 == 0 or gen == MAX_GEN - 1:\n`;
            code += `            print(f"第{gen:3d}代: 当前最优目标 Y = {elite_y:8.4f}")\n\n`;
            
            code += `        pop = selection(pop, y_vals)\n`;
            code += `        pop = crossover(pop)\n`;
            code += `        pop = mutation(pop)\n\n`;
            
            code += `    return decode(elite_individual), elite_y, best_y_history, avg_y_history\n\n`;

            code += `# ===================== 7. 运行算法并绘图 =====================\n`;
            code += `if __name__ == "__main__":\n`;
            code += `    print("=" * 50)\n`;
            code += `    print("1. 提取的多元回归方程")\n`;
            code += `    print("=" * 50)\n`;
            code += `    eq = f"{target} = {intercept:.4f} "\n`;
            code += `    for i, f in enumerate(features):\n`;
            code += `        eq += f"{'+' if coefs[i]>=0 else '-'} {abs(coefs[i]):.4f} * {f} "\n`;
            code += `    print(eq + "\\n")\n\n`;

            code += `    print("=" * 50)\n`;
            code += `    print("2. 启动遗传算法")\n`;
            code += `    print("=" * 50)\n`;
            code += `    best_x, best_y, best_hist, avg_hist = genetic_algorithm()\n\n`;
            
            code += `    print("\\n" + "=" * 50)\n`;
            code += `    print(f"最终寻优结果 ({'最大化' if OPT_DIR=='max' else '最小化'} {target})")\n`;
            code += `    print("=" * 50)\n`;
            code += `    print(f"预测理论极值 Y = {best_y:.4f}\\n")\n`;
            code += `    print("建议的特征变量组合为：")\n`;
            code += `    for i, f in enumerate(features):\n`;
            code += `        low, high = x_bounds[i]\n`;
            code += `        print(f"  - {f}: {best_x[i]:.4f}  (变量边界: [{low:.2f}, {high:.2f}])")\n\n`;

            code += `    plt.figure(figsize=(10, 6), dpi=150)\n`;
            code += `    generations = range(len(best_hist))\n`;
            code += `    plt.plot(generations, avg_hist, color='#f59e0b', linewidth=2, label='种群平均预测值', alpha=0.8)\n`;
            code += `    plt.plot(generations, best_hist, color='#3b82f6', linewidth=2.5, label='最优个体预测值（精英）')\n\n`;
            
            code += `    best_val = best_hist[-1]\n`;
            code += `    best_gen = len(best_hist) - 1\n`;
            code += `    plt.scatter([best_gen], [best_val], color='#3b82f6', s=100, zorder=5, edgecolors='white', linewidths=2)\n`;
            code += `    plt.annotate(f'最优解: {best_val:.4f}', \n`;
            code += `                 xy=(best_gen, best_val),\n`;
            code += `                 xytext=(max(0, best_gen - 20), best_val + (np.ptp(best_hist)*0.1 if OPT_DIR=='max' else -np.ptp(best_hist)*0.1)),\n`;
            code += `                 fontsize=11, color='#1e40af',\n`;
            code += `                 arrowprops=dict(arrowstyle='->', color='#3b82f6'))\n\n`;
            
            code += `    plt.xlabel('进化代数', fontsize=12)\n`;
            code += `    plt.ylabel(f'目标变量 {target}', fontsize=12)\n`;
            code += `    plt.title(f'遗传算法收敛曲线 (寻找{"最大值" if OPT_DIR=="max" else "最小值"})', fontsize=14, fontweight='bold')\n`;
            code += `    plt.legend(loc='lower right' if OPT_DIR=='max' else 'upper right', fontsize=11)\n`;
            code += `    plt.grid(True, alpha=0.3, linestyle='--')\n`;
            code += `    plt.tight_layout()\n`;
            code += `    plt.savefig('ga_convergence.png', bbox_inches='tight')\n`;
            code += `    plt.show()\n`;

            return code;
        }
    });
})();