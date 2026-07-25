# Echoes From Below — Design Document v0.1

## Conceito
Escape the room de terror top-down procedural, ambientação fantasia medieval.
Navegação por grid em tempo real, totalmente compatível com NVDA e TalkBack.
Web (HTML/CSS/JS puro), empacotável com Tauri futuramente.

---

## Stack Técnica
| Item           | Decisão                                          |
|----------------|--------------------------------------------------|
| Engine         | HTML/CSS/JS puro — sem frameworks                |
| Empacotamento  | Tauri (futuro)                                   |
| Acessibilidade | ARIA live regions + narração de eventos          |
| Áudio          | Web Audio API (sonar, ambiance, alertas)         |
| Mapa           | Geração procedural por grid                      |
| Persistência   | LocalStorage (saves)                             |

---

## Lore
Um soldado acorda em uma cripta subterrânea sem memória do que aconteceu.
Seus pertences sumiram — uma espada de bronze e uma lanterna a óleo.
Explorando, encontra relatos de outros aventureiros sobre um espectro:
um carrasco que vaga pelo local. O objetivo é encontrar 3 chaves e escapar.

---

## Geração Procedural do Mapa
- Grid de células (ex: 20×20)
- Algoritmo BSP (Binary Space Partitioning) — salas conectadas por corredores
- Cada run gera posições aleatórias para:
  - Ponto inicial do jogador
  - Saída (sempre bloqueada por 3 trancas)
  - 3 chaves
  - Alavancas e portas internas
  - Puzzles de runas
  - Itens (tocha, corda, relatos, espadas)
  - Ponto inicial do espectro

---

## Personagem — O Soldado
Sem nome definido. Acorda sem equipamentos.

### Itens encontráveis
| Item               | Efeito                                                              |
|--------------------|---------------------------------------------------------------------|
| Espada de bronze   | Sem efeito no espectro. Item de lore. Jogador não sabe disso.       |
| Espada de ferro    | Arremessada contra o espectro → banish temporário + respawn aleatório. Cai no chão e pode ser recuperada. Única no mapa. |
| Tocha apagada      | Acende em fogueira → deixada num corredor atrasa o espectro N segundos |
| Corda/correntes    | Barrica uma porta — espectro desvia de rota                         |
| Fragmento de relato| Lore + dicas de puzzles                                             |
| Chave              | Destranca uma das 3 trancas da saída                                |

---

## O Espectro — O Carrasco
- Perseguidor em tempo real, não derrotável permanentemente
- Pathfinding A* no grid
- **Banish:** espada de ferro arremessada → desaparece por intervalo curto → reaparece em ponto aleatório do mapa
- A espada cai no chão após o arremesso e pode ser recuperada (risco/recompensa)

### Sistema de Proximidade (ARIA + Áudio)
| Distância   | Narração ARIA                                  | Áudio                    |
|-------------|------------------------------------------------|--------------------------|
| Longe       | Silêncio                                       | Ambiance normal          |
| Médio       | "Você ouve passos arrastados ao longe."        | Som distante             |
| Perto       | "O Carrasco está próximo. Corra."              | Som intenso              |
| Crítico     | "Ele está aqui."                               | Stinger + game over      |

---

## Puzzles e Portas Internas
O jogo **pausa** (espectro congela) ao abrir:
- Inventário (tecla I)
- Painel de exame de item
- Painel de puzzle (runas, combinação, relato)

Para todo o resto, o tempo corre normalmente.

### Tipos de Puzzle
- **Alavanca simples:** pressione Enter para puxar
- **Runas:** ouvir sequência → reproduzir na ordem correta
- **Relato cifrado:** texto de explorador morto contém dica → aplicar num objeto próximo
- **Combinação de itens:** ex. corda + gancho = acesso a corredor bloqueado

---

## Controles
| Ação                        | Tecla         |
|-----------------------------|---------------|
| Mover                       | Setas / WASD  |
| Interagir / Confirmar       | Enter / Espaço|
| Inventário                  | I             |
| Mapa textual                | M             |
| Status (onde estou)         | S             |
| Pausa manual                | Esc           |

---

## Acessibilidade
- ARIA live regions narram automaticamente: célula atual, objetos, saídas, alertas
- Mapa textual (tecla M): lista salas visitadas, conexões, itens encontrados
- Cada célula tem `aria-label` descritivo: "Corredor norte. Saídas: norte, leste. Item: tocha apagada."
- Pausa automática ao abrir qualquer painel (inventário, puzzle, exame)
- Totalmente operável por teclado — sem necessidade de mouse

---

## Estrutura de Arquivos
```
echoes-from-below/
├── index.html
├── style.css
├── src/
│   ├── main.js       # Loop principal e estado global
│   ├── map.js        # Geração procedural (BSP + flood fill)
│   ├── player.js     # Movimento, inventário, interação
│   ├── specter.js    # IA do espectro, pathfinding A*
│   ├── puzzles.js    # Lógica dos puzzles e portas
│   ├── audio.js      # Web Audio API, sonar, ambiance
│   ├── aria.js       # Narração e live regions
│   └── lore.js       # Textos dos relatos e fragmentos
├── assets/
│   ├── audio/
│   └── sprites/
├── DESIGN.md
└── tauri.conf.json   # (futuro)
```

---

## Roadmap de Protótipos
1. **Proto 1:** Grid navegável com ARIA — movimento, narração de célula, sem espectro
2. **Proto 2:** Espectro com pathfinding básico e alertas sonoros/ARIA
3. **Proto 3:** Geração procedural do mapa (BSP)
4. **Proto 4:** Puzzles, chaves e sistema de saída
5. **Proto 5:** Itens, inventário, espadas e mecânica de banish
6. **Proto 6:** Áudio completo (Web Audio API, sonar, ambiance)
7. **Proto 7:** Lore, relatos e polish final
