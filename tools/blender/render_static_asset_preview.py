"""Render a neutral three-quarter preview for one static GLB."""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


args = sys.argv[sys.argv.index("--") + 1 :]
source = Path(args[0]).resolve()
target = Path(args[1]).resolve()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector(tuple(min(point[index] for point in corners) for index in range(3)))
maximum = Vector(tuple(max(point[index] for point in corners) for index in range(3)))
center = (minimum + maximum) * 0.5
size = maximum - minimum
radius = max(size.x, size.y, size.z) * 0.62

camera_data = bpy.data.cameras.new("PreviewCamera")
camera = bpy.data.objects.new("PreviewCamera", camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location = center + Vector((radius * 1.55, -radius * 1.85, radius * 1.3))
camera.data.lens = 58
look_at(camera, center + Vector((0, 0, size.z * 0.03)))
bpy.context.scene.camera = camera

ground_data = bpy.data.meshes.new("Ground")
ground = bpy.data.objects.new("Ground", ground_data)
bpy.context.scene.collection.objects.link(ground)
bpy.context.view_layer.objects.active = ground
ground.select_set(True)
bpy.ops.mesh.primitive_plane_add(size=max(size.x, size.y) * 3.2, location=(center.x, center.y, minimum.z - 0.01))
ground = bpy.context.active_object
ground_material = bpy.data.materials.new("GroundMaterial")
ground_material.diffuse_color = (0.075, 0.067, 0.058, 1)
ground.data.materials.append(ground_material)

world = bpy.data.worlds.new("PreviewWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.05, 0.045, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
bpy.context.scene.world = world

for name, energy, location, size_value in (
    ("Key", 1250, center + Vector((-radius, -radius * 1.2, radius * 2.1)), radius * 1.7),
    ("Fill", 700, center + Vector((radius * 1.4, -radius * 0.3, radius)), radius * 1.4),
    ("Rim", 950, center + Vector((0, radius * 1.5, radius * 1.8)), radius * 1.2),
):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = max(size_value, 0.5)
    light = bpy.data.objects.new(name, light_data)
    light.location = location
    look_at(light, center)
    bpy.context.scene.collection.objects.link(light)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(target)
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.render.render(write_still=True)
