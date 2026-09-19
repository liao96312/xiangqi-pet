"""Generate reproducible release metadata for the 14 runtime HY3 GLBs."""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy


PIECES = [
    ("pawn", "卒 / 兵", "pawn-infantry-{side}-hy3-v1.glb", "xiangqi_pawn_red/xiangqi_pawn_red.glb"),
    ("cannon", "炮", "cannon-{side}-hy3-v1.glb", "xiangqi_cannon_red/xiangqi_cannon_red.glb"),
    ("chariot", "车", "chariot-{side}-hy3-v1.glb", "xiangqi_chariot_red/xiangqi_chariot_red.glb"),
    ("horse", "马", "horse-{side}-hy3-v1.glb", "xiangqi_horse_red/xiangqi_horse_red.glb"),
    ("guard", "士 / 仕", "guard-{side}-hy3-v1.glb", "xiangqi_guard_red/xiangqi_guard_red.glb"),
    ("elephant", "象 / 相", "elephant-{side}-hy3-v1.glb", "xiangqi_elephant_red/xiangqi_elephant_red.glb"),
    ("general", "将 / 帅", "general-{side}-hy3-v2.glb", "xiangqi_king_red/xiangqi_king_red.glb"),
]

WORKBUDDY_SESSION = "C:/Users/Administrator/WorkBuddy/2026-08-11-17-02-37"
GENERATION_TOOL = "Tencent Hunyuan 3D text-to-3D (model 3.1 + PBR) via WorkBuddy"
TERMS_URL = "https://cloud.tencent.com/document/product/1804/122967"
MODEL_TERMS_URL = "https://cloud.tencent.com/document/product/301/97822"
GENERATION = {
    "pawn": {"date": "2026-08-11", "job": "1478679753451626496", "requestedFaces": 18000},
    "cannon": {"date": "2026-08-11", "job": "1478683957608259584", "requestedFaces": 25000},
    "chariot": {"date": "2026-08-11", "job": "1478686127027904512", "requestedFaces": 48000},
    "horse": {"date": "2026-08-11", "job": "1478688249706659840", "requestedFaces": 34000},
    "guard": {"date": "2026-08-11", "job": "1478690068985798656", "requestedFaces": 18000},
    "elephant": {"date": "2026-08-12", "job": None, "requestedFaces": None},
    "general": {"date": "2026-08-12", "job": None, "requestedFaces": 32000},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def inspect_glb(path: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = 0
    vertices = 0
    for obj in meshes:
        vertices += len(obj.data.vertices)
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    images = [
        {"name": image.name, "width": int(image.size[0]), "height": int(image.size[1])}
        for image in bpy.data.images
    ]
    return {
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "meshes": len(meshes),
        "vertices": vertices,
        "triangles": triangles,
        "materials": len(bpy.data.materials),
        "textures": images,
        "animations": [action.name for action in bpy.data.actions],
    }


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :]
    root = Path(args[0]).resolve()
    output_json = Path(args[1]).resolve()
    output_md = Path(args[2]).resolve()
    records = []
    for piece_id, label, pattern, source in PIECES:
        for side in ("red", "black"):
            filename = pattern.format(side=side)
            path = root / "public" / "assets" / filename
            if not path.exists():
                raise FileNotFoundError(path)
            record = {
                "piece": piece_id,
                "label": label,
                "side": side,
                "file": f"public/assets/{filename}",
                "generationTool": GENERATION_TOOL,
                "generatedOn": GENERATION[piece_id]["date"],
                "generationJob": GENERATION[piece_id]["job"],
                "requestedFaces": GENERATION[piece_id]["requestedFaces"],
                "generationOwner": "project owner, through the locally authenticated WorkBuddy session (account identifier intentionally omitted)",
                "generationInput": "project-owner-authored text prompt; no third-party concept image was supplied as model input",
                "redSource": f"{WORKBUDDY_SESSION}/{source}",
                "pipeline": (
                    "user-generated red GLB -> Blender 5.2 texture optimization (512px)"
                    if side == "red"
                    else "matching red runtime GLB -> project-authored Blender base-color faction conversion -> 512px black GLB"
                ),
                **inspect_glb(path),
            }
            records.append(record)

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    manifest = {
        "schemaVersion": 2,
        "generatedAt": generated_at,
        "releaseStatus": "generated-content ownership supported by Tencent terms; final release still requires project-owner confirmation of input rights and intended redistribution",
        "generationSession": WORKBUDDY_SESSION,
        "terms": {
            "service": TERMS_URL,
            "modelService": MODEL_TERMS_URL,
            "reviewedOn": "2026-08-12",
            "summary": "Section 4.3 states that, unless otherwise noted, generated-content rights belong to the user, subject to applicable law, the terms, and third-party input rights.",
        },
        "assets": records,
    }
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# HY3 最终运行资产清单",
        "",
        f"生成时间（UTC）：`{generated_at}`。本表仅包含当前代码实际加载的 14 个 GLB，不含历史草稿。",
        "",
        "> 发布状态：工具、版本、会话、日期和官方条款已有本地/官方证据；正式发布前仍需项目所有人确认输入提示词不含未授权第三方素材，并确认按预定方式公开再分发。",
        "",
        "## 生成记录与条款",
        "",
        f"- 工具：`{GENERATION_TOOL}`。WorkBuddy 本地模型标识为 `hy3-preview-agent / hy3-preview`。",
        f"- 会话：`{WORKBUDDY_SESSION}`；使用本机已登录账号，公开清单不写入账号 UUID、令牌或其他凭据。",
        "- 输入：项目所有人在该会话中编写的逐棋种文生 3D 提示词；运行资产未使用第三方概念图作为模型输入。",
        f"- 腾讯混元生 3D 服务条款：{TERMS_URL}；其指向的大模型服务条款：{MODEL_TERMS_URL}。已于 2026-08-12 核查。",
        "- 大模型服务条款第 4.3 条说明：除界面另有说明或另有约定外，生成内容权利归用户；用户仍需自行保证输入来源、适用法律和第三方权利。",
        "",
        "| 棋种 | 阵营 | 生成日期 | 任务号 | 文件 | 三角面 | 顶点 | 贴图 | 包体 | SHA-256 | 生成链路 |",
        "|---|---|---|---|---|---:|---:|---|---:|---|---|",
    ]
    for record in records:
        texture_sizes = ", ".join(f"{item['width']}×{item['height']}" for item in record["textures"])
        size = f"{record['bytes'] / 1024 / 1024:.2f} MB"
        pipeline = "红方 HY3 → 512px 实时版" if record["side"] == "red" else "同棋种红方 → 项目换色黑方"
        job = record["generationJob"] or "本地日志未保留"
        lines.append(
            f"| {record['label']} | {'红' if record['side'] == 'red' else '黑'} | {record['generatedOn']} | `{job}` | `{Path(record['file']).name}` | "
            f"{record['triangles']:,} | {record['vertices']:,} | {texture_sizes} | {size} | `{record['sha256']}` | {pipeline} |"
        )
    lines.extend([
        "",
        "## 来源约定",
        "",
        f"- 红方原始文件来自 `{WORKBUDDY_SESSION}/xiangqi_*_red`；将 / 帅最终采用 `xiangqi_king_red`，不再采用旧 `xiangqi_general_red`。",
        "- 黑方由项目脚本在同棋种红方几何、UV 和 PBR 基础上做阵营基色转换，不是独立下载资产。",
        "- 运行时贴图统一优化到 512px；原始 4K 文件不进入安装包。",
        "- 前五类的模型版本、PBR 参数、目标面数与任务号来自 WorkBuddy 会话记忆；象与新版君王的日期来自同一会话的本地应用日志和产物时间，日志未保留可核查任务号，清单明确留空而不臆造。",
        "",
    ])
    output_md.write_text("\n".join(lines), encoding="utf-8")
    print(f"HY3_MANIFEST_OK={output_json}; {output_md}; assets={len(records)}")


main()
