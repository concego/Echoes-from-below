/**
 * specter.js — IA do Carrasco (espectro perseguidor)
 * Pathfinding A* no grid, tempo real
 * Echoes From Below
 */

import { CELL } from './map.js';
import { setThreatLevel, narrate } from './aria.js';

const SPECTER_SPEED_MS = 600; // intervalo entre passos (ms) — ajustar dificuldade
const BANISH_DURATION_MS = 8000; // tempo banido após espada de ferro

export class Specter {
  constructor(startPos, mapData) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.mapData = mapData;
    this.banished = false;
    this.banishTimer = null;
    this._stepTimer = null;
    this._lastThreatLevel = 'none';
  }

  // ─── Controle de loop ─────────────────────────────────────────────────────

  start(onGameOver) {
    this._onGameOver = onGameOver;
    this._scheduleStep();
  }

  stop() {
    clearTimeout(this._stepTimer);
    clearTimeout(this.banishTimer);
  }

  pause() { clearTimeout(this._stepTimer); }

  resume() {
    if (!this.banished) this._scheduleStep();
  }

  // ─── Banish (espada de ferro) ─────────────────────────────────────────────

  banish(mapData) {
    if (this.banished) return;
    this.banished = true;
    clearTimeout(this._stepTimer);
    narrate('O Carrasco desaparece numa névoa escura. Mas ele voltará.');

    clearTimeout(this.banishTimer);
    this.banishTimer = setTimeout(() => {
      this.banished = false;
      // Reaparecer em posição aleatória longe do jogador
      const floors = getFloorCells(mapData.grid, mapData.width, mapData.height);
      const far = floors.filter(c => dist(c, this) > 10);
      const pool = far.length > 0 ? far : floors;
      const pos = pool[Math.floor(Math.random() * pool.length)];
      this.x = pos.x;
      this.y = pos.y;
      narrate('Você sente uma presença... O Carrasco voltou.');
      this._scheduleStep();
    }, BANISH_DURATION_MS);
  }

  // ─── Atraso por tocha ────────────────────────────────────────────────────

  delayBy(ms) {
    clearTimeout(this._stepTimer);
    this._stepTimer = setTimeout(() => this._step(), ms);
  }

  // ─── Passo de movimento ───────────────────────────────────────────────────

  _scheduleStep() {
    clearTimeout(this._stepTimer);
    this._stepTimer = setTimeout(() => this._step(), SPECTER_SPEED_MS);
  }

  _step() {
    if (this.banished) return;

    const target = this._target; // { x, y } do jogador — atualizado externamente
    if (!target) { this._scheduleStep(); return; }

    const path = aStar(
      { x: this.x, y: this.y },
      target,
      this.mapData.grid,
      this.mapData.width,
      this.mapData.height
    );

    if (path && path.length > 1) {
      this.x = path[1].x;
      this.y = path[1].y;
    }

    this._updateThreat(target);
    this._scheduleStep();
  }

  // ─── Atualização de ameaça ────────────────────────────────────────────────

  _updateThreat(target) {
    const d = dist(this, target);
    let level;
    if      (d <= 1)  level = 'critical';
    else if (d <= 3)  level = 'near';
    else if (d <= 7)  level = 'far';
    else              level = 'none';

    if (level !== this._lastThreatLevel) {
      setThreatLevel(level);
      this._lastThreatLevel = level;
    }

    // Game over — espectro na mesma célula
    if (d === 0 && this._onGameOver) {
      this.stop();
      this._onGameOver('caught');
    }
  }

  // ─── Interface pública ────────────────────────────────────────────────────

  setTarget(pos) { this._target = pos; }

  getPosition() { return { x: this.x, y: this.y }; }
}

// ─── A* ───────────────────────────────────────────────────────────────────────

function aStar(start, goal, grid, width, height) {
  const key = (p) => `${p.x},${p.y}`;
  const passable = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const c = grid[y][x];
    // Espectro atravessa portas trancadas (é um espectro)
    return c !== CELL.WALL;
  };

  const open = new Map();
  const closed = new Set();
  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();

  const h = (p) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);

  gScore.set(key(start), 0);
  fScore.set(key(start), h(start));
  open.set(key(start), start);

  while (open.size > 0) {
    // Nó com menor fScore
    let current = null;
    let minF = Infinity;
    for (const [k, node] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < minF) { minF = f; current = node; }
    }

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current);
    }

    open.delete(key(current));
    closed.add(key(current));

    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!passable(nx, ny)) continue;
      const neighbor = { x: nx, y: ny };
      const nk = key(neighbor);
      if (closed.has(nk)) continue;

      const tentativeG = (gScore.get(key(current)) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentativeG);
        fScore.set(nk, tentativeG + h(neighbor));
        open.set(nk, neighbor);
      }
    }

    // Limitar profundidade para não travar em mapas grandes
    if (closed.size > 2000) break;
  }

  return null; // sem caminho
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let key = `${current.x},${current.y}`;
  while (cameFrom.has(key)) {
    current = cameFrom.get(key);
    path.unshift(current);
    key = `${current.x},${current.y}`;
  }
  return path;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFloorCells(grid, width, height) {
  const cells = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (grid[y][x] === CELL.FLOOR) cells.push({ x, y });
  return cells;
}

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
