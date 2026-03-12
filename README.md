# 🔥 FlameAnalytics

**by 张张 (ZhangFlame)**  
纯前端开源 · 一键数据处理/建模/代码生成 (Stata/Python) · 为爱发电，欢迎贡献！  
*Front‑end open‑source · One‑click data processing, modeling & code generation (Stata/Python) · Built with love, contributions welcome!*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 快速开始 / Getting Started

1. **下载本项目**  
   ```bash
   git clone https://github.com/ZhangFlame/FlameAnalytics.git
   ```
---

## 📖 简介

FlameAnalytics 是一个纯前端开源的在线实证分析平台，由张张（ZhangFlame）开发，帮助研究者快速完成数据处理、模型运行与代码生成（Stata/Python）。支持变量变换、计量模型、机器学习及期刊绘图。

*FlameAnalytics is a front‑end open‑source platform by ZhangFlame for rapid data analysis, modeling, and code generation (Stata/Python). It supports variable transformations, econometric models, machine learning, and publication‑ready charts.*

**愿景**：希望能尽微薄之力，帮助到更多的人。  
*Vision: To help more people with a small effort.*

**特别说明**：网页端受限于浏览器性能，仅演示前 1000 行数据；完整分析请使用生成的代码在本地运行。  
*Note: Due to browser limitations, the web demo only processes the first 1000 rows. For full analysis, please run the generated code locally.*

---
## 📝 作者的话 / Author's Note

生活已经够苦了，还要受代码的煎熬。  
或许我们都经历过愤怒、抑郁，遭遇过背叛、欺骗……  
如今还要为作业、学业、毕业、生活而烦恼，一把一把地掉头发。  

是的，这不过是个简单的程序，大佬们随手就能写，没什么可显摆的。  
**但是！** 这个世界上还有很多普通人，他们依然在为同样的烦恼而挣扎、而掉头发。  
张张只希望尽一点微薄之力，哪怕只帮到一个人，也好。  
谢谢！  

*Life is already tough enough, and code can be a pain.*  
*We may have known anger, depression, betrayal, deception…*  
*And now we still worry about assignments, studies, graduation, life – while our hair keeps falling out.*  

*Yes, this is just a simple program that experts could whip up in no time – nothing to show off.*  
***But!** There are still many ordinary people out there struggling with the same worries, losing the same hair.*  
*ZhangFlame just wants to make a small difference, even if it helps just one person.*  
*Thank you!*  

---

**允许修改、二次开发，但希望大家能继续为爱发电。**  
*You are free to modify and build upon this project, but please keep contributing with love.*  

（说人话：别把这玩意儿拿去倒卖坑人，不然……祝你早生贵子？不，祝您早日投胎，谢谢！）  
*(Translation: Be human. If you're the kind of person who would resell this simple tool or use it to harm others – may you be reborn soon. Thank you!)*

## ✨ 功能特性 / Features（更新...）

- 🚀 **零配置启动** – 打开网页即可用，无需安装任何软件。  
  *Zero configuration – just open the page and go.*
- 🧬 **变量处理引擎** – 支持取对数、加一取对数、1%‑99%缩尾、Z标准化、中心化、滞后一期、一阶差分等原地突变操作，并保留还原能力。  
  *Built‑in variable transformations: log, log(x+1), 1%‑99% winsorize, standardization, centering, lag, diff – all in‑place and reversible.*
- 📦 **模块化模型注册表** – 新增模型或算法像插拔U盘一样简单，目前已集成：  
  *Modular model registry – plug‑in new models effortlessly. Currently includes:*
  - **计量模型**：描述性统计、OLS、固定效应/随机效应、IV、中介效应、熵权法  
    *Econometrics: descriptive stats, OLS, FE/RE, IV, mediation, entropy weight*
  - **机器学习**：随机森林、Lasso、遗传算法  
    *Machine learning: Random Forest, Lasso, Genetic Algorithm*
  - **期刊绘图**：散点图、热力图、箱线图、时间序列、火山图、哑铃图、曼哈顿图、漏斗图、桑基图、中国地图  
    *Publication‑ready charts: scatter, heatmap, boxplot, time series, volcano, dumbbell, Manhattan, funnel, Sankey, China map*
- ⚙️ **实时响应** – 修改变量配置或模型参数，结果与代码自动更新（机器学习/绘图模块需手动运行以节省性能）。  
  *Real‑time update of results and code on configuration changes (manual run for ML/plotting to save performance).*
- 📄 **一键导出代码** – 根据当前数据和模型设置，生成可直接在 Stata / Python 中运行的完整分析脚本。  
  *One‑click export of ready‑to‑run Stata/Python scripts.*
- 🎨 **丰富的图表定制** – 支持字体、颜色、网格、图例等细节调整，尽量满足期刊投稿要求。  
  *Rich chart customization: fonts, colors, grids, legends – tailored for publication requirements.*
- 💡 **智能数据清洗** – 自动检测实体变量（ID）与时间变量（年份），处理中文乱码，识别常见编码。  
  *Smart data cleaning: auto‑detect ID and year variables, handle encoding issues.*

---

## 🛠️ 技术栈 / Tech Stack（更新...）

- **前端框架**：Vue 3 (CDN)
- **UI 组件库**：Element Plus
- **图表引擎**：ECharts
- **数据处理**：纯 JavaScript + XLSX (SheetJS)
- **数学计算**：自定义矩阵运算、统计分布函数（无外部依赖）
- **代码生成**：动态拼接 Stata / Python 语法

---

## 📁 项目结构 / Project Structure（更新...）

```
FlameAnalytics/
├── index.html               # 主入口页面
├── style.css                # 样式文件
├── app.js                   # Vue 主应用逻辑
├── registry.js              # 模型注册中心
├── variableProcessor.js     # 变量处理引擎
├── utils.js                 # 数学/统计工具库
├── plotConfigBase.js        # 绘图公共配置
├── econometrics/            # 计量模型模块
│   ├── desc.js
│   ├── ols.js
│   ├── fe.js
│   ├── re.js
│   ├── iv.js
│   ├── mediation.js
│   └── entropy.js
├── machine_learning/        # 机器学习模块
│   ├── rf.js
│   ├── lasso.js
│   └── ga.js
└── plotting/                # 绘图模块
    ├── scatter.js
    ├── heatmap.js
    ├── boxplot.js
    ├── timeseries.js
    ├── volcano.js
    ├── dumbbell.js
    ├── manhattan.js
    ├── funnel.js
    ├── sankey.js
    └── map_china.js
```

---

## 🤝 贡献指南 / Contributing

欢迎任何形式的贡献！报告 bug、提出新功能、提交代码均可。

- **报告问题**：请通过 GitHub Issues 描述，附上可复现的数据样例。
- **新增模型**：参考 `registry.js` 和现有模块，在对应分类下创建文件并注册。
- **代码风格**：保持现有命名规范，添加必要注释。
- **提交 PR**：确保功能经过测试，并更新相关文档。

---

## 📄 许可证 / License

本项目采用 **MIT 许可证**。详细信息请参阅 [LICENSE](LICENSE) 文件。  
*This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.*

---

## 🌟 致谢 / Acknowledgements

感谢 Element Plus、ECharts、SheetJS 等开源项目。  
*Thanks to Element Plus, ECharts, SheetJS, and all other open‑source projects that made this work possible.*

---

## 📬 联系作者 / Contact

**张张 (ZhangFlame)**  
- 公众号：张张小栈  
- GitHub：[@ZhangFlame](https://github.com/ZhangFlame)  
- 如果你喜欢这个项目，欢迎点亮 ⭐，让更多人看到！

---

**祝大家科研顺利，Paper 拿到手软！🚀**  
*May your research go smoothly and your papers be accepted!*
