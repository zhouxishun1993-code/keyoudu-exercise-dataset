# 字段说明

对应 `data/exercises.json`，数据结构版本 1.2.0。机器可读的定义在 `data/exercises.schema.json`，`npm test` 会按它校验全部数据。

## 顶层

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schema_version` | 字符串 | 数据结构版本，当前为 `1.2.0` |
| `dataset_version` | 字符串 | 数据集版本，与 `package.json` 的 `version` 相同 |
| `generated_at` | 字符串 | 数据文件生成时间（ISO 8601，UTC） |
| `language` | 字符串 | 固定为 `zh-CN` |
| `counts.exercises` | 整数 | 动作条数 |
| `counts.media_files` | 整数 | `images/` 中被引用的 WebP 文件数 |
| `counts.professional_reviewed` | 整数 | 经专业审核的条数，固定为 0 |
| `source` | 对象 | 上游项目、固定提交、地址和许可证 |
| `licenses` | 对象 | 数据与代码、生成图片各自的许可证和署名 |
| `notice` | 字符串 | 使用提示 |
| `exercises` | 数组 | 动作记录，按 `id` 升序 |

## 动作记录

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | 字符串 | `ex-` 加四位上游编号，如 `ex-0662`。编号不连续，也不会重新分配 |
| `name_zh` | 字符串 | 中文名称，在数据集内唯一 |
| `aliases` | 字符串数组 | 常见别名，可以为空；不包含 `name_zh` 本身 |
| `body_part` | 字符串 | 身体部位，取值见下 |
| `equipment` | 字符串 | 器械，取值见下 |
| `target` | 字符串 | 主要目标肌群，保留上游的英文键，便于程序使用 |
| `target_zh` | 字符串 | `target` 的中文名称，与 `target` 一一对应 |
| `measurement` | 字符串 | `reps`（按次数）或 `duration`（按时长） |
| `instructions_zh` | 字符串数组 | 中文分步说明，至少两步 |
| `instructions_en` | 字符串数组 | 英文分步说明，与中文步骤一一对应 |
| `source` | 对象 | 这条记录在上游的编号、英文原名、固定提交、地址和文本许可证 |
| `media` | 对象 | 图片，见下 |
| `review` | 对象 | 审核状态，见下 |

### `body_part`（10 个取值）

| 取值 | 条数 | 对应上游 |
| --- | --- | --- |
| 上臂 | 291 | upper arms |
| 臀腿 | 223 | upper legs（含臀部） |
| 背部 | 197 | back |
| 胸部 | 161 | chest |
| 核心 | 160 | waist |
| 肩部 | 142 | shoulders |
| 小腿 | 58 | lower legs |
| 前臂 | 34 | lower arms |
| 有氧 | 29 | cardio |
| 颈部 | 1 | neck |

### `equipment`（25 个取值）

| 取值 | 条数 | 说明 |
| --- | --- | --- |
| 自重 | 304 | 不需要器械，可能用到凳子、单杠或墙面 |
| 哑铃 | 290 | |
| 绳索 | 157 | 滑轮绳索器械 |
| 杠铃 | 156 | 直杆杠铃 |
| 固定器械 | 93 | 杠杆式、滑轨式等固定轨迹器械（史密斯机除外） |
| 弹力带 | 61 | |
| 史密斯机 | 48 | |
| 壶铃 | 41 | |
| 负重 | 35 | 杠铃片、负重腰带等附加重量 |
| 瑞士球 | 27 | 也叫健身球、稳定球 |
| 曲杆杠铃 | 23 | |
| 搭档辅助 | 15 | 需要另一个人协助 |
| 药球 | 13 | |
| 有氧器械 | 8 | 跑步机、椭圆机、固定自行车等 |
| 泡沫轴 | 8 | |
| 拉伸带 | 4 | 也可以用绳或毛巾代替 |
| BOSU球 | 3 | |
| 攀爬绳 | 2 | |
| 健腹轮 | 2 | |
| 平衡板、战绳、六角杠铃、训练锤、轮胎、跳绳 | 各 1 | |

### `target` 与 `target_zh`（19 对）

| `target` | `target_zh` | 条数 |
| --- | --- | --- |
| abs | 腹肌 | 160 |
| pectorals | 胸肌 | 156 |
| biceps | 肱二头肌 | 151 |
| glutes | 臀肌 | 143 |
| delts | 三角肌 | 142 |
| triceps | 肱三头肌 | 140 |
| upper back | 上背部 | 87 |
| lats | 背阔肌 | 77 |
| calves | 小腿肌群 | 58 |
| quads | 股四头肌 | 44 |
| forearms | 前臂肌群 | 34 |
| cardiovascular system | 心肺系统 | 29 |
| hamstrings | 腘绳肌 | 25 |
| spine | 竖脊肌 | 18 |
| traps | 斜方肌 | 15 |
| adductors | 髋内收肌群 | 6 |
| serratus anterior | 前锯肌 | 5 |
| abductors | 髋外展肌群 | 5 |
| levator scapulae | 肩胛提肌 | 1 |

Schema 里 `target` 和 `target_zh` 两个枚举按相同顺序排列，校验脚本据此检查两者是否匹配。

### `media`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `thumbnail` | 字符串 | 缩略图路径，`images/<id>-thumb.webp`，256×256 |
| `start`、`end` | 字符串 | 开始图和结束图路径，兼容字段 |
| `frames` | 对象数组 | 按展示顺序排列的动作图，每项有 `phase`、`path`、`sha256`、`dimensions` |
| `sequence` | 字符串数组 | 播放顺序，取值都来自 `frames` 的 `phase`，可以重复 |
| `sha256` | 对象 | `thumbnail`、`start`、`end` 三张图的 SHA-256 |
| `dimensions` | 对象 | 三张图的宽高，`[宽, 高]` |
| `format` | 字符串 | 固定为 `webp` |
| `attribution` | 字符串 | 固定为 `课有度 Keyoudu` |
| `license` | 字符串 | 固定为 `CC BY 4.0` |
| `ai_generated` | 布尔 | 固定为 `true` |

动作图最大 768×768，其中 16 个动作是 627×627（见[已知问题](KNOWN_ISSUES.md)）。

`phase` 目前出现的取值：`start`、`end`、`middle`、`transition`、`effort`、`mid1`、`mid2`、`pull`、`catch`、`hold`。只有一帧的动作必须是 `hold`，并且 `measurement` 为 `duration`。

### `review`

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `stage` | `reviewed_illustration` | 图片经过一轮复查后入库 |
| `visual_screening` | `ai_quick_visual_pass` | 由 AI 快速目视检查人体结构、握法和器械连接 |
| `professional_review` | `not_performed` | 没有专业教练或运动医学人员审核 |

目前所有记录的这三个字段都相同。要把某条记录标为专业审核完成，请按 [CONTRIBUTING.md](../CONTRIBUTING.md) 的要求提供审核人身份、资质范围、日期和结论。
