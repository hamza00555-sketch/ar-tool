/**
 * Generates the bundled sample model (public/samples/aurora-knot.glb):
 * a metallic torus knot, built procedurally so the asset is fully original.
 * Run with: node scripts/generate-sample-model.mjs
 */
import { mkdirSync } from "fs";
import { TorusKnotGeometry } from "three";
import { Document, NodeIO } from "@gltf-transform/core";

const geo = new TorusKnotGeometry(0.12, 0.042, 240, 40, 2, 3);
const positions = new Float32Array(geo.attributes.position.array);
const normals = new Float32Array(geo.attributes.normal.array);
const indices = new Uint32Array(geo.index.array);

const doc = new Document();
const buffer = doc.createBuffer();

const posAcc = doc
  .createAccessor()
  .setType("VEC3")
  .setArray(positions)
  .setBuffer(buffer);
const normAcc = doc
  .createAccessor()
  .setType("VEC3")
  .setArray(normals)
  .setBuffer(buffer);
const idxAcc = doc
  .createAccessor()
  .setType("SCALAR")
  .setArray(indices)
  .setBuffer(buffer);

const material = doc
  .createMaterial("aurora-metal")
  .setBaseColorFactor([0.32, 0.93, 0.82, 1])
  .setMetallicFactor(0.95)
  .setRoughnessFactor(0.22);

const prim = doc
  .createPrimitive()
  .setAttribute("POSITION", posAcc)
  .setAttribute("NORMAL", normAcc)
  .setIndices(idxAcc)
  .setMaterial(material);

const mesh = doc.createMesh("knot").addPrimitive(prim);
// Lift the knot so it sits nicely on the floor plane in AR
const node = doc.createNode("AuroraKnot").setMesh(mesh).setTranslation([0, 0.17, 0]);
const scene = doc.createScene("Scene").addChild(node);
doc.getRoot().setDefaultScene(scene);

mkdirSync("public/samples", { recursive: true });
await new NodeIO().write("public/samples/aurora-knot.glb", doc);
console.log("Wrote public/samples/aurora-knot.glb");
