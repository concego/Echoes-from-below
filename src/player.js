/**
 * player.js — Estado e movimento do jogador
 * Echoes From Below
 */

import { describeCell, announce, narrate } from './aria.js';
import { CELL } from './map.js';

export const ITEM_NAMES = {
  espada_bronze:  'Espada de Bronze',
  espada_ferro:   'Espada de Ferro',
  tocha_apagada:  'Tocha Apagada',
  tocha_acesa:    'Tocha Acesa',
  corda:          'Corda',
  relato_1:       'Fragmento de Relato I',
  relato_2:       'Fragmento de Relato II',
  relato_3:       'Fragmento de Relato III',
  relato_4:       'Fragmento de Relato IV',
  relato_5:       'Fragmento de Relato V',
  chave:          'Chave da Cripta',
};

export class Player {
  constructor(startPos) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.inventory = [];
    this.keysCollected = 0;
    this.visitedCells = new Set();
    this.visitedCellData = [];
    this._markVisited(startPos.x, startPos.y);
  }

  // ─── Movimento ───────────────────────────────────────────────────────────────

  /**
   * Tenta mover o jogador na direção dada.
   * @param {'north'|'south'|'east'|'west'} dir
   * @param {object} mapData — retorno de generateMap()
   * @param {Function} onCellEnter — callback(cell) após mover
   * @returns {boolean} se moveu
   */
  move(dir, mapData, onCellEnter) {
    const { grid, width, height } = mapData;
    let nx = this.x, ny = this.y;

    if (dir === 'north') ny--;
    if (dir === 'south') ny++;
    if (dir === 'east')  nx++;
    if (dir === 'west')  nx--;

    // Limites
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;

    const cell = grid[ny][nx];

    // Paredes e portas bloqueadas
    if (cell === CELL.WALL) return false;
    if (cell === CELL.DOOR_LOCKED || cell === CELL.PUZZLE_DOOR) {
      announce('Uma passagem bloqueada. Interaja para investigar.');
      return false;
    }

    this.x = nx;
    this.y = ny;
    this._markVisited(nx, ny);

    if (onCellEnter) onCellEnter({ x: nx, y: ny, cellType: cell });
    return true;
  }

  // ─── Inventário ──────────────────────────────────────────────────────────────

  addItem(itemId) {
    this.inventory.push(itemId);
    announce(`Você pegou: ${ITEM_NAMES[itemId] ?? itemId}.`);
    this._updateHud();
  }

  removeItem(itemId) {
    const idx = this.inventory.indexOf(itemId);
    if (idx !== -1) this.inventory.splice(idx, 1);
    this._updateHud();
  }

  hasItem(itemId) {
    return this.inventory.includes(itemId);
  }

  collectKey() {
    this.keysCollected++;
    narrate(`Chave encontrada! Você tem ${this.keysCollected} de 3.`);
    this._updateHud();
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  getStatusText() {
    const items = this.inventory.length > 0
      ? this.inventory.map(i => ITEM_NAMES[i] ?? i).join(', ')
      : 'nenhum';
    return `Posição: (${this.x}, ${this.y}). Chaves: ${this.keysCollected}/3. Itens: ${items}.`;
  }

  // ─── Privado ─────────────────────────────────────────────────────────────────

  _markVisited(x, y) {
    const key = `${x},${y}`;
    this.visitedCells.add(key);
  }

  _updateHud() {
    const keyEl  = document.getElementById('key-count');
    const itemEl = document.getElementById('item-count');
    if (keyEl)  keyEl.textContent  = this.keysCollected;
    if (itemEl) itemEl.textContent = this.inventory.length;
  }
}
