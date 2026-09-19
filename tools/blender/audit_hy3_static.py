"""Report bounds and render structure for one or more static HY3 GLBs."""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def audit(path: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = 0
    vertices = 0
    for obj in meshes:
        vertices += len(obj.data.vertices)
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = [min(point[index] for point in corners) for index in range(3)]
    maximum = [max(point[index] for point in corners) for index in range(3)]
    return {
        "file": str(path),
        "bytes": path.stat().st_size,
        "meshes": len(meshes),
        "vertices": vertices,
        "triangles": triangles,
        "materials": len(bpy.data.materials),
        "images": [image.name for image in bpy.data.images],
        "actions": [action.name for action in bpy.data.actions],
        "min": minimum,
        "max": maximum,
        "size": [maximum[index] - minimum[index] for index in range(3)],
    }


args = sys.argv[sys.argv.index("--") + 1 :]
print("HY3_STATIC_AUDIT=" + json.dumps([audit(Path(arg).resolve()) for arg in args], ensure_ascii=False))
