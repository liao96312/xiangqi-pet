"""List connected mesh components in a static GLB, largest first."""

import sys
from collections import deque
from pathlib import Path

import bpy


source = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))

for obj in [item for item in bpy.context.scene.objects if item.type == "MESH"]:
    mesh = obj.data
    neighbors = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbors[a].add(b)
        neighbors[b].add(a)
    unseen = set(range(len(mesh.vertices)))
    components = []
    while unseen:
        seed = unseen.pop()
        queue = deque([seed])
        vertices = [seed]
        while queue:
            for neighbor in neighbors[queue.popleft()]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    queue.append(neighbor)
                    vertices.append(neighbor)
        coords = [mesh.vertices[index].co for index in vertices]
        minimum = [min(value[axis] for value in coords) for axis in range(3)]
        maximum = [max(value[axis] for value in coords) for axis in range(3)]
        components.append((len(vertices), minimum, maximum))
    for index, (count, minimum, maximum) in enumerate(sorted(components, reverse=True)[:30]):
        print(f"COMPONENT object={obj.name} rank={index} vertices={count} min={minimum} max={maximum}")
