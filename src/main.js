/**
 * main.js — Loop principal do jogo
 * Echoes From Below
 */

import { generateMap, CELL } from './map.js';
import { Player, ITEM_NAMES } from './player.js';
import { Specter } from './specter.js';
import { narrate, announce, describeCell, buildMapDescription } from './aria.js';
import {
  openInventory, openRunePuzzle, openMapPanel,
  openLorePanel, closePanel
} from './puzzles.js';

// ─── Estado global ────────────────────────────────────────────────────────────

let gameState = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover' | 'victory'
let mapData   = null;
let player    = null;
let specter   = null;

let cellItems   = {};
let cellLevers  = {};
let cellPuzzles = {};
let cellKeys    = {};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-game')?.addEventListener('click', startNewGame);
  document.getElementById('btn-restart')?.addEventListener('click', startNewGame);
  document.getElementById('btn-play-again')?.addEventListener('click', startNewGame);
  document.getElementById('btn-menu-go')?.addEventListener('click', goToMenu);
  document.getElementById('btn-menu-win')?.addEventListener('click', goToMenu);
  document.addEventListener('keydown', handleKeyDown);
});

// ─── Telas ────────────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    target.setAttribute('aria-hidden', 'false');
    const first = target.querySelector('button, [tabindex="0"], input');
    if (first) first.focus();
  }
}

function goToMenu() {
  stopGame();
  gameState = 'menu';
  showScreen('screen-menu');
}

// ─── Novo Jogo ────────────────────────────────────────────────────────────────

function startNewGame() {
  stopGame();

  const seed = Date.now();
  mapData = generateMap(seed);

  cellItems = {}; cellLevers = {}; cellPuzzles = {}; cellKeys = {};

  for (const item of mapData.items) {
    const k = `${item.x},${item.y}`;
    if (!cellItems[k]) cellItems[k] = [];
    cellItems[k].push(item.item);
  }
  for (const lever of mapData.levers)      cellLevers[`${lever.x},${lever.y}`] = lever;
  for (const pd of mapData.puzzleDoors)    cellPuzzles[`${pd.x},${pd.y}`] = pd;
  for (const key of mapData.keys)          cellKeys[`${key.x},${key.y}`] = true;

  player  = new Player(mapData.startPos);
  specter = new Specter(mapData.spectreStart, mapData);

  gameState = 'playing';
  showScreen('screen-game');
  renderMap();
  describeCurrentCell();

  specter.setTarget(player);
  specter.start(handleGameOver);

  narrate('Você acorda na escuridão. Seus pertences sumiram. Encontre as três chaves e escape.');
}

function stopGame() {
  specter?.stop();
  specter = null; player = null; mapData = null;
}

// ─── Input ────────────────────────────────────────────────────────────────────

function handleKeyDown(e) {
  if (gameState === 'paused') {
    if (e.key === 'Escape') resumeFromPanel();
    return;
  }
  if (gameState !== 'playing') return;

  const dirMap = {
    ArrowUp: 'north', ArrowDown: 'south', ArrowRight: 'east', ArrowLeft: 'west',
    w: 'north', W: 'north', s: 'south', S: 'south',
    d: 'east',  D: 'east',  a: 'west',  A: 'west',
  };

  if (dirMap[e.key]) {
    e.preventDefault();
    const moved = player.move(dirMap[e.key], mapData, onCellEnter);
    if (moved) { specter.setTarget(player); renderMap(); describeCurrentCell(); }
    return;
  }

  switch (e.key) {
    case 'Enter': case ' ':
      e.preventDefault(); interact(); break;
    case 'i': case 'I':
      e.preventDefault(); openInventoryPanel(); break;
    case 'm': case 'M':
      e.preventDefault(); openMapTextPanel(); break;
    case 'Escape':
      e.preventDefault(); pauseForPanel(); break;
  }
}

// ─── Interação ────────────────────────────────────────────────────────────────

function interact() {
  const k = `${player.x},${player.y}`;

  if (cellKeys[k]) {
    delete cellKeys[k];
    player.collectKey();
    renderMap(); checkVictory(); return;
  }

  if (cellItems[k]?.length > 0) {
    const itemId = cellItems[k].shift();
    if (!cellItems[k].length) delete cellItems[k];
    player.addItem(itemId);
    if (itemId.startsWith('relato_')) {
      pauseForPanel();
      openLorePanel(getLoreText(itemId), resumeFromPanel);
    }
    renderMap(); return;
  }

  if (cellLevers[k]) {
    mapData.grid[cellLevers[k].targetDoor.y][cellLevers[k].targetDoor.x] = CELL.DOOR_OPEN;
    narrate('A alavanca range. Uma porta se abre ao longe.');
    delete cellLevers[k];
    renderMap(); return;
  }

  if (cellPuzzles[k]) {
    pauseForPanel();
    openRunePuzzle(cellPuzzles[k], mapData,
      () => { delete cellPuzzles[k]; resumeFromPanel(); renderMap(); },
      resumeFromPanel
    ); return;
  }

  announce('Não há nada de especial aqui.');
}

function onCellEnter({ x, y, cellType }) {
  const k = `${x},${y}`;
  if (cellKeys[k]) {
    delete cellKeys[k]; player.collectKey(); renderMap(); checkVictory();
  }
  if (cellType === CELL.EXIT) {
    if (player.keysCollected >= 3) triggerVictory();
    else announce(`A saída está trancada. Você tem ${player.keysCollected} de 3 chaves.`);
  }
}

// ─── Inventário ───────────────────────────────────────────────────────────────

function openInventoryPanel() {
  pauseForPanel();
  openInventory(player, (itemId) => { useItem(itemId); resumeFromPanel(); }, resumeFromPanel);
}

function useItem(itemId) {
  switch (itemId) {
    case 'espada_ferro':
      if (!specter.banished) {
        player.removeItem('espada_ferro');
        specter.banish(mapData);
        const k = `${player.x},${player.y}`;
        if (!cellItems[k]) cellItems[k] = [];
        cellItems[k].push('espada_ferro');
        announce('Você arremessa a espada. Ela cai no chão. O Carrasco desaparece.');
        renderMap();
      } else {
        announce('O Carrasco já foi banido. Aguarde ele retornar.');
      }
      break;
    case 'tocha_acesa':
      player.removeItem('tocha_acesa');
      const kt = `${player.x},${player.y}`;
      if (!cellItems[kt]) cellItems[kt] = [];
      cellItems[kt].push('tocha_acesa');
      specter.delayBy(5000);
      narrate('Você deposita a tocha. O Carrasco recua por um momento.');
      renderMap();
      break;
    case 'tocha_apagada':
      announce('A tocha está apagada. Encontre uma fogueira para acendê-la.');
      break;
    default:
      announce('Você não sabe como usar isso agora.');
  }
}

// ─── Mapa textual ─────────────────────────────────────────────────────────────

function openMapTextPanel() {
  pauseForPanel();
  const visited = [...player.visitedCells].map(k => {
    const [x, y] = k.split(',').map(Number);
    const g = mapData.grid;
    const exits = {
      north: g[y-1]?.[x] !== undefined && g[y-1][x] !== CELL.WALL,
      south: g[y+1]?.[x] !== undefined && g[y+1][x] !== CELL.WALL,
      east:  g[y]?.[x+1] !== undefined && g[y][x+1] !== CELL.WALL,
      west:  g[y]?.[x-1] !== undefined && g[y][x-1] !== CELL.WALL,
    };
    return { x, y, roomType: 'floor', exits, items: cellItems[k] ?? [] };
  });
  openMapPanel(buildMapDescription(visited), resumeFromPanel);
}

// ─── Pausa / retomada ─────────────────────────────────────────────────────────

function pauseForPanel() {
  gameState = 'paused';
  specter?.pause();
}

function resumeFromPanel() {
  closePanel(document.getElementById('panel-overlay'));
  gameState = 'playing';
  specter?.resume();
}

// ─── Descrição ARIA da célula atual ──────────────────────────────────────────

function describeCurrentCell() {
  const { x, y } = player;
  const g = mapData.grid;
  const k = `${x},${y}`;
  const exits = {
    north: g[y-1]?.[x] !== undefined && g[y-1][x] !== CELL.WALL,
    south: g[y+1]?.[x] !== undefined && g[y+1][x] !== CELL.WALL,
    east:  g[y]?.[x+1] !== undefined && g[y][x+1] !== CELL.WALL,
    west:  g[y]?.[x-1] !== undefined && g[y][x-1] !== CELL.WALL,
  };
  const items = [...(cellItems[k] ?? [])];
  if (cellKeys[k]) items.push('chave');
  const cellType = g[y][x];
  const roomType = cellType === CELL.EXIT ? 'exit' : 'floor';

  describeCell({
    x, y, roomType, exits,
    items: items.map(i => ITEM_NAMES[i] ?? i),
    door: cellPuzzles[k] ? 'locked' : undefined,
    lever: !!cellLevers[k],
    puzzle: !!cellPuzzles[k],
  });
}

// ─── Renderização visual ──────────────────────────────────────────────────────

function renderMap() {
  const grid = document.getElementById('map-grid');
  if (!grid || !mapData) return;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${mapData.width}, 1fr)`;

  for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const k = `${x},${y}`;
      const visited = player.visitedCells.has(k);

      if (x === player.x && y === player.y) {
        cell.classList.add('player'); cell.textContent = '@';
      } else if (!specter.banished && x === specter.x && y === specter.y && visited) {
        cell.classList.add('specter'); cell.textContent = '☠';
      } else if (!visited) {
        cell.classList.add('unknown');
      } else {
        switch (mapData.grid[y][x]) {
          case CELL.WALL:        cell.classList.add('wall'); break;
          case CELL.FLOOR:
            cell.classList.add('floor');
            if (cellKeys[k])            cell.textContent = '🗝';
            else if (cellItems[k]?.length) cell.textContent = '!';
            else if (cellLevers[k])     cell.textContent = 'L';
            break;
          case CELL.DOOR_LOCKED: cell.classList.add('door-locked'); cell.textContent = '🔒'; break;
          case CELL.DOOR_OPEN:   cell.classList.add('door-open');   cell.textContent = '▭';  break;
          case CELL.PUZZLE_DOOR: cell.classList.add('puzzle-door'); cell.textContent = '?';  break;
          case CELL.EXIT:        cell.classList.add('exit');        cell.textContent = '⬆'; break;
        }
      }
      grid.appendChild(cell);
    }
  }
}

// ─── Vitória / Derrota ────────────────────────────────────────────────────────

function checkVictory() {
  if (player.keysCollected >= 3 && mapData.grid[player.y][player.x] === CELL.EXIT) triggerVictory();
}

function triggerVictory() {
  stopGame(); gameState = 'victory';
  const msg = document.getElementById('victory-msg');
  if (msg) msg.textContent = 'A luz do dia queima seus olhos. Você nunca mais voltará àquele lugar.';
  narrate('Você escapou da cripta. Vitória.');
  showScreen('screen-victory');
}

function handleGameOver(reason) {
  stopGame(); gameState = 'gameover';
  const msg = document.getElementById('gameover-msg');
  if (msg) msg.textContent = reason === 'caught'
    ? 'O Carrasco passou sua mão fria pelo seu pescoço. A escuridão te consumiu.'
    : 'Você não resistiu.';
  narrate('O Carrasco te encontrou. Fim de jogo.');
  showScreen('screen-gameover');
}

// ─── Lore ─────────────────────────────────────────────────────────────────────

function getLoreText(itemId) {
  const lore = {
    relato_1: '"Não corra em linha reta. Ele aprende seus caminhos."',
    relato_2: '"A tocha o repele. O fogo lembra algo que ele perdeu."',
    relato_3: '"A sequência das runas muda a cada morte. Ouça os ecos."',
    relato_4: '"A espada de ferro o bane. Mas ele sempre volta. Sempre."',
    relato_5: '"Três chaves. Três trancas. A saída fica ao norte — ou ao sul. Nunca sei mais."',
  };
  return lore[itemId] ?? 'O texto está apagado demais para ser lido.';
}
