"""Downsize embedded HY3 textures for real-time board rendering."""

import sys
from pathlib import Path

import bpy


source = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output = Path(sys.argv[sys.argv.index("--") + 2]).resolve()
maximum = int(sys.argv[sys.argv.index("--") + 3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))

resized = []
for image in bpy.data.images:
    width, height = image.size
    longest = max(width, height)
    if longest <= maximum:
        continue
    ratio = maximum / longest
    target = (max(1, round(width * ratio)), max(1, round(height * ratio)))
    image.scale(*target)
    image.pack()
    resized.append((image.name, (width, height), target))

output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
)
print(f"HY3_OPTIMIZED={output}; resized={resized}")
