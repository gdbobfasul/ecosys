// Процедурален терен: heightfield от value-noise/fBm.
// Различни биоми (forest/field/snow/desert/hills/marsh/urban) задават
// амплитуда на височините, цветове и плътност на декорите.
import * as THREE from 'three';
import { fbm } from './engine/noise.js';

export const TERRAIN_SIZE = 400;   // метри (квадрат)
const SEG = 96;                    // резолюция на мрежата

// Дефиниции на биоми. amp = височинна амплитуда; colorLow/High = цвят по височина.
export const BIOMES = {
  forest:  { amp: 18, colorLow: 0x2e5d34, colorHigh: 0x6f9e57, decor: 'trees',     density: 0.9 },
  field:   { amp: 8,  colorLow: 0x6b8e3a, colorHigh: 0x9ab94f, decor: 'grass',     density: 0.5 },
  snow:    { amp: 26, colorLow: 0xcfe0ea, colorHigh: 0xffffff, decor: 'pines',     density: 0.6 },
  desert:  { amp: 14, colorLow: 0xc2a35b, colorHigh: 0xe6cf94, decor: 'rocks',     density: 0.3 },
  hills:   { amp: 34, colorLow: 0x4d6b39, colorHigh: 0x86a35a, decor: 'rocks',     density: 0.4 },
  marsh:   { amp: 6,  colorLow: 0x3a4a2e, colorHigh: 0x5f6e3e, decor: 'reeds',     density: 0.8 },
  urban:   { amp: 10, colorLow: 0x5a5a5e, colorHigh: 0x8a8a90, decor: 'ruins',     density: 0.7 }
};

export class Terrain {
  constructor(scene, biomeKey, seed) {
    this.scene = scene;
    this.biome = BIOMES[biomeKey] || BIOMES.field;
    this.seed = seed;
    this.amp = this.biome.amp;
    this._build();
  }

  // Височина на терена в световни координати (x,z).
  heightAt(x, z) {
    const nx = (x / TERRAIN_SIZE + 0.5) * 6;
    const nz = (z / TERRAIN_SIZE + 0.5) * 6;
    const h = fbm(nx, nz, this.seed, 4, 2.0, 0.5);
    // лек ръб надолу към края, за да не "падаш" визуално
    const y = (h - 0.5) * this.amp;
    // Защита: ако шумът върне NaN/Infinity, камерата/целите получават
    // невалидна позиция -> невалидна матрица -> ЧЕРЕН екран. Падаме към 0.
    return Number.isFinite(y) ? y : 0;
  }

  _build() {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const cLow = new THREE.Color(this.biome.colorLow);
    const cHigh = new THREE.Color(this.biome.colorHigh);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      const t = THREE.MathUtils.clamp((y / this.amp) + 0.5, 0, 1);
      const c = cLow.clone().lerp(cHigh, t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);

    this._addDecor();
  }

  // Нискополигонален декор според биома (дървета/скали/камъш/руини).
  _addDecor() {
    const group = new THREE.Group();
    const count = Math.floor(60 * this.biome.density);
    const kind = this.biome.decor;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.9;
      const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.9;
      const y = this.heightAt(x, z);
      const obj = this._decorMesh(kind);
      obj.position.set(x, y, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.7 + Math.random() * 0.8;
      obj.scale.setScalar(s);
      group.add(obj);
    }
    this.decor = group;
    this.scene.add(group);
  }

  _decorMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'trees' || kind === 'pines') {
      const trunkH = 2.2;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, trunkH, 6),
        new THREE.MeshLambertMaterial({ color: 0x5b3a1e })
      );
      trunk.position.y = trunkH / 2;
      g.add(trunk);
      const leafColor = kind === 'pines' ? 0x274d2e : 0x2f7d33;
      const cones = kind === 'pines' ? 3 : 1;
      for (let k = 0; k < cones; k++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.4 - k * 0.3, 2.2, 7),
          new THREE.MeshLambertMaterial({ color: leafColor, flatShading: true })
        );
        cone.position.y = trunkH + k * 1.1;
        g.add(cone);
      }
    } else if (kind === 'rocks') {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9, 0),
        new THREE.MeshLambertMaterial({ color: 0x7c7c80, flatShading: true })
      );
      rock.position.y = 0.5;
      g.add(rock);
    } else if (kind === 'reeds' || kind === 'grass') {
      const blades = 5;
      for (let k = 0; k < blades; k++) {
        const blade = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4),
          new THREE.MeshLambertMaterial({ color: kind === 'reeds' ? 0x6b7a3a : 0x7fae45 })
        );
        blade.position.set((Math.random() - 0.5) * 0.6, 0.7, (Math.random() - 0.5) * 0.6);
        blade.rotation.z = (Math.random() - 0.5) * 0.3;
        g.add(blade);
      }
    } else if (kind === 'ruins') {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(2 + Math.random() * 2, 1.5 + Math.random() * 2, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x6b6b70, flatShading: true })
      );
      wall.position.y = 1;
      g.add(wall);
    }
    return g;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    if (this.decor) {
      this.scene.remove(this.decor);
      this.decor.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
  }
}
