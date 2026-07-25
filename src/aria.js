/**
 * aria.js — Narração e live regions para NVDA/TalkBack
 * Echoes From Below
 */

const narratorEl = document.getElementById('aria-narrator');
const statusEl   = document.getElementById('aria-status');
const threatEl   = document.getElementById('hud-threat');

/**
 * Narração imediata (assertive) — interrompe o leitor de tela.
 * Use para eventos críticos: perigo, game over, ação importante.
 */
export function narrate(text) {
  // Forçar re-leitura mesmo que o texto seja igual ao anterior
  narratorEl.textContent = '';
  requestAnimationFrame(() => { narratorEl.textContent = text; });
}

/**
 * Narração polida (polite) — espera o leitor de tela terminar.
 * Use para: descrição de célula, itens encontrados, status geral.
 */
export function announce(text) {
  statusEl.textContent = '';
  requestAnimationFrame(() => { statusEl.textContent = text; });
}

/**
 * Atualiza o indicador de ameaça no HUD.
 * @param {'none'|'far'|'near'|'critical'} level
 */
export function setThreatLevel(level) {
  const messages = {
    none:     '',
    far:      '⚠ Você ouve passos arrastados ao longe.',
    near:     '⚠⚠ O Carrasco está próximo. Corra.',
    critical: '⚠⚠⚠ Ele está aqui.',
  };
  const text = messages[level] ?? '';
  threatEl.textContent = text;

  // Nível crítico: narração assertiva para interromper qualquer coisa
  if (level === 'critical') narrate(text);
  else if (level === 'near') announce(text);
}

/**
 * Descreve a célula atual para o leitor de tela.
 * Chamado sempre que o jogador se move.
 */
export function describeCell(cell) {
  const el = document.getElementById('cell-description');
  if (!el) return;

  const parts = [];

  // Tipo do local
  const roomNames = {
    floor:       'Corredor',
    chamber:     'Câmara',
    entrance:    'Entrada',
    exit:        'Saída',
  };
  parts.push(roomNames[cell.roomType] ?? 'Corredor');

  // Saídas disponíveis
  const exits = [];
  if (cell.exits.north) exits.push('norte');
  if (cell.exits.south) exits.push('sul');
  if (cell.exits.east)  exits.push('leste');
  if (cell.exits.west)  exits.push('oeste');
  if (exits.length > 0) parts.push(`Saídas: ${exits.join(', ')}.`);
  else parts.push('Beco sem saída.');

  // Itens / objetos na célula
  if (cell.items && cell.items.length > 0) {
    parts.push(`Você vê: ${cell.items.join(', ')}.`);
  }

  // Porta / alavanca
  if (cell.door === 'locked')  parts.push('Uma porta trancada bloqueia a passagem.');
  if (cell.door === 'open')    parts.push('Uma porta aberta.');
  if (cell.lever)              parts.push('Há uma alavanca aqui.');
  if (cell.puzzle)             parts.push('Há runas gravadas numa porta à sua frente.');

  const description = parts.join(' ');
  el.textContent = description;
  announce(description);
}

/**
 * Descreve o mapa visitado (tecla M).
 * Retorna texto para exibir no painel.
 */
export function buildMapDescription(visitedCells) {
  if (!visitedCells || visitedCells.length === 0) {
    return 'Você ainda não explorou nenhuma área.';
  }

  const lines = ['Áreas exploradas:'];
  for (const cell of visitedCells) {
    const exits = Object.entries(cell.exits)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    const items = cell.items?.length > 0 ? ` | Itens: ${cell.items.join(', ')}` : '';
    lines.push(`- (${cell.x},${cell.y}) ${cell.roomType} | Saídas: ${exits || 'nenhuma'}${items}`);
  }
  return lines.join('\n');
}
