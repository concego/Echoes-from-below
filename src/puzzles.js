/**
 * puzzles.js — Lógica de puzzles e alavancas
 * Echoes From Below
 */

import { narrate, announce } from './aria.js';
import { CELL } from './map.js';

// ─── Alavancas ────────────────────────────────────────────────────────────────

/**
 * Ativa uma alavanca, destrancando a porta alvo.
 */
export function activateLever(lever, mapData, onUpdate) {
  const { grid } = mapData;
  const door = lever.targetDoor;

  if (grid[door.y][door.x] === CELL.DOOR_OPEN) {
    announce('Esta alavanca já foi ativada. A porta está aberta.');
    return;
  }

  grid[door.y][door.x] = CELL.DOOR_OPEN;
  narrate('A alavanca range. Você ouve o som de uma tranca se abrindo ao longe.');
  if (onUpdate) onUpdate();
}

// ─── Puzzle de Runas ──────────────────────────────────────────────────────────

const RUNE_LABELS = {
  fogo:   'Runa do Fogo 🔥',
  água:   'Runa da Água 💧',
  terra:  'Runa da Terra 🌿',
  vento:  'Runa do Vento 💨',
  sombra: 'Runa da Sombra 🌑',
  luz:    'Runa da Luz ✨',
};

/**
 * Constrói e exibe o painel de puzzle de runas.
 * @param {object} puzzleDoor — { x, y, sequence: ['fogo','água','terra'] }
 * @param {Function} onSolve — callback quando resolvido
 * @param {Function} onClose — callback quando fechado sem resolver
 */
export function openRunePuzzle(puzzleDoor, mapData, onSolve, onClose) {
  const panel = document.getElementById('panel-overlay');
  const content = document.getElementById('panel-content');
  if (!panel || !content) return;

  const sequence = puzzleDoor.sequence;
  const playerSequence = [];

  // ── Montar HTML acessível ──
  content.innerHTML = `
    <h2 id="puzzle-title">Porta com Runas</h2>
    <p id="puzzle-desc">
      Há três runas gravadas na pedra. Você precisa reproduzir a sequência correta para abrir a porta.
    </p>

    <!-- Dica: sequência lida de um relato (se o jogador tiver encontrado) -->
    <p id="puzzle-hint" aria-live="polite"></p>

    <!-- Sequência do jogador -->
    <p id="puzzle-progress" aria-live="polite">
      Sequência inserida: <span id="seq-display">nenhuma</span>
    </p>

    <!-- Botões das runas -->
    <fieldset>
      <legend>Escolha a runa (${sequence.length} no total):</legend>
      <div id="rune-buttons" role="group" aria-label="Runas disponíveis">
        ${sequence.map(r =>
          `<button class="rune-btn" data-rune="${r}" aria-label="${RUNE_LABELS[r] ?? r}">
            ${RUNE_LABELS[r] ?? r}
          </button>`
        ).join('')}
      </div>
    </fieldset>

    <button id="puzzle-reset" aria-label="Limpar sequência e tentar novamente">Limpar</button>
    <p id="puzzle-feedback" aria-live="assertive"></p>
  `;

  // ── Lógica dos botões ──
  content.querySelectorAll('.rune-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rune = btn.dataset.rune;
      playerSequence.push(rune);

      const display = document.getElementById('seq-display');
      if (display) display.textContent = playerSequence.map(r => RUNE_LABELS[r] ?? r).join(', ');

      if (playerSequence.length === sequence.length) {
        checkRuneSequence(playerSequence, sequence, puzzleDoor, mapData, onSolve, onClose);
      }
    });
  });

  content.querySelector('#puzzle-reset')?.addEventListener('click', () => {
    playerSequence.length = 0;
    const display = document.getElementById('seq-display');
    if (display) display.textContent = 'nenhuma';
    announce('Sequência limpa. Tente novamente.');
  });

  // ── Exibir painel ──
  showPanel(panel, content, onClose);
}

function checkRuneSequence(playerSeq, correctSeq, puzzleDoor, mapData, onSolve, onClose) {
  const feedback = document.getElementById('puzzle-feedback');
  const correct = playerSeq.every((r, i) => r === correctSeq[i]);

  if (correct) {
    mapData.grid[puzzleDoor.y][puzzleDoor.x] = CELL.DOOR_OPEN;
    narrate('As runas brilham. A pedra range e a passagem se abre.');
    closePanel(document.getElementById('panel-overlay'));
    if (onSolve) onSolve();
  } else {
    if (feedback) feedback.textContent = 'A sequência está errada. As runas se apagam.';
    playerSeq.length = 0;
    const display = document.getElementById('seq-display');
    if (display) display.textContent = 'nenhuma';
  }
}

// ─── Painel de Inventário ─────────────────────────────────────────────────────

export function openInventory(player, onUseItem, onClose) {
  const panel = document.getElementById('panel-overlay');
  const content = document.getElementById('panel-content');
  if (!panel || !content) return;

  const { ITEM_NAMES } = player.constructor ? {} : {};

  content.innerHTML = `
    <h2>Inventário</h2>
    ${player.inventory.length === 0
      ? '<p>Você não carrega nada.</p>'
      : `<ul id="inv-list" role="list">
          ${player.inventory.map(item =>
            `<li>
              <span>${item}</span>
              <button data-item="${item}" aria-label="Usar ${item}">Usar</button>
              <button data-item="${item}" class="examine-btn" aria-label="Examinar ${item}">Examinar</button>
            </li>`
          ).join('')}
        </ul>`
    }
  `;

  content.querySelectorAll('button[data-item]:not(.examine-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      closePanel(panel);
      if (onUseItem) onUseItem(btn.dataset.item);
    });
  });

  content.querySelectorAll('.examine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      announce(getItemDescription(btn.dataset.item));
    });
  });

  showPanel(panel, content, onClose);
}

// ─── Painel de Mapa Textual ───────────────────────────────────────────────────

export function openMapPanel(mapDescription, onClose) {
  const panel = document.getElementById('panel-overlay');
  const content = document.getElementById('panel-content');
  if (!panel || !content) return;

  content.innerHTML = `
    <h2>Mapa da Cripta (áreas exploradas)</h2>
    <pre id="map-text" tabindex="0" aria-label="Descrição textual do mapa">${mapDescription}</pre>
  `;

  showPanel(panel, content, onClose);
}

// ─── Painel de Relato de Lore ─────────────────────────────────────────────────

export function openLorePanel(loreText, onClose) {
  const panel = document.getElementById('panel-overlay');
  const content = document.getElementById('panel-content');
  if (!panel || !content) return;

  content.innerHTML = `
    <h2>Fragmento de Relato</h2>
    <p tabindex="0">${loreText}</p>
  `;

  showPanel(panel, content, onClose);
}

// ─── Helpers de painel ────────────────────────────────────────────────────────

export function showPanel(panel, content, onClose) {
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
  content.focus();

  const closeBtn = document.getElementById('panel-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      closePanel(panel);
      if (onClose) onClose();
    };
  }
}

export function closePanel(panel) {
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
}

function getItemDescription(itemId) {
  const descriptions = {
    espada_bronze:  'Uma espada de bronze com gravuras antigas. Parece ser sua — mas de que te vale contra uma sombra?',
    espada_ferro:   'Uma espada de ferro enferrujada. A lâmina ainda corta. Pode ser arremessada para dispersar o Carrasco.',
    tocha_apagada:  'Uma tocha de madeira. Precisa de fogo para acender. Pode atrasar o Carrasco se deixada num corredor.',
    tocha_acesa:    'A tocha está acesa. Sua luz fraca ilumina poucos passos à frente.',
    corda:          'Uma corda resistente. Pode ser usada para barricar uma porta.',
    chave:          'Uma chave de ferro pesada. Uma das três que abrem a saída.',
    relato_1:       'Escrito numa parede: "Não corra em linha reta. Ele aprende seus caminhos."',
    relato_2:       'Rasgado de um diário: "A tocha o repele. O fogo lembra algo que ele perdeu."',
    relato_3:       'Gravado numa pedra: "A sequência das runas muda a cada morte. Ouça os ecos."',
    relato_4:       'Inscrito com sangue: "A espada de ferro o bane. Mas ele sempre volta. Sempre."',
    relato_5:       'Escrito apressado: "Três chaves. Três trancas. A saída fica ao norte — ou ao sul. Nunca sei mais."',
  };
  return descriptions[itemId] ?? 'Você examina o item, mas não encontra nada de especial.';
}
