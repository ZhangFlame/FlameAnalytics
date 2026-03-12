/**
 * =========================================================
 * 在线 Stata/Python 实证分析 - Vue 3 主应用中枢
 * BY张张 | 关注公众号：张张小栈，解锁代码级科研外挂
 * =========================================================
 */

// 🌟 1. 配置你的模块注册表 🌟
const MODULE_DIRECTORY = {
    'econometrics': ['desc', 'ols', 'fe', 're', 'iv', 'mediation', 'entropy'],
    'machine_learning': ['rf', 'lasso', 'ga'],
    'plotting': ['scatter', 'heatmap', 'boxplot', 'timeseries', 'volcano', 'dumbbell', 'manhattan', 'funnel', 'sankey', 'map_china']
};

const { createApp, ref, computed, watch, onMounted, onUnmounted } = Vue;

const app = createApp({
    setup() {
        const originalRawData = ref([]);
        const rawData = ref([]);
        const variables = ref([]);
        const uploadedFileName = ref('dataset.dta');
        const fileEncoding = ref('utf8');

        const detectedEntityCandidates = ref([]);
        const detectedYearCandidates = ref([]);

        const moduleCategory = ref('econometrics');
        const modelType = ref('desc');

        const tagTypeMap = {
            y: 'danger', x: 'success', c: 'info', z: 'primary',
            m: 'success', w: 'warning', pos: 'warning', neg: 'danger'
        };

        const formValues = ref({});
        const extraConfigs = ref({});

        const isCalculating = ref(false);
        const hasResult = ref(false);
        const activeTab = ref('table');
        const stataCode = ref('');

        const realStats = ref({});
        const realEntropyResult = ref([]);
        const regressionResults = ref({});
        const entropyScoreData = ref([]);
        const descResults = ref({});
        const ivResults = ref({});
        const medModResults = ref({});
        const mlResults = ref({});
        const modelResults = ref(null);

        // ✨ 新增：控制欢迎启动弹窗的可见性（默认打开）
        const welcomeDialogVisible = ref(true);
        const uploadDialogVisible = ref(false);
        const previewDialogVisible = ref(false);

        const tips = [
        // ========== 原有保留 ==========
        "✨ 选中变量点「处理」，表格和分析命令将实时全自动更新",
        "📌 中文带括号变量会自动清洗成代码安全命名规则",
        "🎯 原地突变引擎，支持随时还原为原始状态",
        "⚡ 结果表格排版完毕，可一键复制进 Word",
        "📋 变量处理不仅更名，更是对底层矩阵数据的真实置换",
        "🔥 点击「一键运行」即时生成实证结果与代码",
        "💡 处理后的变量自动添加 _ln、_winsor 等后缀",
        "🚀 支持 CSV/Excel 直接拖拽上传，无需转换",
        "📈 从上传到结果仅需三步：选变量→设模型→运行",
        "🎓 内置 OLS、Logit、Tobit 等主流计量模型",
        "⚙️ 所有计算在浏览器本地完成，数据不上传",
        "📊 结果表格含标准误、t值、p值及显著性星标",
        "⏱️ 长耗时运算显示优雅加载动画，拒绝假死",
        "🧪 每一个处理步骤都可逆，放心尝试",
        "📚 支持面板数据固定效应/随机效应一键切换",
        "🌟 张张出品，持续更新，科研之路我们相伴",
        "🔄 切换模型时自动保留已填变量，减少重复劳动",
        "📑 代码面板一键复制，无缝对接到 Stata/Python",
        "💪 即使只有一行数据，也能生成规范分析代码",
        "🎯 你的每一个点击，背后都是严谨的统计计算",
        "📌 变量分配区支持多选，控制变量轻松搞定",
        "🧠 智能识别数值型/分类变量，错误配置自动提醒",
        "🔍 鼠标悬停变量名可查看完整名称，杜绝截断",
        "📦 所有处理后的数据均可下载，便于离线复核",
        "📐 缩尾处理可自定义上下百分位（如 1%-99%）",
        "📏 标准化/中心化一键完成，变量间可比",
        "🧪 对数变换支持 ln(x) 和 ln(x+1)，零值友好",
        "📉 一阶差分和滞后一期自动处理时间序列",
        "📊 熵权法自动计算权重，无需手动干预",
        "📈 相关性矩阵一键生成，带显著性星标",
        "📋 描述性统计表格包含 N、均值、标准差",
        "📌 方差膨胀因子(VIF)自动检测多重共线性",
        "📘 工具变量回归两步自动完成（2SLS）",
        "📗 倾向性得分匹配自动匹配样本（PSM）",
        "📙 时间序列平稳性检验（ADF）直接输出",
        "📉 协整检验与格兰杰因果一键生成",
        "📊 面板数据支持个体/时间双固定效应",
        "📈 动态面板差分GMM与系统GMM可选",
        "📋 中介效应三步法自动计算置信区间",
        "📌 调节效应交互项自动生成，无需手动构造",
        "📘 分组回归一键输出，表格自动分栏",
        "📗 输出表格支持三线表样式，顶刊规范",
        "📙 同时生成 Stata 和 Python 代码，任你选择",
        "📝 每个模型附带参考文献引用格式（APA）",
        "🧑‍🏫 适合本科/硕士/博士论文实证部分",
        "💼 也可用于企业数据分析与商业报告",
        "🌍 中英文变量名皆可识别，无需额外配置",
        "📱 响应式设计，平板手机也能流畅操作",
        "💾 所有结果可导出为 CSV 文件，永久保存",
        "🔗 分享链接即可复现分析，助力合作研究",
        "🔄 模型库每月更新，紧跟学术前沿",

        // ========== 励志诗句/短句 ==========
        "📜 宝剑锋从磨砺出，梅花香自苦寒来",
        "📜 长风破浪会有时，直挂云帆济沧海",
        "📜 千淘万漉虽辛苦，吹尽狂沙始到金",
        "📜 路漫漫其修远兮，吾将上下而求索",
        "📜 不经一番寒彻骨，怎得梅花扑鼻香",
        "📜 业精于勤荒于嬉，行成于思毁于随",
        "📜 纸上得来终觉浅，绝知此事要躬行",
        "📜 博观而约取，厚积而薄发",
        "📜 学无止境，勇攀高峰",
        "📜 持之以恒，必有回响",
        "📜 你的每一份努力，论文都会记得",
        "📜 今日埋头苦干，明日 paper 在手"
    ];
        const randomTip = ref(tips[0]);
        let tipTimeout = null;

        const scheduleTipUpdate = () => {
            const nextDelay = Math.floor(Math.random() * 9000) + 1000;
            tipTimeout = setTimeout(() => {
                randomTip.value = tips[Math.floor(Math.random() * tips.length)];
                scheduleTipUpdate();
            }, nextDelay);
        };

        onMounted(() => scheduleTipUpdate());
        onUnmounted(() => { if (tipTimeout) clearTimeout(tipTimeout); });

        const currentModel = computed(() => ModelRegistry.get(modelType.value));
        const modelNameDisplay = computed(() => currentModel.value?.name || '');
        const currentSlots = computed(() => currentModel.value?.slots || []);
        const currentExtraConfigs = computed(() => currentModel.value?.extraConfigs || []);
        const allVars = computed(() => [...(formValues.value.x || []), ...(formValues.value.c || [])]);

        const dataProcessingStepsStata = computed(() => {
            const steps = [];
            const cmdsObj = VariableProcessor.processingCmds.value || {};
            for (const cmds of Object.values(cmdsObj)) {
                if (Array.isArray(cmds)) steps.push(...cmds.map(c => c.stata));
            }
            return steps;
        });

        const dataProcessingStepsPython = computed(() => {
            const steps = [];
            const cmdsObj = VariableProcessor.processingCmds.value || {};
            for (const cmds of Object.values(cmdsObj)) {
                if (Array.isArray(cmds)) steps.push(...cmds.map(c => c.python));
            }
            return steps;
        });

        const cleanStataName = (name) => {
            if (window.MatrixUtils && window.MatrixUtils.cleanStataName) {
                return window.MatrixUtils.cleanStataName(name);
            }
            if (!name) return '';
            let cleaned = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
            if (/^[0-9]/.test(cleaned)) cleaned = '_' + cleaned;
            return cleaned;
        };

        const encodingMapToStata = {
            'utf-8': 'utf8', 'gbk': 'gb18030', 'gb2312': 'gb18030', 'big5': 'big5',
            'shift-jis': 'shift_jis', 'euc-kr': 'euc_kr', 'utf-16le': 'utf16le', 'iso-8859-1': 'latin1'
        };

        const handleCategoryChange = () => {
            resetResults();
            const models = ModelRegistry.getModelsByCategory(moduleCategory.value);
            if (models.length > 0) {
                modelType.value = models[0].id;
                initFormValues();
            } else {
                modelType.value = null;
            }
        };

        const initFormValues = () => {
            const model = currentModel.value;
            if (!model) return;

            const newForm = {};
            model.slots.forEach(slot => {
                if (slot.type === 'single' || slot.type === 'entropy') {
                    newForm[slot.key] = null;
                } else if (slot.type === 'multiple') {
                    newForm[slot.key] = [];
                }
            });
            formValues.value = newForm;

            const newExtra = {};
            model.extraConfigs.forEach(cfg => {
                if(cfg.type !== 'title') {
                    newExtra[cfg.key] = cfg.default !== undefined ? cfg.default : null;
                }
            });
            extraConfigs.value = newExtra;

            if (detectedEntityCandidates.value.length > 0 &&
                extraConfigs.value.hasOwnProperty('entityVar') &&
                extraConfigs.value.entityVar === null) {
                extraConfigs.value.entityVar = detectedEntityCandidates.value[0];
            }

            if (detectedYearCandidates.value.length > 0 &&
                extraConfigs.value.hasOwnProperty('yearVar') &&
                extraConfigs.value.yearVar === null) {
                extraConfigs.value.yearVar = detectedYearCandidates.value[0];
            }
        };

        watch(modelType, () => initFormValues());

        let manualPromptTimeout = null;
        const promptManualRun = () => {
            if (manualPromptTimeout) return;
            ElementPlus.ElMessage.warning({
                message: '🛠️ 配置已修改！为避免卡顿，请在调整完毕后，统一手动点击「一键运行」更新结果。',
                type: 'warning',
                duration: 3500,
                grouping: true
            });
            manualPromptTimeout = setTimeout(() => { manualPromptTimeout = null; }, 3500);
        };

        const autoRunAnalysis = () => {
            clearTimeout(window._autoRunTimeout);
            window._autoRunTimeout = setTimeout(() => {
                runAnalysis();
            }, 600);
        };

        watch(extraConfigs, () => { 
            if (hasResult.value && modelType.value) { 
                generateStataCode(); 
                if (moduleCategory.value === 'machine_learning') {
                    promptManualRun();
                } else if (moduleCategory.value !== 'plotting') {
                    autoRunAnalysis(); 
                }
            } 
        }, { deep: true });

        watch(formValues, () => { 
            if (hasResult.value && modelType.value) { 
                generateStataCode(); 
                if (moduleCategory.value === 'machine_learning') {
                    promptManualRun();
                } else {
                    autoRunAnalysis(); 
                }
            } 
        }, { deep: true });

        const fastCsvParse = (text) => {
            let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0;
            for (let char of text) {
                if ('"' === char) {
                    if (s && char === p) row[i] += char;
                    s = !s;
                } else if (',' === char && s) char = row[++i] = '';
                else if ('\n' === char && s) {
                    if ('\r' === p) row[i] = row[i].slice(0, -1);
                    row = ret[++r] = [char = '']; i = 0;
                } else row[i] += char;
                p = char;
            }
            if (ret.length > 0 && ret[ret.length - 1].length === 1 && ret[ret.length - 1][0] === '') {
                ret.pop();
            }
            if (ret.length < 2) return [];
            
            let headers = ret[0].map(h => h.trim());
            const json = [];
            for(let rIdx = 1; rIdx < ret.length; rIdx++) {
                const obj = {};
                let hasVal = false;
                const currRow = ret[rIdx];
                for(let cIdx = 0; cIdx < headers.length; cIdx++) {
                    const header = headers[cIdx] || `__EMPTY_${cIdx}`;
                    let val = currRow[cIdx];
                    if (val !== undefined) val = val.trim();
                    if (val !== undefined && val !== '') {
                        const num = Number(val);
                        obj[header] = (!isNaN(num)) ? num : val;
                        hasVal = true;
                    } else {
                        obj[header] = null;
                    }
                }
                if (hasVal) json.push(obj);
            }
            return json;
        };

        const handleFileUpload = (uploadFile) => {
            const loading = ElementPlus.ElLoading.service({
                lock: true, text: '张张正在拼命解析数据中，请稍候...', background: 'rgba(255, 255, 255, 0.65)', customClass: 'glassy-loading'
            });

            setTimeout(() => {
                const file = uploadFile.raw;
                uploadedFileName.value = file.name;
                const isCSV = file.name.toLowerCase().endsWith('.csv');
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        let json = [];
                        let detectedEnc = 'utf-8';

                        if (isCSV) {
                            const encodings = ['utf-8', 'gbk', 'gb2312', 'big5', 'shift-jis', 'euc-kr', 'utf-16le'];
                            let text = null;
                            let bestText = null;
                            let minReplacementCount = Infinity;

                            for (const encoding of encodings) {
                                try {
                                    const decoded = new TextDecoder(encoding).decode(e.target.result);
                                    const replacementCount = (decoded.match(/\ufffd/g) || []).length;
                                    if (replacementCount === 0) { text = decoded; detectedEnc = encoding; break; }
                                    if (replacementCount < minReplacementCount) { minReplacementCount = replacementCount; bestText = decoded; detectedEnc = encoding; }
                                } catch (err) {}
                            }

                            if (text === null) { text = bestText !== null ? bestText : new TextDecoder('utf-8').decode(e.target.result); detectedEnc = 'utf-8'; }
                            fileEncoding.value = encodingMapToStata[detectedEnc] || 'utf8';
                            json = fastCsvParse(text);
                        } else {
                            fileEncoding.value = 'utf8';
                            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                            json = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                            json = json.filter(row => Object.values(row).some(val => val !== null && val !== undefined));
                        }

                        if (json.length > 0) {
                            if (json.length > 1000) {
                                json = json.slice(0, 1000);
                                ElementPlus.ElMessage.warning({
                                    message: '🚨 张张提示：数据集超过1000行！为了防止浏览器卡死，网页端已自动截取前 1000 行用于功能演示。请务必使用生成的代码在本地运行以获得全量真实结果。',
                                    duration: 8000,
                                    showClose: true
                                });
                            }

                            detectedEntityCandidates.value = []; detectedYearCandidates.value = [];
                            clearSlots();
                            stataCode.value = ''; activeTab.value = 'table';
                            VariableProcessor.activeToOriginalMap.value = {};
                            VariableProcessor.processingCmds.value = {};
                            VariableProcessor.appliedProcessing.value = {};

                            originalRawData.value = json;
                            rawData.value = json.map(row => ({ ...row }));
                            variables.value = Object.keys(json[0]).filter(k => !k.includes('__EMPTY') && !k.startsWith('__'));

                            const yearCandidates = variables.value.filter(v => { const lower = v.toLowerCase(); return lower.includes('year') || lower.includes('年份') || lower.includes('时间'); });
                            const idCandidates = variables.value.filter(v => { const lower = v.toLowerCase(); return lower.includes('code') || lower.includes('代码') || lower.includes('id') || lower.includes('序号'); });

                            detectedEntityCandidates.value = idCandidates;
                            detectedYearCandidates.value = yearCandidates;

                            if (yearCandidates.length > 0 && currentExtraConfigs.value.some(c => c.key === 'yearVar')) extraConfigs.value.yearVar = yearCandidates[0];
                            if (idCandidates.length > 0 && currentExtraConfigs.value.some(c => c.key === 'entityVar')) extraConfigs.value.entityVar = idCandidates[0];

                            ElementPlus.ElMessage.success(`导入成功！共 ${variables.value.length} 个变量，当前截取 ${json.length} 条数据进行演示`);
                        } else {
                            rawData.value = []; originalRawData.value = []; variables.value = [];
                            ElementPlus.ElMessage.warning('数据文件似乎是个空壳子哦');
                        }
                    } catch (err) {
                        ElementPlus.ElMessage.error("张张提示：数据解析失败，请检查文件格式！");
                    } finally {
                        uploadDialogVisible.value = false;
                        loading.close();
                    }
                };
                reader.readAsArrayBuffer(file);
            }, 100);
        };

        const assignVar = (v, type) => {
            const model = currentModel.value;
            if (!model) return;

            if (type === 'e-pos' || type === 'e-neg') {
                if (!formValues.value.indicators) formValues.value.indicators = [];
                const direction = type === 'e-pos' ? 'positive' : 'negative';
                const existingIdx = formValues.value.indicators.findIndex(item => item.name === v);

                if (existingIdx !== -1) {
                    if (formValues.value.indicators[existingIdx].direction === direction) formValues.value.indicators.splice(existingIdx, 1);
                    else formValues.value.indicators[existingIdx].direction = direction;
                } else {
                    Object.keys(formValues.value).forEach(key => {
                        if (key === 'indicators') return;
                        const slot = model.slots.find(s => s.key === key);
                        if (!slot) return;
                        if (slot.type === 'single' && formValues.value[key] === v) formValues.value[key] = null;
                        else if (slot.type === 'multiple') {
                            const idx = formValues.value[key]?.indexOf(v);
                            if (idx !== -1) formValues.value[key].splice(idx, 1);
                        }
                    });
                    formValues.value.indicators.push({ name: v, direction: direction });
                }
                return;
            }

            const targetSlot = model.slots.find(s => s.key === type);
            if (!targetSlot) return;

            const removeVarFromAllSlots = () => {
                Object.keys(formValues.value).forEach(key => {
                    const slot = model.slots.find(s => s.key === key);
                    if (!slot) return;
                    if (slot.type === 'single') { if (formValues.value[key] === v) formValues.value[key] = null; }
                    else if (slot.type === 'multiple') {
                        const idx = formValues.value[key]?.indexOf(v);
                        if (idx !== -1) formValues.value[key].splice(idx, 1);
                    }
                });
            };

            let isInTarget = targetSlot.type === 'single' ? formValues.value[type] === v : (formValues.value[type]?.includes(v) || false);

            if (isInTarget) {
                if (targetSlot.type === 'single') formValues.value[type] = null;
                else if (targetSlot.type === 'multiple') formValues.value[type].splice(formValues.value[type].indexOf(v), 1);
            } else {
                removeVarFromAllSlots();
                if (targetSlot.type === 'single') formValues.value[type] = v;
                else if (targetSlot.type === 'multiple') {
                    if (!formValues.value[type]) formValues.value[type] = [];
                    if (targetSlot.max && formValues.value[type].length >= targetSlot.max) {
                        ElementPlus.ElMessage.warning(`该槽位最多只能选择 ${targetSlot.max} 个变量`); return;
                    }
                    formValues.value[type].push(v);
                }
            }
        };

        const removeEntropyVar = (idx) => { if (formValues.value.indicators) formValues.value.indicators.splice(idx, 1); };

        const clearSlots = () => { formValues.value = {}; extraConfigs.value = {}; hasResult.value = false; };
        const resetResults = () => { hasResult.value = false; };

        const updateSlots = (oldName, newName) => {
            Object.keys(formValues.value).forEach(key => {
                const val = formValues.value[key];
                if (Array.isArray(val)) {
                    const idx = val.indexOf(oldName);
                    if (idx !== -1) val.splice(idx, 1, newName);
                } else if (val === oldName) formValues.value[key] = newName;
            });
            if (formValues.value.indicators) formValues.value.indicators.forEach(item => { if (item.name === oldName) item.name = newName; });
            Object.keys(extraConfigs.value).forEach(key => { if (extraConfigs.value[key] === oldName) extraConfigs.value[key] = newName; });
        };

        const runAnalysis = () => {
            const model = currentModel.value;
            if (!model) return;

            if (!model.validate(formValues.value, extraConfigs.value)) { 
                if (!hasResult.value) ElementPlus.ElMessage.warning("请完整配置所有必需槽位"); 
                return; 
            }

            let checkVars = [];
            if (model.id === 'desc') checkVars = formValues.value.x || [];
            else if (model.id === 'entropy') checkVars = (formValues.value.indicators || []).map(e => e.name);
            else {
                Object.keys(formValues.value).forEach(key => {
                    if (key === 'indicators') return;
                    
                    const slotDef = model.slots ? model.slots.find(s => s.key === key) : null;
                    if (slotDef && slotDef.tagType === 'c') return; 

                    const val = formValues.value[key];
                    checkVars = checkVars.concat(Array.isArray(val) ? val : (val && typeof val === 'object' && val.name ? [val.name] : (val ? [val] : [])));
                });
            }

            if (checkVars.length > 0) {
                const validRows = rawData.value.filter(row => checkVars.every(v => {
                    if (row[v] === null || row[v] === undefined || String(row[v]).trim() === '') return false;
                    const cleanStr = String(row[v]).replace(/[^\d.-]/g, ''); 
                    return !isNaN(parseFloat(cleanStr));
                }));
                if (validRows.length === 0) {
                    ElementPlus.ElMessage.error(`🚫 样本量不足！剔除包含文字、空格的脏数据后，仅剩 0 条有效数据！`);
                    return;
                }
            }

            isCalculating.value = true;
            setTimeout(() => {
                try {
                    const result = model.run(formValues.value, rawData.value, extraConfigs.value);
                    modelResults.value = result;

                    if (model.id === 'entropy') {
                        realEntropyResult.value = result.weights;
                        realStats.value = { obs: result.n, scoreMean: result.scoreMean, scoreMax: result.scoreMax };
                        const combined = result.cleanData.map((row, idx) => ({ ...row, _Score: Number(result.scores[idx]).toFixed(5) }));
                        combined.sort((a, b) => b._Score - a._Score);
                        entropyScoreData.value = combined.slice(0, 100);
                    } else if (model.id === 'desc') descResults.value = result;
                    else if (model.id === 'iv') ivResults.value = result;
                    else if (model.id === 'mediation' || model.id === 'moderation') medModResults.value = result;
                    else if (model.category === 'machine_learning' || model.category === 'plotting') mlResults.value = result;
                    else {
                        regressionResults.value = result;
                        const statsRef = result.m2 || result.m1;
                        if (statsRef) realStats.value = { obs: statsRef.n, r2: statsRef.r2, fstat: statsRef.fStat, entities: statsRef.entities || '-', time: statsRef.time || '-' };
                    }
                    generateStataCode();
                    
                    if (!hasResult.value) {
                        if (moduleCategory.value === 'machine_learning') {
                            ElementPlus.ElMessage.success("计算完成！(注：机器学习模型比较吃算力，后续修改配置后请手动点击运行哦)");
                        } else {
                            ElementPlus.ElMessage.success("计算完成！现在任意调整参数都会自动无缝刷新啦~");
                        }
                    } else if (moduleCategory.value === 'machine_learning') {
                        ElementPlus.ElMessage.success("模型结果已手动刷新！");
                    }
                    
                    hasResult.value = true;
                    activeTab.value = 'table';
                } catch (err) {
                    console.error(err);
                    ElementPlus.ElMessage.error("分析中断，张张诊断报错原因：" + err.message);
                } finally {
                    isCalculating.value = false;
                }
            }, 50);
        };

        const formatCoef = (res, v) => {
            if (res && res.coefs && res.coefs[v]) {
                const val = res.coefs[v];
                const stars = val.p < 0.01 ? '***' : val.p < 0.05 ? '**' : val.p < 0.1 ? '*' : '';
                return val.coef.toFixed(4) + stars;
            } return '';
        };
        const formatSE = (res, v) => (res && res.coefs && res.coefs[v]) ? '(' + res.coefs[v].se.toFixed(4) + ')' : '';
        const formatConst = (res) => formatCoef(res, '_cons');
        const formatConstSE = (res) => formatSE(res, '_cons');
        const formatCoefDirect = (val) => { const stars = val.p < 0.01 ? '***' : val.p < 0.05 ? '**' : val.p < 0.1 ? '*' : ''; return val.coef.toFixed(4) + stars; };
        const getVif = (v) => regressionResults.value.m4?.coefs[v]?.vif || regressionResults.value.m2?.coefs[v]?.vif || regressionResults.value.m1?.coefs[v]?.vif || '-';
        const getHeatMapColor = (val) => {
            const parsed = parseFloat(val); if (isNaN(parsed)) return "transparent";
            const alpha = (Math.abs(parsed) * 0.6).toFixed(2);
            if (parsed > 0) return `rgba(239, 68, 68, ${alpha})`;
            if (parsed < 0) return `rgba(59, 130, 246, ${alpha})`;
            return "transparent";
        };

        const predefineColors = ref([
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#0f172a', '#64748b'
        ]);

        const formatters = { formatCoef, formatSE, formatConst, formatConstSE, formatCoefDirect, getVif, getHeatMapColor };

        const currentResultComponent = computed(() => currentModel.value?.resultComponent || null);
        const currentFormulaComponent = computed(() => currentModel.value?.formulaComponent || null);

        const generateStataCode = () => {
            const model = currentModel.value;
            if (!model) return;
            const fileInfo = { fileName: uploadedFileName.value, fileEncoding: fileEncoding.value };
            const processingSteps = model.category === 'machine_learning' || model.category === 'plotting' ? dataProcessingStepsPython.value : dataProcessingStepsStata.value;
            let enhancedProcessingSteps = processingSteps;

            if (model.category === 'econometrics') {
                const allVarNames = new Set();
                Object.values(formValues.value).forEach(val => {
                    if (Array.isArray(val)) val.forEach(item => { if (typeof item === 'string') allVarNames.add(item); else if (item && item.name) allVarNames.add(item.name); });
                    else if (val && typeof val === 'string') allVarNames.add(val);
                });
                Object.values(extraConfigs.value).forEach(val => { if (val && typeof val === 'string') allVarNames.add(val); });
                const originalVars = new Set();
                allVarNames.forEach(v => {
                    let curr = v; while (VariableProcessor.activeToOriginalMap.value[curr]) curr = VariableProcessor.activeToOriginalMap.value[curr];
                    originalVars.add(curr);
                });
                const destringCmd = originalVars.size > 0 ? `cap destring ${Array.from(originalVars).map(v => MatrixUtils.cleanStataName(v)).join(' ')}, replace force\n` : '';
                if (destringCmd) enhancedProcessingSteps = [destringCmd, ...processingSteps];
            }
            
            let code = model.generateCode(formValues.value, extraConfigs.value, fileInfo, enhancedProcessingSteps);

            if (model.category === 'machine_learning' || model.category === 'plotting') {
                const lowerName = uploadedFileName.value.toLowerCase();
                let correctLoadCode = '';
                
                const pyEncodingMap = {
                    'utf8': 'utf-8', 'gb18030': 'gb18030', 'big5': 'big5', 
                    'shift_jis': 'shift_jis', 'euc_kr': 'euc_kr', 'utf16le': 'utf-16le', 'latin1': 'latin1'
                };
                let enc = pyEncodingMap[fileEncoding.value] || 'utf-8';
                
                if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) {
                    correctLoadCode = `pd.read_excel("${uploadedFileName.value}")`;
                } else if (lowerName.endsWith('.dta')) {
                    correctLoadCode = `pd.read_stata("${uploadedFileName.value}")`;
                } else {
                    correctLoadCode = `pd.read_csv("${uploadedFileName.value}", encoding='${enc}')`;
                }
                
                code = code.replace(/pd\.read_csv\(['"][^'"]+['"]\)/g, correctLoadCode);
            }

            stataCode.value = code;
        };

        const copyStataCode = () => {
            navigator.clipboard.writeText(stataCode.value).then(() => {
                ElementPlus.ElMessage.success("代码已就绪！去挥洒汗水吧~ BY张张");
            }).catch(() => {
                const textArea = document.createElement("textarea"); textArea.value = stataCode.value; document.body.appendChild(textArea);
                textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea); ElementPlus.ElMessage.success("代码已复制（降级方案）");
            });
        };

        VariableProcessor.setDeps({ rawData, originalRawData, variables, extraConfigs, hasResult, runAnalysis, generateStataCode, updateSlots, cleanStataName });

        window._appInitFormValues = initFormValues;

        return {
            rawData, variables, uploadedFileName, modelType, moduleCategory, tagTypeMap, formValues, extraConfigs,
            currentModel, currentSlots, currentExtraConfigs, isCalculating, hasResult, activeTab, realStats, realEntropyResult,
            modelNameDisplay, stataCode, regressionResults, allVars, modelResults, formatters, uploadDialogVisible, previewDialogVisible,
            welcomeDialogVisible, // ✨ 返回暴露给模板
            randomTip, entropyScoreData, descResults, fileEncoding, ivResults, medModResults, mlResults,
            activeToOriginalMap: VariableProcessor.activeToOriginalMap, appliedProcessing: VariableProcessor.appliedProcessing, ModelRegistry,
            handleFileUpload, handleCategoryChange, assignVar, processVar: VariableProcessor.processVar, removeEntropyVar, clearSlots,
            resetResults, runAnalysis, copyStataCode, formatCoef, formatSE, formatConst, formatConstSE, formatCoefDirect, getVif, getHeatMapColor,
            currentResultComponent, currentFormulaComponent, predefineColors
        };
    }
});

app.component('config-grid', {
    props: ['configSchema', 'modelValue', 'variables', 'predefineColors'],
    template: `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px 16px; padding: 4px;">
            <template v-for="cfg in configSchema" :key="cfg.key || cfg.label">
                <div v-if="cfg.type === 'title'" class="config-group-title">
                    {{ cfg.label }}
                </div>
                
                <div v-else style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 12px; color: #475569; white-space: nowrap; flex-shrink: 0;">{{ cfg.label }}</span>
                    <div style="flex: 1; min-width: 0; display: flex; align-items: center;">
                        <template v-if="cfg.type === 'select'">
                            <el-select v-model="modelValue[cfg.key]" :placeholder="cfg.label" clearable size="small" style="width:100%" 
                                :teleported="false" popper-class="custom-dropdown-panel">
                                <template v-if="cfg.options">
                                    <el-option v-for="opt in cfg.options" :key="opt.value" :label="opt.label" :value="opt.value"></el-option>
                                </template>
                                <template v-else>
                                    <el-option v-for="v in variables" :key="v" :label="v" :value="v"></el-option>
                                </template>
                            </el-select>
                        </template>
                        <template v-else-if="cfg.type === 'input'">
                            <el-input v-model="modelValue[cfg.key]" :placeholder="cfg.label" clearable size="small" style="width:100%"></el-input>
                        </template>
                        <template v-else-if="cfg.type === 'color'">
                            <el-color-picker v-model="modelValue[cfg.key]" show-alpha :predefine="predefineColors" size="small" style="width:100%" :teleported="false"></el-color-picker>
                        </template>
                        <template v-else-if="cfg.type === 'switch'">
                            <el-switch v-model="modelValue[cfg.key]" active-color="#2563eb" inactive-color="#cbd5e1" size="small"></el-switch>
                        </template>
                    </div>
                </div>
            </template>
        </div>
    `
});

const bootstrapApp = async () => {
    const loader = document.createElement('div');
    loader.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,255,255,0.9); backdrop-filter:blur(5px); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif;">
            <div style="width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: clean-spin 1s linear infinite;"></div>
            <div style="margin-top:20px; color:#475569; font-weight:600; font-size:14px;" id="loader-text">引擎预热中...</div>
            <style>@keyframes clean-spin { 100% { transform: rotate(360deg); } }</style>
        </div>
    `;
    document.body.appendChild(loader);
    const textNode = document.getElementById('loader-text');

    for (const [folder, files] of Object.entries(MODULE_DIRECTORY)) {
        textNode.innerText = `加载模块: [${folder}] ...`;
        const promises = files.map(file => {
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = `${folder}/${file}.js`;
                script.onload = resolve;
                script.onerror = () => { 
                    console.error(`🚨 加载失败: 找不到文件 ${folder}/${file}.js`); 
                    resolve(); 
                };
                document.body.appendChild(script);
            });
        });
        await Promise.all(promises);
    }

    if (window.ElementPlusIconsVue) { 
        for (const [key, component] of Object.entries(window.ElementPlusIconsVue)) { 
            app.component(key, component); 
        } 
    }
    app.use(ElementPlus);
    app.mount('#app');
    
    if(window._appInitFormValues) window._appInitFormValues();

    setTimeout(() => loader.remove(), 300);
};

bootstrapApp();