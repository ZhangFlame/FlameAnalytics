/**
 * =========================================================
 * 算法模型中央注册表 (Plugin Registry)
 * BY张张 | 支持像插拔U盘一样无缝接入新模型与新算法
 * =========================================================
 */
window.ModelRegistry = (function() {
    const models = {};

    return {
        // 注册新模型
        register(config) {
            if (!config.id) throw new Error("模型注册失败：必须包含唯一 id");
            models[config.id] = config;
        },
        
        // 获取特定分类下的所有模型
        getModelsByCategory(category) {
            return Object.values(models).filter(m => m.category === category);
        },

        // 获取单个模型配置
        get(id) {
            return models[id];
        }
    };
})();