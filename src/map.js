/**
 * map.js — Geração procedural por BSP (Binary Space Partitioning)
 * Echoes From Below
 */

export const CELL = {
  WALL:        0,
  FLOOR:       1,
  DOOR_LOCKED: 2,
  DOOR_OPEN:   3,
  LEVER:       4,
  EXIT:        5,
  PUZZLE_DOOR: 6,
};

const MAP_W = 40;
const MAP_H = 30;
const MIN_ROOM_SIZE = 4;
const SPLIT_CHANCE = 0.85; // probabilidade de continuar dividindo

// ─── BSP ──────────────────────────────────────────────────────────────────────

class BSPNode {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left = null; this.right = null;
    this.room = null; // { x, y, w, h }
  }

  split(rng) {
    if (this.left || this.right) return false;

    // Decidir se divide horizontal ou verticalmente
    let horizontal = rng() < 0.5;
    if (this.w > this.h * 1.25)  horizontal = false;
    if (this.h > this.w * 1.25)  horizontal = true;

    const max = (horizontal ? this.h : this.w) - MIN_ROOM_SIZE;
    if (max <= MIN_ROOM_SIZE) return false; // muito pequeno

    const split = Math.floor(rng() * (max - MIN_ROOM_SIZE)) + MIN_ROOM_SIZE;

    if (horizontal) {
      this.left  = new BSPNode(this.x, this.y, this.w, split);
      this.right = new BSPNode(this.x, this.y + split, this.w, this.h - split);
    } else {
      this.left  = new BSPNode(this.x, this.y, split, this.h);
      this.right = new BSPNode(this.x + split, this.y, this.w - split, this.h);
    }
    return true;
  }

  createRooms(rng) {
    if (this.left || this.right) {
      if (this.left)  this.left.createRooms(rng);
      if (this.right) this.right.createRooms(rng);
    } else {
      const rw = Math.floor(rng() * (this.w - MIN_ROOM_SIZE)) + MIN_ROOM_SIZE - 1;
      const rh = Math.floor(rng() * (this.h - MIN_ROOM_SIZE)) + MIN_ROOM_SIZE - 1;
      const rx = this.x + Math.floor(rng() * (this.w - rw));
      const ry = this.y + Math.floor(rng() * (this.h - rh));
      this.room = { x: rx, y: ry, w: rw, h: rh };
    }
  }

  getRoom(rng) {
    if (this.room) return this.room;
    const l = this.left?.getRoom(rng);
    const r = this.right?.getRoom(rng);
    if (!l) return r;
    if (!r) return l;
    return rng() < 0.5 ? l : r;
  }

  getAllRooms() {
    if (this.room) return [this.room];
    return [...(this.left?.getAllRooms() ?? []), ...(this.right?.getAllRooms() ?? [])];
  }
}

// ─── Gerador principal ────────────────────────────────────────────────────────

/**
 * Gera um mapa completo.
 * @param {number} seed — semente para reprodutibilidade
 * @returns {{ grid, rooms, startPos, exitPos, keys, levers, puzzleDoors, items, spectreStart }}
 */
export function generateMap(seed) {
  const rng = seededRng(seed);

  // 1. Grade de paredes
  const grid = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(CELL.WALL));

  // 2. BSP
  const root = new BSPNode(1, 1, MAP_W - 2, MAP_H - 2);
  const nodes = [root];
  while (nodes.length > 0) {
    const node = nodes.pop();
    if (node.w > MIN_ROOM_SIZE * 2 || node.h > MIN_ROOM_SIZE * 2) {
      if (rng() < SPLIT_CHANCE && node.split(rng)) {
        nodes.push(node.left, node.right);
      }
    }
  }
  root.createRooms(rng);

  // 3. Cavar salas
  const rooms = root.getAllRooms();
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        grid[y][x] = CELL.FLOOR;
      }
    }
  }

  // 4. Conectar salas com corredores
  connectRooms(root, grid, rng);

  // 5. Posicionar entidades
  const floors = getFloorCells(grid);
  shuffle(floors, rng);

  const startPos    = floors.pop();
  const exitPos     = pickFar(floors, startPos, rng);
  const spectreStart = pickFar(floors.filter(c => dist(c, startPos) > 8), startPos, rng);

  // 3 chaves
  const keys = [floors.pop(), floors.pop(), floors.pop()];

  // Alavancas e portas internas (2–4 pares)
  const nLevers = 2 + Math.floor(rng() * 3);
  const levers = [];
  const lockedDoors = [];
  for (let i = 0; i < nLevers; i++) {
    const lever = floors.pop();
    const door  = floors.pop();
    if (lever && door) {
      grid[door.y][door.x] = CELL.DOOR_LOCKED;
      levers.push({ ...lever, targetDoor: door });
      lockedDoors.push(door);
    }
  }

  // Portas com puzzle de runas (1–2)
  const nPuzzles = 1 + Math.floor(rng() * 2);
  const puzzleDoors = [];
  for (let i = 0; i < nPuzzles; i++) {
    const door = floors.pop();
    if (door) {
      grid[door.y][door.x] = CELL.PUZZLE_DOOR;
      puzzleDoors.push({ ...door, sequence: generateRuneSequence(rng) });
    }
  }

  // Saída
  grid[exitPos.y][exitPos.x] = CELL.EXIT;

  // Itens espalhados (espadas, tocha, corda, relatos)
  const itemPool = buildItemPool(rng);
  const itemCells = [];
  for (const item of itemPool) {
    const cell = floors.pop();
    if (cell) itemCells.push({ ...cell, item });
  }

  return {
    grid,
    width: MAP_W,
    height: MAP_H,
    rooms,
    startPos,
    exitPos,
    spectreStart,
    keys,
    levers,
    puzzleDoors,
    items: itemCells,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function connectRooms(node, grid, rng) {
  if (!node.left || !node.right) return;
  connectRooms(node.left, grid, rng);
  connectRooms(node.right, grid, rng);

  const roomA = node.left.getRoom(rng);
  const roomB = node.right.getRoom(rng);
  if (!roomA || !roomB) return;

  const ax = Math.floor(roomA.x + roomA.w / 2);
  const ay = Math.floor(roomA.y + roomA.h / 2);
  const bx = Math.floor(roomB.x + roomB.w / 2);
  const by = Math.floor(roomB.y + roomB.h / 2);

  // Corredor em L
  let x = ax, y = ay;
  while (x !== bx) {
    grid[y][x] = CELL.FLOOR;
    x += x < bx ? 1 : -1;
  }
  while (y !== by) {
    grid[y][x] = CELL.FLOOR;
    y += y < by ? 1 : -1;
  }
}

function getFloorCells(grid) {
  const cells = [];
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++)
      if (grid[y][x] === CELL.FLOOR) cells.push({ x, y });
  return cells;
}

function pickFar(cells, ref, rng) {
  if (cells.length === 0) return { x: 1, y: 1 };
  // Pega as 20% mais distantes e escolhe aleatoriamente entre elas
  const sorted = [...cells].sort((a, b) => dist(b, ref) - dist(a, ref));
  const pool = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.2)));
  const idx = Math.floor(rng() * pool.length);
  cells.splice(cells.indexOf(pool[idx]), 1);
  return pool[idx];
}

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

const RUNES = ['fogo', 'água', 'terra', 'vento', 'sombra', 'luz'];
function generateRuneSequence(rng, len = 3) {
  const seq = [];
  const pool = [...RUNES];
  shuffle(pool, rng);
  for (let i = 0; i < len; i++) seq.push(pool[i]);
  return seq;
}

function buildItemPool(rng) {
  const pool = [
    'espada_bronze',
    'espada_ferro',
    'tocha_apagada',
    'corda',
  ];
  // Adiciona 2–4 relatos de lore
  const nLore = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < nLore; i++) pool.push(`relato_${i + 1}`);
  shuffle(pool, rng);
  return pool;
}

/**
 * RNG determinístico baseado em seed (mulberry32).
 */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
