"""Create the black-side material variant from the user-provided HY3 pawn GLB."""

import sys
from pathlib import Path

import bpy
import numpy as np


source = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output = Path(sys.argv[sys.argv.index("--") + 2]).resolve()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))

mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
material = next(mat for mat in mesh.data.materials if mat and mat.use_nodes)
base_color_node = next(
    node
    for node in material.node_tree.nodes
    if node.type == "TEX_IMAGE" and node.image and "normal" not in node.image.name.lower()
    and "roughness" not in node.image.name.lower() and "metallic" not in node.image.name.lower()
)
image = base_color_node.image

pixels = np.empty(len(image.pixels), dtype=np.float32)
image.pixels.foreach_get(pixels)
rgba = pixels.reshape((-1, 4))
rgb = rgba[:, :3]

maximum = rgb.max(axis=1)
minimum = rgb.min(axis=1)
delta = maximum - minimum
saturation = np.divide(delta, maximum, out=np.zeros_like(delta), where=maximum > 1e-6)
hue = np.zeros_like(maximum)
red_is_max = (maximum == rgb[:, 0]) & (delta > 1e-6)
hue[red_is_max] = np.mod((rgb[red_is_max, 1] - rgb[red_is_max, 2]) / delta[red_is_max], 6.0) / 6.0

# Replace only strongly red cloth/lacquer pixels.  Orange skin tones sit outside
# this narrow hue window and therefore remain unchanged.
mask = (saturation > 0.24) & ((hue < 0.042) | (hue > 0.95)) & (rgb[:, 0] > 0.025)
value = maximum[mask]
rgb[mask, 0] = value * 0.055
rgb[mask, 1] = value * 0.085
rgb[mask, 2] = value * 0.145

image.name = "HY3_Pawn_Black_BaseColor"
image.pixels.foreach_set(rgba.reshape(-1))
image.update()
image.pack()

material.name = "HY3_Pawn_Black_PBR"
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
)
print(f"HY3_BLACK_PAWN_OK={output}")
