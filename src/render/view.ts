import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { COLS, MAX_FLOORS, ROOMS } from '../sim/content';
import type { Game } from '../sim/game';
import type { Dweller, Room, RoomType } from '../sim/types';

// ---------------------------------------------------------------------------
// World layout (units). Street level is y = 0; floors stack downward.
// The bunker is a concrete hull dug into the earth; rooms are bays cut into it.
// ---------------------------------------------------------------------------
const CW = 4; // bay width
const CH = 3; // floor height
const TOP = -1.0; // y of the top of floor 0 (leaves a roof slab under the street)
const SHAFT_W = 1.8; // elevator shaft, left of col 0
const INSET = 0.17; // concrete between bays
const HULL_PAD = 0.45; // concrete around the outside of the hull
const DWELLER_H = 1.55;
const ROOM_ART_ASPECT = 1400 / 600;
const SURFACE_ASPECT = 2400 / 1029;
// The street painting is used once, wide enough to cover the whole bunker.
const SURFACE_W = 30;
const SURFACE_GROUND = 0.17; // fraction of the painting below street level
const SKY_LIMIT = (SURFACE_W / SURFACE_ASPECT) * (1 - SURFACE_GROUND) - 0.3; // top of the painting
const INK = 0x0b0b10;

const HULL_L = -SHAFT_W - HULL_PAD;
const HULL_R = COLS * CW + HULL_PAD;
const floorTop = (f: number) => TOP - f * CH;
const roomX = (col: number) => col * CW;
const floorY = (f: number) => floorTop(f) - CH + INSET + 0.1; // where feet go

export interface ViewCallbacks {
  onRoom(roomId: number): void;
  onDweller(id: number): void;
  /** A degen was dragged and released over a room. */
  onDrop(dwellerId: number, roomId: number): void;
  onEmptyCell(floor: number, col: number): void;
  onDig(): void;
  selected(): number | null;
}

interface RoomView {
  key: string;
  group: THREE.Group;
  art: THREE.MeshBasicMaterial;
  outline: THREE.Mesh;
  label: HTMLDivElement;
}

interface DwellerView {
  group: THREE.Group;
  sprite: THREE.Mesh;
  ring: THREE.Mesh;
  tag: HTMLDivElement;
  x: number;
  targetX: number;
  wait: number;
  roomKey: string;
  bob: number;
  facing: number;
}

const RES_ICON: Partial<Record<RoomType, string>> = { reactor: '⚡', kitchen: '🍜', pool: '💧', copium: '💊' };
const mat = (color: number) => new THREE.MeshBasicMaterial({ color });

// ---------- Textures ----------
interface TexEntry {
  t: THREE.Texture;
  ready: boolean;
  waiters: (() => void)[];
}
const loader = new THREE.TextureLoader();
const texCache = new Map<string, TexEntry>();
function texEntry(url: string): TexEntry {
  let e = texCache.get(url);
  if (!e) {
    const entry: TexEntry = { t: null as unknown as THREE.Texture, ready: false, waiters: [] };
    entry.t = loader.load(url, () => {
      entry.ready = true;
      for (const fn of entry.waiters) fn();
      entry.waiters = [];
    });
    entry.t.colorSpace = THREE.SRGBColorSpace;
    entry.t.anisotropy = 4;
    texCache.set(url, entry);
    e = entry;
  }
  return e;
}
const tex = (url: string) => texEntry(url).t;
const roomArt = (type: RoomType | 'empty') => `/art/rooms/${type}.webp`;
const spriteArt = (name: string) => `/art/sprites/${name}.webp`;

/** A tiling texture sized in world units (one copy per use so repeats don't fight). */
function tiled(url: string, w: number, h: number, tile: number): THREE.Texture {
  const t = tex(url).clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / tile, h / tile);
  t.needsUpdate = true;
  return t;
}

/** Sprite plane that sizes itself to the image's aspect once loaded, anchored at its feet. */
function spriteMesh(url: string, height: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const entry = texEntry(url);
  const material = new THREE.MeshBasicMaterial({ map: entry.t, transparent: true, alphaTest: 0.05 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.set(height * 0.5, height, 1);
  const fit = () => {
    const img = entry.t.image as HTMLImageElement;
    mesh.scale.set((height * img.width) / img.height, height, 1);
  };
  if (entry.ready) fit();
  else entry.waiters.push(fit);
  return mesh;
}

/** Yellow/black hazard stripes, drawn once. */
function hazardTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffc21a';
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#111';
  for (let x = -32; x < 160; x += 32) {
    g.beginPath();
    g.moveTo(x, 32);
    g.lineTo(x + 16, 32);
    g.lineTo(x + 32, 0);
    g.lineTo(x + 16, 0);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BunkerView {
  readonly renderer: THREE.WebGLRenderer;
  readonly labels: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;

  // Fixed camera: x and zoom are fit to the bunker; only y scrolls (smoothly).
  private cy = 0;
  private tcy = 0;
  private zoom = 14;
  private keys = new Set<string>();
  private shake = 0;
  private lastFloors = 0;
  private started = false;

  private surface!: THREE.MeshBasicMaterial;
  private rooms = new Map<number, RoomView>();
  private dwellers = new Map<number, DwellerView>();
  private hull = new THREE.Group();
  private hullSig = '';
  private raiders = new THREE.Group();
  private flash: HTMLDivElement;
  private raycaster = new THREE.Raycaster();
  private lastVersion = -1;

  private hoverRoom: number | null = null;
  private hoverDweller: number | null = null;
  private dragDweller: { id: number; startX: number; startY: number; active: boolean } | null = null;
  private pointer = new THREE.Vector2();
  private popupTimer = 0;

  constructor(private host: HTMLElement, private game: Game, private cb: ViewCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setClearColor(0x2a2018);
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    host.appendChild(this.labels.domElement);

    this.flash = document.createElement('div');
    this.flash.className = 'flash';
    host.appendChild(this.flash);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.z = 20;

    this.buildSurface();
    this.scene.add(this.hull);
    this.scene.add(this.raiders);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ----------------------------------------------------------------------
  // Static scenery
  // ----------------------------------------------------------------------

  private buildSurface(): void {
    // One painted street (no tiling, so nothing repeats), mirrored so the
    // painting's own porta-potty sits exactly on top of the elevator shaft.
    const w = SURFACE_W;
    const h = w / SURFACE_ASPECT;
    const POTTY_U = 1 - 0.905; // potty position in the mirrored painting
    const t = tex('/art/surface.webp');
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(-1, 1);
    this.surface = new THREE.MeshBasicMaterial({ map: t });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.surface);
    const cx = -SHAFT_W / 2 - POTTY_U * w + w / 2;
    bg.position.set(cx, h / 2 - h * SURFACE_GROUND, -8);
    this.scene.add(bg);
    // Sky above the painting, in case a tall screen shows more.
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(200, 40), mat(0x7a6a52));
    sky.position.set(cx, h * (1 - SURFACE_GROUND) + 20, -8.5);
    this.scene.add(sky);

    // Earth: everything below the street.
    const ew = 140;
    const eh = 120;
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(ew, eh), new THREE.MeshBasicMaterial({ map: tiled('/art/env/earth.webp', ew, eh, 7), color: 0xb8aaa0 }));
    earth.position.set(cx, -eh / 2 - 0.25, -7);
    this.scene.add(earth);
    const kerb = new THREE.Mesh(new THREE.PlaneGeometry(ew, 0.12), mat(INK));
    kerb.position.set(cx, -0.25, -6.9);
    this.scene.add(kerb);

    const sign = this.label('▼ BUNKR ▼', 'sign');
    sign.position.set(-SHAFT_W / 2, (0.417 - SURFACE_GROUND) * h + 0.55, 0);
    this.scene.add(sign);
  }

  /** Concrete hull, shaft, empty bays, build buttons. Rebuilt when the layout changes. */
  private syncHull(): void {
    const g = this.game;
    const buildable: string[] = [];
    for (let f = 0; f < g.floorsDug; f++) {
      for (let c = 0; c < COLS; c++) if (g.canBuildAt(f, c)) buildable.push(`${f}.${c}`);
    }
    const canBuild = g.phase === 'prep' || g.phase === 'underground';
    const sig = `${g.floorsDug}|${buildable.join(',')}|${canBuild}|${g.digCost()}|${g.rooms.map((r) => `${r.floor}.${r.col}.${r.width}`).join(',')}`;
    if (sig === this.hullSig) return;
    this.hullSig = sig;

    for (const obj of [...this.hull.children]) {
      this.hull.remove(obj);
      if (obj instanceof CSS2DObject) obj.element.remove();
    }

    const hullTop = TOP + HULL_PAD;
    const hullBottom = floorTop(g.floorsDug) - HULL_PAD;
    const hw = HULL_R - HULL_L;
    const hh = hullTop - hullBottom;
    const hx = (HULL_L + HULL_R) / 2;
    const hy = (hullTop + hullBottom) / 2;

    // Ink outline, concrete body, hazard roof band.
    const ink = new THREE.Mesh(new THREE.PlaneGeometry(hw + 0.16, hh + 0.16), mat(INK));
    ink.position.set(hx, hy, -3.1);
    const concrete = new THREE.Mesh(new THREE.PlaneGeometry(hw, hh), new THREE.MeshBasicMaterial({ map: tiled('/art/env/concrete.webp', hw, hh, 3.2) }));
    concrete.position.set(hx, hy, -3);
    const hz = hazardTexture();
    hz.repeat.set(hw / 0.9, 1);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(hw, 0.22), new THREE.MeshBasicMaterial({ map: hz }));
    roof.position.set(hx, hullTop - 0.11, -2.9);
    const roofLine = new THREE.Mesh(new THREE.PlaneGeometry(hw, 0.06), mat(INK));
    roofLine.position.set(hx, hullTop - 0.25, -2.9);
    this.hull.add(ink, concrete, roof, roofLine);

    // Elevator shaft: neck up to the street, then one segment per floor.
    const shaftInnerW = SHAFT_W - INSET * 2;
    const shaftTop = 0;
    const shaftBottom = floorTop(g.floorsDug - 1) - CH + INSET;
    const sh = shaftTop - shaftBottom;
    const shaftInk = new THREE.Mesh(new THREE.PlaneGeometry(shaftInnerW + 0.1, sh), mat(INK));
    shaftInk.position.set(-SHAFT_W / 2, (shaftTop + shaftBottom) / 2, -2.6);
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(shaftInnerW, sh), new THREE.MeshBasicMaterial({ map: tiled('/art/env/shaft.webp', shaftInnerW, sh, shaftInnerW) }));
    // Shaft art is 9:16 — tile one image per (width, width*16/9) of height.
    shaft.material.map!.repeat.set(1, sh / (shaftInnerW * 16 / 9));
    shaft.position.set(-SHAFT_W / 2, (shaftTop + shaftBottom) / 2, -2.5);
    this.hull.add(shaftInk, shaft);

    // Empty bays: raw construction space, dim, waiting for a room.
    for (let f = 0; f < g.floorsDug; f++) {
      for (let c = 0; c < COLS; c++) {
        if (g.roomAt(f, c)) continue;
        const w = CW - INSET * 2;
        const h = CH - INSET * 2;
        const t = tex(roomArt('empty')).clone();
        t.needsUpdate = true;
        t.repeat.set((w / h) / ROOM_ART_ASPECT, 1);
        t.offset.set(((c * 0.37) % 1) * (1 - t.repeat.x), 0);
        const bayInk = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.1), mat(INK));
        bayInk.position.set(roomX(c) + CW / 2, floorTop(f) - CH / 2, -2.2);
        const bay = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: 0x8a8a8a }));
        bay.position.set(roomX(c) + CW / 2, floorTop(f) - CH / 2, -2.1);
        this.hull.add(bayInk, bay);
      }
    }

    if (!canBuild) return;
    for (const key of buildable) {
      const [f, c] = key.split('.').map(Number);
      const el = document.createElement('button');
      el.className = 'cell-btn';
      el.innerHTML = '<b>+</b><span>BUILD</span>';
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cb.onEmptyCell(f, c);
      });
      const obj = new CSS2DObject(el);
      obj.position.set(roomX(c) + CW / 2, floorTop(f) - CH / 2, 0);
      this.hull.add(obj);
    }
    if (g.floorsDug < MAX_FLOORS) {
      const el = document.createElement('button');
      el.className = 'dig-btn';
      el.textContent = `⛏ DIG FLOOR ${g.floorsDug + 1} · ${g.digCost()} 🍜`;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cb.onDig();
      });
      const obj = new CSS2DObject(el);
      obj.position.set((COLS * CW) / 2, floorTop(g.floorsDug) - 1.1, 0);
      this.hull.add(obj);
    }
  }

  private syncRooms(): void {
    const g = this.game;
    const seen = new Set<number>();
    for (const room of g.rooms) {
      seen.add(room.id);
      const key = `${room.col}:${room.width}:${room.floor}`;
      let v = this.rooms.get(room.id);
      if (v && v.key !== key) {
        this.removeRoom(room.id);
        v = undefined;
      }
      if (!v) {
        v = this.makeRoom(room, key);
        this.rooms.set(room.id, v);
        gsap.from(v.group.scale, { x: 0.8, y: 0.8, duration: 0.45, ease: 'back.out(2.5)' });
      }
      const def = ROOMS[room.type];
      const powered = room.type === 'reactor' || room.type === 'storage' || g.res.power > 0;
      const workers = g.workersIn(room).length;
      const lit = powered && (workers > 0 || !def.stat);
      // Unstaffed rooms sit dim; unpowered rooms go almost dark with a flicker.
      const flicker = !powered ? 0.12 + Math.random() * 0.06 : 0;
      v.art.color.setScalar(!powered ? flicker : lit ? 1 : 0.5);
      const dropTarget = this.dragDweller?.active && this.hoverRoom === room.id;
      v.outline.visible = this.hoverRoom === room.id;
      (v.outline.material as THREE.MeshBasicMaterial).color.setHex(
        dropTarget ? (workers < g.capacity(room) ? 0x8cff4f : 0xff4b3e) : 0xfff8ec,
      );
      const cap = g.capacity(room);
      v.label.textContent = cap ? `${def.short}  ${workers}/${cap}` : def.short;
      v.label.classList.toggle('dark', !powered);
      v.label.classList.toggle('empty', powered && cap > 0 && workers === 0);
    }
    for (const id of [...this.rooms.keys()]) if (!seen.has(id)) this.removeRoom(id);
  }

  private makeRoom(room: Room, key: string): RoomView {
    const group = new THREE.Group();
    const w = room.width * CW - INSET * 2;
    const h = CH - INSET * 2;
    // Cover-crop the wide room painting to this room's shape, favouring the floor.
    const t = tex(roomArt(room.type)).clone();
    t.needsUpdate = true;
    const aspect = w / h;
    if (aspect > ROOM_ART_ASPECT) {
      t.repeat.set(1, ROOM_ART_ASPECT / aspect);
      t.offset.set(0, (1 - t.repeat.y) * 0.25);
    } else {
      t.repeat.set(aspect / ROOM_ART_ASPECT, 1);
      t.offset.set((1 - t.repeat.x) / 2, 0);
    }
    const ink = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.12, h + 0.12), mat(INK));
    ink.position.z = -0.05;
    const art = new THREE.MeshBasicMaterial({ map: t });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), art);
    back.userData.roomId = room.id;
    // Hover / drop-target highlight: a bright frame just inside the edge.
    const ring = new THREE.Shape();
    const i = 0.1;
    ring.moveTo(-w / 2, -h / 2); ring.lineTo(w / 2, -h / 2); ring.lineTo(w / 2, h / 2); ring.lineTo(-w / 2, h / 2);
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + i, -h / 2 + i); hole.lineTo(-w / 2 + i, h / 2 - i); hole.lineTo(w / 2 - i, h / 2 - i); hole.lineTo(w / 2 - i, -h / 2 + i);
    ring.holes.push(hole);
    const outline = new THREE.Mesh(new THREE.ShapeGeometry(ring), new THREE.MeshBasicMaterial({ color: 0xfff8ec }));
    outline.position.z = 0.9;
    outline.visible = false;
    group.add(ink, back, outline);

    const label = document.createElement('div');
    label.className = 'room-label';
    const obj = new CSS2DObject(label);
    obj.position.set(-w / 2, h / 2, 0);
    obj.center.set(0, 0);
    group.add(obj);

    group.position.set(roomX(room.col) + (room.width * CW) / 2, floorTop(room.floor) - CH / 2, -1);
    this.scene.add(group);
    return { key, group, art, outline, label };
  }

  private removeRoom(id: number): void {
    const v = this.rooms.get(id);
    if (!v) return;
    v.label.remove();
    this.scene.remove(v.group);
    this.rooms.delete(id);
  }

  // ----------------------------------------------------------------------
  // Degens
  // ----------------------------------------------------------------------

  private dwellerSpot(d: Dweller): { key: string; minX: number; maxX: number; y: number } {
    const g = this.game;
    const room = g.roomById(d.roomId);
    if (room) {
      const x0 = roomX(room.col) + 0.75;
      return { key: `r${room.id}:${room.col}:${room.width}`, minX: x0, maxX: x0 + room.width * CW - 1.5, y: floorY(room.floor) };
    }
    if (g.phase === 'prep') return { key: 'surface', minX: 0.8, maxX: 12, y: -0.15 };
    // Idle underground: loiter in the shaft on floor 0.
    return { key: 'idle', minX: -SHAFT_W + 0.6, maxX: -0.6, y: floorY(0) };
  }

  private makeDweller(d: Dweller): DwellerView {
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    shadow.scale.y = 0.22;
    shadow.position.z = -0.01;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 32), mat(0x8cff4f));
    ring.scale.y = 0.3;
    ring.visible = false;
    const sprite = spriteMesh(spriteArt(d.arch), DWELLER_H);
    sprite.userData.dwellerId = d.id;
    // Generous invisible hit box so degens are easy to grab.
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, DWELLER_H + 0.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    hit.position.set(0, DWELLER_H / 2, 0.05);
    hit.userData.dwellerId = d.id;
    group.add(shadow, ring, sprite, hit);

    const tag = document.createElement('div');
    tag.className = 'dweller-tag';
    tag.textContent = d.name;
    const obj = new CSS2DObject(tag);
    obj.position.set(0, DWELLER_H + 0.25, 0);
    group.add(obj);

    this.scene.add(group);
    const spot = this.dwellerSpot(d);
    const x = spot.minX + Math.random() * (spot.maxX - spot.minX);
    group.position.set(x, spot.y, 0.2);
    return { group, sprite, ring, tag, x, targetX: x, wait: 0, roomKey: spot.key, bob: Math.random() * 6, facing: 1 };
  }

  private syncDwellers(dt: number): void {
    const g = this.game;
    const sel = this.cb.selected();
    const visible = new Set<number>();
    for (const d of g.dwellers) {
      if (d.status !== 'active') continue;
      visible.add(d.id);
      let v = this.dwellers.get(d.id);
      if (!v) {
        v = this.makeDweller(d);
        this.dwellers.set(d.id, v);
        gsap.from(v.group.scale, { x: 0, y: 0, duration: 0.45, ease: 'back.out(3)' });
      }
      const spot = this.dwellerSpot(d);
      if (spot.key !== v.roomKey) {
        v.roomKey = spot.key;
        v.x = Math.min(spot.maxX, Math.max(spot.minX, v.x));
        v.targetX = spot.minX + Math.random() * (spot.maxX - spot.minX);
        gsap.fromTo(v.group.scale, { y: 0.6 }, { y: 1, duration: 0.4, ease: 'elastic.out(1.2, 0.4)' });
      }
      if (this.dragDweller?.active && this.dragDweller.id === d.id) {
        // Picked up: dangle under the cursor, flailing.
        const p = this.screenToWorld(this.pointer.x, this.pointer.y);
        v.group.position.set(p.x, p.y - DWELLER_H * 0.75, 1.5);
        v.sprite.rotation.z = Math.sin(performance.now() / 70) * 0.18;
        v.ring.visible = false;
        v.tag.classList.add('sel');
        continue;
      }
      // Wander inside the room. Panic makes everyone faster.
      const zone = g.vibeZone();
      const panic = g.raid ? 2.5 : zone === 'cooked' || zone === 'manic' ? 1.8 : 1;
      v.wait -= dt;
      if (v.wait <= 0 && Math.abs(v.targetX - v.x) < 0.05) {
        v.targetX = spot.minX + Math.random() * (spot.maxX - spot.minX);
        v.wait = 0.8 + Math.random() * 3;
      }
      // Selected or hovered degens hold still so they're easy to grab.
      const speed = d.id === sel || d.id === this.hoverDweller ? 0 : 0.85 * panic;
      const step = Math.sign(v.targetX - v.x) * Math.min(Math.abs(v.targetX - v.x), dt * speed);
      v.x += step;
      const walking = Math.abs(step) > 0.0005;
      if (walking) v.facing = step < 0 ? -1 : 1;
      v.bob += dt * (walking ? 11 : 2.2) * panic;
      v.group.position.set(v.x + (d.arch === 'pete' && g.raid ? Math.sin(g.time * 60) * 0.05 : 0), spot.y, 0.2);
      // Bouncy walk: hop + lean into the step; idle breathing.
      const hop = walking ? Math.abs(Math.sin(v.bob)) : 0;
      v.sprite.position.y = hop * 0.12;
      v.sprite.rotation.z = walking ? -v.facing * 0.06 + Math.sin(v.bob) * 0.05 : Math.sin(v.bob) * 0.015;
      if (d.hp < 40) v.sprite.rotation.z += Math.sin(g.time * 20) * 0.02;
      const breathe = walking ? 1 - hop * 0.04 : 1 + Math.sin(v.bob) * 0.015;
      v.sprite.scale.set(Math.abs(v.sprite.scale.x) * v.facing, DWELLER_H * breathe, 1);
      v.ring.visible = d.id === sel;
      v.tag.classList.toggle('sel', d.id === sel);
      v.tag.classList.toggle('hurt', d.hp < 40);
      v.tag.textContent = d.hp < 40 ? `${d.name} ♥${Math.round(d.hp)}` : d.name;
    }
    for (const [id, v] of [...this.dwellers]) {
      if (visible.has(id)) continue;
      v.tag.remove();
      this.scene.remove(v.group);
      this.dwellers.delete(id);
    }
  }

  private syncRaid(): void {
    const raid = this.game.raid;
    const want = raid ? Math.max(1, Math.ceil((raid.hp / raid.maxHp) * 4)) : 0;
    while (this.raiders.children.length > want) this.raiders.remove(this.raiders.children[0]);
    while (this.raiders.children.length < want) this.raiders.add(spriteMesh(spriteArt('raider'), 1.8));
    this.raiders.children.forEach((r, i) => {
      r.position.set(0.9 + i * 0.95, floorY(0), 0.6);
      r.rotation.z = Math.sin(this.game.time * 9 + i) * 0.08;
    });
  }

  private handleFx(): void {
    const g = this.game;
    while (g.fx.length) {
      const fx = g.fx.shift()!;
      if (fx === 'drop') {
        gsap.fromTo(this.flash, { opacity: 1 }, { opacity: 0, duration: 2.5, ease: 'power2.in' });
        this.shake = 1.2;
        // Look up at the sky as it lights up, then dive into the bunker.
        this.tcy = this.scrollRange().max;
        setTimeout(() => this.scrollToFloor(0), 2600);
      } else if (fx === 'hit') {
        this.shake = Math.max(this.shake, 0.25);
      } else if (fx === 'raid') {
        this.shake = 0.6;
        this.scrollToFloor(0);
      } else if (fx === 'death') {
        this.flash.style.background = '#ff4b3e';
        gsap.fromTo(this.flash, { opacity: 0.45 }, { opacity: 0, duration: 0.8, onComplete: () => { this.flash.style.background = ''; } });
      }
    }
  }

  /** Floating "+3 🍜" numbers over producing rooms. */
  private popups(dt: number): void {
    this.popupTimer += dt;
    if (this.popupTimer < 2.2) return;
    this.popupTimer = 0;
    for (const [roomId, amount] of this.game.roomOut) {
      const room = this.game.roomById(roomId);
      const icon = room && RES_ICON[room.type];
      if (!room || !icon || amount < 1) continue;
      this.game.roomOut.set(roomId, amount - Math.floor(amount));
      const el = document.createElement('div');
      el.className = 'popup';
      el.textContent = `+${Math.floor(amount)} ${icon}`;
      const obj = new CSS2DObject(el);
      obj.position.set(roomX(room.col) + (room.width * CW) / 2 + (Math.random() - 0.5), floorTop(room.floor) - 0.9, 2);
      this.scene.add(obj);
      gsap.fromTo(obj.position, { y: obj.position.y }, { y: obj.position.y + 0.9, duration: 1.4, ease: 'power2.out' });
      gsap.fromTo(el, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)' });
      gsap.to(el, { opacity: 0, delay: 1, duration: 0.4, onComplete: () => { this.scene.remove(obj); el.remove(); } });
    }
  }

  // ----------------------------------------------------------------------
  // Camera: fit the bunker's width, scroll vertically only.
  // ----------------------------------------------------------------------

  private aspect(): number {
    return this.host.clientWidth / Math.max(1, this.host.clientHeight);
  }

  private fitZoom(): number {
    const worldW = HULL_R - HULL_L + 1.2;
    return worldW / this.aspect();
  }

  private scrollRange(): { min: number; max: number } {
    const max = SKY_LIMIT - this.zoom / 2;
    const bottom = floorTop(this.game.floorsDug) - 2.2; // leave room for the DIG button
    const min = Math.min(max, bottom + this.zoom / 2);
    return { min, max };
  }

  scrollToFloor(floor: number): void {
    const { min, max } = this.scrollRange();
    // Bring the floor fully into view, biased toward the lower part of the screen.
    const want = floorTop(floor) - CH / 2 + this.zoom * 0.15;
    this.tcy = Math.max(min, Math.min(max, want));
  }

  private updateCamera(dt: number): void {
    this.zoom = this.fitZoom();
    const step = this.zoom * 1.1 * dt;
    if (this.keys.has('w') || this.keys.has('arrowup')) this.tcy += step;
    if (this.keys.has('s') || this.keys.has('arrowdown')) this.tcy -= step;
    // Newly dug floor: glide down to it.
    if (this.game.floorsDug !== this.lastFloors) {
      if (this.started && this.game.floorsDug > this.lastFloors) this.scrollToFloor(this.game.floorsDug - 1);
      this.lastFloors = this.game.floorsDug;
    }
    const { min, max } = this.scrollRange();
    if (!this.started) {
      this.started = true;
      // Open on the street with floor 0 fully in view; scroll up for the skyline.
      this.tcy = this.cy = Math.max(min, Math.min(max, floorTop(0) - CH - 0.5 + this.zoom / 2));
    }
    this.tcy = Math.max(min, Math.min(max, this.tcy));
    this.cy += (this.tcy - this.cy) * (1 - Math.pow(0.0008, dt));
  }

  // ----------------------------------------------------------------------
  // Frame
  // ----------------------------------------------------------------------

  frame(dt: number): void {
    const g = this.game;
    this.handleFx();
    if (g.version !== this.lastVersion) {
      this.lastVersion = g.version;
      this.syncHull();
    }
    this.syncRooms();
    this.syncDwellers(dt);
    this.syncRaid();
    this.popups(dt);
    this.updateCamera(dt);

    // Before the drop the street is merely doomed; after, it's scorched.
    if (g.phase === 'prep') {
      const t = 1 - g.prepLeft / 75;
      this.surface.color.setRGB(1, 0.97 - 0.12 * t, 0.92 - 0.25 * t);
    } else {
      const pulse = 0.04 * Math.sin(g.time * 0.8);
      this.surface.color.setRGB(0.92 + pulse, 0.84 + pulse, 0.78);
    }

    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    const aspect = this.aspect();
    const h = this.zoom / 2;
    this.camera.left = -h * aspect;
    this.camera.right = h * aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.position.set((HULL_L + HULL_R) / 2 + sx, this.cy + sy, 20);
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  focusFloor(floor: number): void {
    this.scrollToFloor(floor);
  }

  /** Where a room currently sits on screen (client px), for the pop-out animation. */
  roomScreenRect(roomId: number): { x: number; y: number; w: number; h: number } | null {
    const room = this.game.roomById(roomId);
    if (!room) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const toScreen = (wx: number, wy: number) => {
      const v = new THREE.Vector3(wx, wy, 0).project(this.camera);
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    const a = toScreen(roomX(room.col) + INSET, floorTop(room.floor) - INSET);
    const b = toScreen(roomX(room.col + room.width) - INSET, floorTop(room.floor) - CH + INSET);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  // ----------------------------------------------------------------------
  // Input
  // ----------------------------------------------------------------------

  private screenToWorld(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2((HULL_L + HULL_R) / 2 + (nx * this.zoom * this.aspect()) / 2, this.cy + (ny * this.zoom) / 2);
  }

  private bindInput(): void {
    const el = this.labels.domElement;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      this.pointer.set(e.clientX, e.clientY);
      const hit = this.hitTest(e.clientX, e.clientY);
      if (hit.dweller != null) this.dragDweller = { id: hit.dweller, startX: e.clientX, startY: e.clientY, active: false };
    });

    el.addEventListener('pointermove', (e) => {
      this.pointer.set(e.clientX, e.clientY);
      const hit = this.hitTest(e.clientX, e.clientY);
      this.hoverRoom = hit.room;
      this.hoverDweller = hit.dweller;
      el.style.cursor = this.dragDweller?.active ? 'grabbing' : hit.dweller != null ? 'grab' : hit.room != null ? 'pointer' : 'default';
      const dd = this.dragDweller;
      if (dd && !dd.active && Math.hypot(e.clientX - dd.startX, e.clientY - dd.startY) > 6) {
        dd.active = true;
        this.cb.onDweller(dd.id); // select while carrying, for the info card
      }
    });

    const end = (e: PointerEvent) => {
      const dd = this.dragDweller;
      this.dragDweller = null;
      if (dd) {
        if (dd.active) {
          const room = this.hitTest(e.clientX, e.clientY).room;
          if (room != null) this.cb.onDrop(dd.id, room);
        } else {
          this.cb.onDweller(dd.id);
        }
        return;
      }
      const room = this.hitTest(e.clientX, e.clientY).room;
      if (room != null) this.cb.onRoom(room);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => (this.dragDweller = null));

    // The page is the game: the wheel only scrolls the bunker, never the page.
    window.addEventListener('wheel', (e) => {
      const scrollable = (e.target as HTMLElement).closest?.('.scroll');
      if (scrollable && !e.ctrlKey) return;
      e.preventDefault();
      if ((e.target as HTMLElement).closest?.('.modal, .modal-bg')) return;
      this.tcy -= e.deltaY * this.zoom * 0.0011;
    }, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange']) window.addEventListener(ev, (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 's', 'arrowup', 'arrowdown'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private hitTest(clientX: number, clientY: number): { dweller: number | null; room: number | null } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let dweller: number | null = null;
    let room: number | null = null;
    for (const h of hits) {
      const did = h.object.userData.dwellerId;
      const rid = h.object.userData.roomId;
      if (did != null && dweller == null && did !== this.dragDweller?.id) dweller = did;
      if (rid != null && room == null) room = rid;
    }
    if (this.dragDweller?.active) dweller = null;
    return { dweller, room };
  }

  private label(text: string, cls: string): CSS2DObject {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return new CSS2DObject(el);
  }

  private resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
  }
}
