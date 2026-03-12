# FlameAnalytics
FlameAnalytics 是一个纯前端开源平台，由张张（ZhangFlame）开发，帮助研究者快速完成数据处理、模型运行与代码生成（Stata/Python）。支持变量变换、计量模型、机器学习及期刊绘图。为爱发电，欢迎贡献！
FlameAnalytics is a front-end open-source platform by ZhangFlame for rapid data analysis, modeling, and code generation (Stata/Python). It supports variable transformations, econometric models, machine learning, and publication-ready charts. Built with love, contributions welcome!

愿景：希望能尽微薄之力，帮助到更多的人
特别说明：网页端受限于浏览器性能，仅演示前 1000 行数据；完整分析请使用生成的代码在本地运行。
📄 许可证 / License：本项目采用 MIT 许可证。This project is licensed under the MIT License.
详细信息请参阅 LICENSE 文件。

✨ 目前程序大致内容/ Usage（更新...）
- 🚀 零配置启动 – 打开网页即可用，无需安装任何软件。
- 🧬 变量处理引擎 – 支持取对数、加一取对数、1%-99%缩尾、Z标准化、中心化、滞后一期、一阶差分等原地突变操作，并保留还原能力。
- 📦 模块化模型注册表 – 新增模型或算法像插拔U盘一样简单，目前已集成：
- - 计量模型：描述性统计、OLS、固定效应/随机效应、IV、中介效应、熵权法
- - 机器学习：随机森林、Lasso、遗传算法
- - 期刊绘图：散点图、热力图、箱线图、时间序列、火山图、哑铃图、曼哈顿图、漏斗图、桑基图、中国地图
- ⚙️ 实时响应 – 修改变量配置或模型参数，结果与代码自动更新（机器学习/绘图模块需手动运行以节省性能）。
- 📄 一键导出代码 – 根据当前数据和模型设置，生成可直接在 Stata / Python 中运行的完整分析脚本。
- 🎨 丰富的图表定制 – 支持字体、颜色、网格、图例等细节调整，尽量满足期刊投稿要求。
- 💡 智能数据清洗 – 自动检测实体变量（ID）与时间变量（年份），处理中文乱码，识别常见编码。

🛠️ 技术栈（简单版，打开即用，不需要技术含量）
- 前端框架：Vue 3 (CDN)
- UI 组件库：Element Plus
- 图表引擎：ECharts
- 数据处理：纯 JavaScript + XLSX (SheetJS)
- 数学计算：自定义矩阵运算、统计分布函数（无外部依赖）
- 代码生成：动态拼接 Stata / Python 语法


📁 目前项目结构/ Project Structure（更新...）
FlameAnalytics/
├── index.html               # 主入口页面
├── style.css                 # 样式文件（未列出，但存在）
├── app.js                    # Vue 主应用逻辑
├── registry.js               # 模型注册中心
├── variableProcessor.js      # 变量处理引擎
├── utils.js                  # 数学/统计工具库
├── plotConfigBase.js         # 绘图公共配置
├── econometrics/             # 计量模型模块
│   ├── desc.js
│   ├── ols.js
│   ├── fe.js
│   ├── re.js
│   ├── iv.js
│   ├── mediation.js
│   └── entropy.js
├── machine_learning/         # 机器学习模块
│   ├── rf.js
│   ├── lasso.js
│   └── ga.js
└── plotting/                 # 绘图模块
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


## 🚀 快速开始 / Getting Started

1. **下载本项目**  
   ```bash
   git clone https://github.com/ZhangFlame/FlameAnalytics.git
   ```

## 🤝 贡献指南 / Contributing

欢迎任何形式的贡献！报告 bug、提出新功能、提交代码均可。

- 报告问题：请通过 GitHub Issues 描述，附上可复现的数据样例。
- 新增模型：参考 `registry.js` 和现有模块，在对应分类下创建文件并注册。
- 代码风格：保持现有命名规范，添加必要注释。
- 提交 PR：确保功能经过测试，并更新相关文档。

---


## 🌟 致谢 / Acknowledgements

感谢 Element Plus、ECharts、SheetJS 等开源项目。

---

## 📬 联系作者 / Contact

**张张 (ZhangFlame)**  
- 公众号：张张小栈  
- GitHub：[@ZhangFlame](https://github.com/ZhangFlame)  
- 如果你喜欢这个项目，欢迎点亮 ⭐，让更多人看到！

**祝大家科研顺利，Paper 拿到手软！🚀**  
*May your research go smoothly and your papers be accepted!*
