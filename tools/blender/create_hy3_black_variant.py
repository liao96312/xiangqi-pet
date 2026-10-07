"""Create a black-side material variant from a user-provided static HY3 GLB."""

import sys
from pathlib import Path

import bpy
import numpy as np


source = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output = Path(sys.argv[sys.argv.index("--") + 2]).resolve()
piece_name = sys.argv[sys.argv.index("--") + 3] if len(sys.argv[sys.argv.index("--") + 1 :]) > 2 else source.stem

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))

base_color_images = []
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    for node in material.node_tree.nodes:
        if node.type != "TEX_IMAGE" or not node.image:
            continue
        name = node.image.name.lower()
        if "normal" in name or "roughness" in name or "metallic" in name:
            continue
        if node.image not in base_color_images:
            base_color_images.append(node.image)

if not base_color_images:
    raise RuntimeError(f"No base-color image found in {source}")

for image in base_color_images:
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

    # Shift red cloth, lacquer and horse barding to cold charcoal. Neutral
    # metal, leather and pale skin pixels keep their original PBR response.
    mask = (saturation > 0.24) & ((hue < 0.05) | (hue > 0.95)) & (rgb[:, 0] > 0.025)
    value = maximum[mask]
    rgb[mask, 0] = value * 0.055
    rgb[mask, 1] = value * 0.085
    rgb[mask, 2] = value * 0.145

    image.name = f"HY3_{piece_name}_Black_BaseColor"
    image.pixels.foreach_set(rgba.reshape(-1))
    image.update()
    image.pack()

for material in bpy.data.materials:
    material.name = f"HY3_{piece_name}_Black_PBR"

output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
)
print(f"HY3_BLACK_VARIANT_OK={output}")
