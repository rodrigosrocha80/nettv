# Relatório de Qualidade, Desempenho e Segurança — NetTV (Fase 7)

**Data:** 2026-11-16  
**Versão:** 0.1.0  
**Target mínimo:** Samsung Tizen 4.0 / Chromium M56 (TVs 2018+)

---

## 1. Resumo de Testes Automatizados

| Suíte | Arquivos | Testes | Resultado | Tempo de Execução |
|---|---|---|---|---|
| `vitest run` (Total) | 12 | 37 | **37/37 passaram** | `1.95 s` (testes) |
| `tsc --noEmit` (`type-check`) | — | — | **0 erros** | — |
| `eslint .` (`lint`) | — | — | **0 erros** | — |
| `npm audit --omit=dev` | 8 deps prod | — | **0 vulnerabilidades** | — |

### Cobertura por Área
- **Parsers & Workers:** M3U (pequeno, corrompido e **50.000 itens em ~596 ms**), XMLTV (fusos horários, CDATA, janela configurável).
- **Persistência & Busca:** IndexedDB (`fake-indexeddb`) com **5.000 itens** gravados e buscados por prefixo/substring, EPG atual/próximo, *stale-while-revalidate* e persistência de perfis/fontes/favoritos/histórico.
- **Resiliência:** TV sem internet ao abrir (cache local), HTTP 500/401 sem vazamento de credenciais, recuperação automática de `QuotaExceededError` via expurgo de EPG expirado.
- **Player:** detecção de formato, seleção de engine, legendas SRT/VTT, retry com backoff exponencial (`1s → 2s → 4s`), **zapping de 100 trocas de canal** sem vazamento e autoplay de próximo episódio.
- **UI & Navegação Remota:** Design System (1920x1080, focus trap, teclado virtual), telas da Fase 6 e fluxo E2E de `Onboarding` + tecla `Back` (`Escape`).

---

## 2. Métricas de Bundle e Otimização

Build de produção (`tsc -b && vite build` com `@vitejs/plugin-legacy`, `sourcemap: false`):

- **Chunk principal (`index`):** `116.05 kB` (`36.44 kB` gzip) / legado `126.66 kB` (`37.75 kB` gzip).
- **Vendor React:** `141.42 kB` (`45.36 kB` gzip).
- **Vendor i18n:** `57.70 kB` (`18.68 kB` gzip).
- **Vendor Misc:** `59.15 kB` (`19.13 kB` gzip).
- **Player HLS (`vendor-hls`, lazy):** `609.10 kB` (`187.48 kB` gzip) — carregado sob demanda apenas ao abrir o `PlayerViewport`.
- **Web Workers:** `m3u.worker` (`3.96 kB`) e `xmltv.worker` (`2.79 kB`).
- **Imagens:** `loading="lazy"` e `decoding="async"` aplicados em `MediaCard`.

---

## 3. Segurança e Privacidade (LGPD)

- **Armazenamento local:** credenciais de fontes e PIN parental (SHA-256) armazenados apenas localmente no dispositivo.
- **Logs sanitizados:** `sanitizeUrl` mascara usuário, senha, query strings e credenciais de path Xtream antes de registrar em `diagnostics.ts` ou mensagens de erro.
- **Telemetria opt-in:** desativada por padrão (`telemetryEnabled: false`), controlável em **Configurações**.
- **Direito à exclusão:** botão **"Apagar todos os dados"** em Configurações limpa todas as stores do IndexedDB e stores em memória.
- **Licenças de terceiros:** registradas em [THIRD_PARTY_LICENSES](file:///f:/projeto/NetTV/THIRD_PARTY_LICENSES) (todas `MIT`, `Apache-2.0` ou `ISC`).

---

## 4. Bugs Conhecidos & Pendências de Hardware (TV Real / Emulador)

| Severidade | Item | Status |
|---|---|---|
| **Crítico / Alto (Código)** | — | **0 abertos** |
| **A Validar (Hardware)** | Tempo de abertura (`< 5 s`), primeiro frame, uso de memória (PMS) em 2h contínuas e FPS em rolagem no emulador/TV real | Pendente para validação em dispositivo na Fase 8 |
| **Baixo (Build)** | Aviso do Rollup sobre dependência circular entre `vendor-misc` e `vendor-react` e tamanho do chunk lazy `vendor-hls` (`> 500 kB` minificado, `187 kB` gzip) | Sem impacto funcional; `vendor-hls` já é carregado sob demanda |
