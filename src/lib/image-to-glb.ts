/**
 * Turns an uploaded image into a small GLB: a vertical poster plane carrying
 * the image as its texture, standing on the ground plane.
 *
 * Why: iOS Safari has no WebXR, so image experiences can't open the camera —
 * but Quick Look (iOS) and Scene Viewer (Android) both accept 3D models.
 * Rendering the poster as a real model gives every image experience native
 * camera AR on both platforms.
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { imageSize } from "image-size";

/** glTF textures may only be PNG or JPEG */
export function glbCompatibleMime(name: string): "image/png" | "image/jpeg" | null {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  return null;
}

export async function imageToGlb(
  imageBytes: Uint8Array,
  mime: "image/png" | "image/jpeg"
): Promise<Uint8Array> {
  const dims = imageSize(imageBytes);
  if (!dims.width || !dims.height) throw new Error("Could not read image dimensions");
  const aspect = dims.width / dims.height;
  // Longest side ~0.9 m; the plane stands upright on the floor (y = 0 at base)
  const w = aspect >= 1 ? 0.9 : 0.9 * aspect;
  const h = aspect >= 1 ? 0.9 / aspect : 0.9;

  const doc = new Document();
  const buffer = doc.createBuffer();

  const position = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(
      new Float32Array([
        -w / 2, 0, 0,
         w / 2, 0, 0,
         w / 2, h, 0,
        -w / 2, h, 0,
      ])
    )
    .setBuffer(buffer);
  const normal = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]))
    .setBuffer(buffer);
  // glTF UV origin is top-left
  const uv = doc
    .createAccessor()
    .setType("VEC2")
    .setArray(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]))
    .setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
    .setBuffer(buffer);

  const texture = doc.createTexture("poster").setImage(imageBytes).setMimeType(mime);
  const material = doc
    .createMaterial("poster")
    .setBaseColorTexture(texture)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9)
    .setDoubleSided(true);

  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("NORMAL", normal)
    .setAttribute("TEXCOORD_0", uv)
    .setIndices(indices)
    .setMaterial(material);

  const scene = doc
    .createScene("Scene")
    .addChild(doc.createNode("Poster").setMesh(doc.createMesh("poster").addPrimitive(prim)));
  doc.getRoot().setDefaultScene(scene);

  return new NodeIO().writeBinary(doc);
}
