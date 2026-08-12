# 3D 第三方资产与复用记录

## 当前 HY3 运行资产（发布前须由项目所有人作最终确认）

当前 3D 棋盘实际加载的七类红方模型由用户提供，来源目录为 `C:/Users/Administrator/WorkBuddy/2026-08-11-17-02-37/xiangqi_*_red`。项目将其 4K 贴图优化为 512px 实时版本；黑方模型由对应红方运行资产保持相同几何、UV 和 PBR 通道后做阵营基色转换。最终将 / 帅采用 `xiangqi_king_red`，旧 `xiangqi_general_red` 不再作为运行资产。

14 个最终 GLB 的逐文件 SHA-256、面数、贴图尺寸、包体和生成链路见 [`HY3_ASSET_MANIFEST.md`](./HY3_ASSET_MANIFEST.md)，机器可读副本随运行资源保存为 `public/assets/HY3_RUNTIME_ASSET_MANIFEST.json`。

本地 WorkBuddy 最新会话和日志已确认：红方资产由项目所有人在本机已登录会话中使用腾讯混元 3D 文生 3D（model 3.1 + PBR）生成，日期为 2026-08-11 至 2026-08-12；公开清单不会收录账号 UUID、令牌等凭据。腾讯混元生 3D 适用的[服务条款](https://cloud.tencent.com/document/product/1804/122967)指向[大模型服务条款](https://cloud.tencent.com/document/product/301/97822)，后者第 4.3 条说明除界面另有说明或另有约定外，生成内容权利归用户，同时要求用户自行保证输入来源、适用法律与第三方权利。

因此工具与生成链路已不再是未知项；公开 Release 前仍需项目所有人最终确认：逐棋种输入提示词没有包含未授权第三方素材，并同意把生成模型、贴图和项目制作的黑方衍生版本用于商业用途、修改以及 GitHub Release / Windows 安装包再分发。该确认是项目发布决策，不由资产文件或自动审计脚本代替。

更新时间：2026-08-05

当前版本的棋子装备由本项目建模，人物底模和 PBR 表面只复用下表中可核查的 CC0 / CC BY 素材；没有把来源不明的模型或纹理带进安装包。

| 来源 | 用途 | 许可证 | 本项目处理 | 状态 |
|---|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | WebGL 场景、几何体、材质 | MIT | 作为 npm 依赖打包，保留上游许可证 | 已使用 |
| [react-three-fiber](https://github.com/pmndrs/react-three-fiber) | React 到 Three.js 的渲染桥 | MIT | 作为 npm 依赖打包，未复制上游源码 | 已使用 |
| [drei](https://github.com/pmndrs/drei) | `Canvas`、`Html` 等现成组件 | MIT | 作为 npm 依赖打包，未复制上游源码 | 已使用 |
| [King's Gambit / rork-medieval-3d-chess](https://github.com/alexngdev99/rork-medieval-3d-chess) | 透视镜头宽高适配与画质分档思路 | MIT；Copyright (c) 2026 King's Gambit contributors | 改写为 `src/three/viewport.ts` 与 `src/three/quality.ts`，不使用其模型、音频、棋局规则或完整 SceneEngine；许可见 `licenses/KINGS_GAMBIT_MIT.txt` | 已使用 |
| [Blender Studio Human Base Meshes](https://download.blender.org/demo/bundles/bundles-3.6/human-base-meshes-bundle-v1.0.0.zip) | 写实男性人体底模 `GEO-body_male_realistic` | CC0；具体男性底模作者为 Dan Ulrich 与 Blender Studio contributors | 下载到 `art/external/blender-human-base-meshes`；v4 将缩放、绑定骨骼并在其外部自制甲胄 | 已采用 |
| [Chinese Warrior - Jin Dynasty (220-280 AD)](https://sketchfab.com/3d-models/chinese-warrior-jin-dynasty-220-280-ad-c8b2395af47f4ba8a161e0c96fc940a0) | v8 人体、脸部、贴体层甲和靴子 | CC BY 4.0；Mariusz Waclawek | 保留原 512px 贴图并写入署名；删除原长兵器，重做持枪 / 持盾姿态、阵营配色、头盔、护颊、盾牌和战损 | 已采用 |
| [Poly Haven Metal Plate 02](https://polyhaven.com/a/metal_plate_02) | 甲胄和武器的磨损金属法线 | CC0；作者 Rob Tuytel | 仅采用 1K OpenGL normal JPG（183KB），嵌入 v4 GLB | 已采用 |
| [ambientCG Metal 010](https://ambientcg.com/view?id=Metal010) | v5 甲胄的无板缝细划痕金属表面 | CC0；ambientCG | 采用 1K NormalGL、Roughness、Metalness；保留深钢基础色，避免工业板缝映射到头盔和胸甲 | 已采用 |
| [ambientCG Fabric 016](https://ambientcg.com/view?id=Fabric016) | v7 军服、围巾、盔缨和旗帜表面 | CC0；ambientCG | 采用 1K NormalGL 与 Roughness，阵营颜色仍由本项目材质控制 | 已采用 |
| [ambientCG Leather 026](https://ambientcg.com/view?id=Leather026) | v7 战靴、护手、盾面漆皮表面 | CC0；ambientCG | 采用 1K NormalGL 与 Roughness，降低法线强度避免远景颗粒过重 | 已采用 |
| [Quaternius Ultimate Animated Character Pack](https://quaternius.com/packs/ultimatedanimatedcharacter.html) | 后续角色底模候选 | CC0；页面声明可用于个人和商业项目 | 本轮未下载、未改造、未打包；待有 Blender 后再验证动作和导出 | 候选 |

## GitHub 调研结论

- [nguyentamthanh/chinese-chess-3d-threejs](https://github.com/nguyentamthanh/chinese-chess-3d-threejs) 有完整七类棋子和 3D 点击流程，可参考交互，但仓库未发现许可证文件，不能直接复制代码或模型进本项目。
- [xeliot/ChineseChessOL](https://github.com/xeliot/ChineseChessOL) 是 Unity 3D 项目，README 标注 AGPL-3.0；与当前 Electron + React Three Fiber 技术栈不匹配，本项目不引入。
- [denxwan/react-three-chess](https://github.com/denxwan/react-three-chess) 和 [d3ttl4ff/dispersion-chesspieces](https://github.com/d3ttl4ff/dispersion-chesspieces) 可参考 R3F 结构和材质表现，但当前仓库未提供足够清晰的模型再分发授权，本项目不复制其模型或贴图。

## 当前资产策略

本项目内的低多边形程序化棋子只作为离线 fallback 和技术占位，不作为最终美术。最终方向是能靠角色轮廓、武器、载具和体量识别的战场单位；按“卒 / 兵 → 炮 → 车 → 马 → 象 → 士 → 将 / 帅”逐个制作，单个棋种完成许可证、动作、导出和安装包验证后才进入下一个。运行时不联网拉取模型。

兵 / 卒 v8 复用 CC BY 的晋代武士人体与贴体层甲，头盔、护颊、长盾、长枪、背旗和阵营改色由本项目制作，金属 / 布料 / 皮革表面继续使用上表 CC0 PBR 素材。西式古盔、圆盾和无头盔汉兵候选因时代造型或整体风格不匹配而未引入；Quaternius 底模也因卡通比例不匹配而不混入当前资产。
