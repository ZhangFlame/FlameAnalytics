/**
 * =========================================================
 * 核心数学与统计计算工具库 (Core Math & Stat Utilities)
 * BY张张 | 关注公众号：张张小栈，获取更多计量实证干货
 * =========================================================
 */

const transpose = (matrix) => {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
};

const multiply = (a, b) => {
    const result = [];
    for (let i = 0; i < a.length; i++) {
        result[i] = [];
        for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < b.length; k++) {
                sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
};

// 升级版：列主元 Gauss-Jordan 消元法求逆
const invert = (matrix) => {
    const n = matrix.length;
    let a = matrix.map(row => [...row]);
    let inv = Array(n).fill(0).map((_, i) => Array(n).fill(0).map((__, j) => i === j ? 1 : 0));

    for (let i = 0; i < n; i++) {
        let maxEl = Math.abs(a[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(a[k][i]) > maxEl) {
                maxEl = Math.abs(a[k][i]);
                maxRow = k;
            }
        }

        if (maxRow !== i) {
            [a[i], a[maxRow]] = [a[maxRow], a[i]];
            [inv[i], inv[maxRow]] = [inv[maxRow], inv[i]];
        }

        // BY张张：遇到奇异矩阵，加入微小扰动，同时触发前端 UI 强提示
        if (Math.abs(a[i][i]) < 1e-12) {
            a[i][i] += 1e-8; 
            console.warn("矩阵接近奇异，已应用微小正则化(可能存在多重共线性)");
            
            // 全局 UI 弹窗提示（通过标志位防止循环中重复无限弹窗）
            if (window.ElementPlus && window.ElementPlus.ElMessage && !window._singularAlertShown) {
                window.ElementPlus.ElMessage.warning({
                    message: "🚨 张张预警：检测到自变量间可能存在严重的多重共线性（矩阵接近奇异）！已自动注入微量正则化维持计算，但结果参数可能失真，建议重点检查变量池！",
                    duration: 6000
                });
                window._singularAlertShown = true;
                setTimeout(() => { window._singularAlertShown = false; }, 3000);
            }
        }

        let pivot = a[i][i];
        for (let j = 0; j < n; j++) {
            a[i][j] /= pivot;
            inv[i][j] /= pivot;
        }

        for (let k = 0; k < n; k++) {
            if (k !== i) {
                let factor = a[k][i];
                for (let j = 0; j < n; j++) {
                    a[k][j] -= factor * a[i][j];
                    inv[k][j] -= factor * inv[i][j];
                }
            }
        }
    }
    return inv;
};

const getColumn = (data, varName) => {
    return data.map(row => {
        const val = parseFloat(row[varName]);
        return isNaN(val) ? null : val;
    });
};

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

const variance = (arr) => {
    const m = mean(arr);
    return arr.reduce((sq, n) => sq + Math.pow(n - m, 2), 0) / (arr.length - 1);
};

const std = (arr) => Math.sqrt(variance(arr));
const min = (arr) => Math.min(...arr);
const max = (arr) => Math.max(...arr);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

const cleanStataName = (name) => {
    if (!name) return '';
    let clean = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(clean)) clean = 'v_' + clean;
    if (clean === '') clean = 'var';
    const reserved = ['if', 'in', 'by', 'sort', 'generate', 'replace', 'egen', 'drop', 'keep'];
    if (reserved.includes(clean.toLowerCase())) clean = clean + '_var';
    return clean;
};

const cleanData = (data, varNames) => {
    return data.filter(row => {
        for (let v of varNames) {
            const val = parseFloat(row[v]);
            if (isNaN(val) || val === null || val === undefined) return false;
        }
        return true;
    });
};

const correlationMatrix = (data, varNames) => {
    const n = varNames.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const x = data.map(r => parseFloat(r[varNames[i]]));
            const y = data.map(r => parseFloat(r[varNames[j]]));
            const mx = mean(x);
            const my = mean(y);
            
            const num = x.reduce((sum, xi, idx) => sum + (xi - mx) * (y[idx] - my), 0);
            const denX = x.reduce((sum, xi) => sum + Math.pow(xi - mx, 2), 0);
            const denY = y.reduce((sum, yi) => sum + Math.pow(yi - my, 2), 0);
            
            matrix[i][j] = (denX === 0 || denY === 0) ? 0 : (num / Math.sqrt(denX * denY));
        }
    }
    return matrix;
};

const tPDF = (x, df) => {
    return Math.exp( (Math.logGamma((df+1)/2) - Math.logGamma(df/2)) - 0.5*Math.log(df*Math.PI) - ((df+1)/2)*Math.log(1 + x*x/df) );
};

function adaptiveSimpson(f, a, b, tol, maxDepth, depth) {
    if (depth === undefined) depth = 0;
    const c = (a + b) / 2;
    const h = b - a;
    const fa = f(a), fb = f(b), fc = f(c);
    const S = (h / 6) * (fa + 4*fc + fb);
    const fl = f((a + c) / 2), fr = f((c + b) / 2);
    const S2 = (h/12) * (fa + 4*fl + fc) + (h/12) * (fc + 4*fr + fb);
    if (Math.abs(S2 - S) < 15 * tol || depth >= maxDepth) {
        return S2 + (S2 - S) / 15;
    }
    return adaptiveSimpson(f, a, c, tol/2, maxDepth, depth+1) + adaptiveSimpson(f, c, b, tol/2, maxDepth, depth+1);
}

const tCDF = (x, df) => {
    if (x === 0) return 0.5;
    if (x > 0) return 0.5 + adaptiveSimpson((t) => tPDF(t, df), 0, x, 1e-8, 20);
    return 1 - tCDF(-x, df);
};

const tProb = (t, df) => {
    if (df <= 0 || isNaN(t) || !isFinite(t)) return 1;
    const absT = Math.abs(t);
    if (absT > 1e6) return 0;
    const p = 2 * (1 - tCDF(absT, df));
    return Math.min(1, Math.max(0, p));
};

Math.logGamma = function(z) {
    if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - Math.logGamma(1 - z);
    z -= 1;
    const x = 0.99999999999980993, b = 676.5203681218851, c = -1259.1392167224028, 
          d = 771.32342877765313, e = -176.61502916214059, f = 12.507343278686905,
          g = -0.13857109526572012, h = 9.9843695780195716e-6, i = 1.5056327351493116e-7;
    let sum = x;
    for (let j = 1; j < 9; j++) {
        sum += [b, c, d, e, f, g, h, i][j-1] / (z + j);
    }
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + Math.log(sum) + (z + 0.5) * Math.log(t) - t;
};

// ====== 新增：秩次计算 (用于 Spearman) ======
const getRanks = (arr) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < sorted.length) {
        let j = i;
        while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
        const rank = (i + 1 + j) / 2;
        for (let k = i; k < j; k++) ranks[sorted[k].i] = rank;
        i = j;
    }
    return ranks;
};

// ====== 新增：Spearman 相关系数 ======
const spearmanCorrelationMatrix = (data, varNames) => {
    const n = varNames.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    const ranksCache = varNames.map(v => getRanks(data.map(r => parseFloat(r[v]))));
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) { matrix[i][j] = 1; continue; }
            if (j < i) { matrix[i][j] = matrix[j][i]; continue; }
            
            const xRanks = ranksCache[i];
            const yRanks = ranksCache[j];
            const mx = mean(xRanks), my = mean(yRanks);
            
            const num = xRanks.reduce((sum, xi, idx) => sum + (xi - mx) * (yRanks[idx] - my), 0);
            const denX = xRanks.reduce((sum, xi) => sum + Math.pow(xi - mx, 2), 0);
            const denY = yRanks.reduce((sum, yi) => sum + Math.pow(yi - my, 2), 0);
            
            matrix[i][j] = (denX === 0 || denY === 0) ? 0 : (num / Math.sqrt(denX * denY));
            matrix[j][i] = matrix[i][j];
        }
    }
    return matrix;
};

// ====== 新增：Kendall Tau-b 相关系数 ======
const kendallCorrelationMatrix = (data, varNames) => {
    const n = varNames.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    const numRows = data.length;
    if (numRows < 2) return matrix;

    const cols = varNames.map(v => data.map(r => parseFloat(r[v])));

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) { matrix[i][j] = 1; continue; }
            if (j < i) { matrix[i][j] = matrix[j][i]; continue; }

            const x = cols[i], y = cols[j];
            let concordant = 0, discordant = 0, tX = 0, tY = 0;

            for (let a = 0; a < numRows; a++) {
                for (let b = a + 1; b < numRows; b++) {
                    const dx = x[a] - x[b];
                    const dy = y[a] - y[b];
                    if (dx * dy > 0) concordant++;
                    else if (dx * dy < 0) discordant++;
                    if (dx === 0) tX++;
                    if (dy === 0) tY++;
                }
            }
            const n0 = numRows * (numRows - 1) / 2;
            const den = Math.sqrt((n0 - tX) * (n0 - tY));
            matrix[i][j] = den === 0 ? 0 : (concordant - discordant) / den;
            matrix[j][i] = matrix[i][j];
        }
    }
    return matrix;
};

window.MatrixUtils = {
    transpose, multiply, invert, getColumn, mean, std, variance, min, max, sum,
    cleanStataName, cleanData, correlationMatrix, tProb,
    spearmanCorrelationMatrix, kendallCorrelationMatrix
};

// 添加 runMiniReghdfe 函数定义，用于面板固定效应等
window.runMiniReghdfe = function(yName, xNames, data, absorbVars, seType = 'ordinary', clusterVar = null) {
    try {
        const cleanData = data.filter(r => {
            if (r[yName] == null || r[yName] === '' || isNaN(parseFloat(r[yName]))) return false;
            for (let x of xNames) if (r[x] == null || r[x] === '' || isNaN(parseFloat(r[x]))) return false;
            for (let fe of absorbVars) if (fe && (r[fe] == null || r[fe] === '')) return false;
            if (clusterVar && (r[clusterVar] == null || r[clusterVar] === '')) return false;
            return true;
        });

        const n = cleanData.length; const k = xNames.length;
        if (n <= k + 1) return null;

        let mat = cleanData.map(r => [parseFloat(r[yName]), ...xNames.map(x => parseFloat(r[x]))]);
        let validAbsorb = absorbVars.filter(v => v);

        if (validAbsorb.length > 0) {
            for(let iter=0; iter<5; iter++) {
                for(let fe of validAbsorb) {
                    const feData = cleanData.map(r => r[fe]);
                    const sums = {}, counts = {};
                    for(let i=0; i<n; i++) {
                        const g = feData[i];
                        if(!sums[g]) { sums[g] = new Float64Array(k+1); counts[g]=0; }
                        counts[g]++;
                        for(let j=0; j<=k; j++) sums[g][j] += mat[i][j];
                    }
                    for(let g in sums) for(let j=0; j<=k; j++) sums[g][j] /= counts[g];
                    for(let i=0; i<n; i++) {
                        const g = feData[i];
                        for(let j=0; j<=k; j++) mat[i][j] -= sums[g][j];
                    }
                }
            }
        }

        const Y_dem = mat.map(r => [r[0]]);
        const X_dem = mat.map(r => r.slice(1));
        const X_T = MatrixUtils.transpose(X_dem);
        const XTX = MatrixUtils.multiply(X_T, X_dem);
        const XTX_inv = MatrixUtils.invert(XTX);
        const XTY = MatrixUtils.multiply(X_T, Y_dem);
        const beta = MatrixUtils.multiply(XTX_inv, XTY);
        
        const Y_pred = MatrixUtils.multiply(X_dem, beta);
        const residuals = Y_dem.map((y, i) => [y[0] - Y_pred[i][0]]);
        const rss = residuals.reduce((sum, r) => sum + r[0]*r[0], 0);
        
        let num_fe = 0;
        validAbsorb.forEach(fe => { num_fe += new Set(cleanData.map(r => r[fe])).size - 1; });
        num_fe += 1; 
        
        const df_res = Math.max(1, n - k - num_fe);
        const sigma2 = rss / df_res;
        
        let varCovar;
        if (seType === 'cluster' && clusterVar) {
            const clusters = {};
            cleanData.forEach((row, i) => { const c = row[clusterVar]; if (!clusters[c]) clusters[c] = []; clusters[c].push(i); });
            const G = Object.keys(clusters).length;
            const meat = Array(k).fill(0).map(() => Array(k).fill(0));
            Object.values(clusters).forEach(idxList => {
                const clusterRes = idxList.map(i => residuals[i]);
                const clusterX = idxList.map(i => X_dem[i]);
                const clusterScore = MatrixUtils.multiply(MatrixUtils.transpose(clusterX), clusterRes);
                for(let i=0; i<k; i++) for(let j=0; j<k; j++) meat[i][j] += clusterScore[i][0] * clusterScore[j][0];
            });
            varCovar = MatrixUtils.multiply(MatrixUtils.multiply(XTX_inv, meat), XTX_inv);
            const df_c = (G / (G - 1)) * ((n - 1) / df_res);
            varCovar = varCovar.map(row => row.map(v => v * df_c));
        } else if (seType === 'robust') {
            const meat = Array(k).fill(0).map(() => Array(k).fill(0));
            for(let i=0; i<n; i++) {
                const e2 = residuals[i][0] * residuals[i][0];
                for(let r=0; r<k; r++) {
                    for(let c=0; c<k; c++) {
                        meat[r][c] += X_dem[i][r] * X_dem[i][c] * e2;
                    }
                }
            }
            varCovar = MatrixUtils.multiply(MatrixUtils.multiply(XTX_inv, meat), XTX_inv);
            const df_r = n / df_res;
            varCovar = varCovar.map(row => row.map(v => v * df_r));
        } else {
            varCovar = XTX_inv.map(row => row.map(v => v * sigma2));
        }
        
        const tss = Y_dem.reduce((sum,y)=>sum+y[0]*y[0],0);
        const r2 = tss === 0 ? 0 : 1 - rss/tss;
        
        const coefs = {};
        for(let i=0; i<k; i++){
            const b = beta[i][0]; const se = Math.sqrt(Math.max(0, varCovar[i][i]));
            coefs[xNames[i]] = { coef: b, se: se, t: b/se, p: MatrixUtils.tProb(b/se, df_res) };
        }
        return { coefs, n, r2: r2.toFixed(4) };
    } catch(e) { return null; }
};