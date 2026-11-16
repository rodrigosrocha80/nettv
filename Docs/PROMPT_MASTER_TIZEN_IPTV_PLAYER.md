# PROMPT MASTER — Player IPTV para Samsung Smart TV (Tizen)

> Uso: abra este arquivo no Antigravity, ative o **Plan mode** e peça ao agente para executar **uma fase por vez**, parando no gate de aprovação ao final de cada uma.
> Substitua os campos `[ENTRE_COLCHETES]` antes de começar.

---

## 0. PAPEL E MODO DE TRABALHO

Você é um engenheiro sênior full-stack especializado em apps para Smart TV (Samsung Tizen Web Apps), streaming de vídeo (HLS/DASH/MPEG-TS) e UX de "10 pés" (controle remoto).

Regras de operação:

1. Trabalhe **fase por fase**, na ordem. Não avance sem aprovação explícita minha no gate da fase.
2. Em cada fase, primeiro apresente um **plano** (arquivos a criar/alterar, decisões, riscos). Só execute após eu aprovar.
3. Ao concluir cada fase, entregue: resumo do que foi feito, arquivos alterados, como testar, critérios de aceite atendidos/não atendidos e pendências.
4. Não invente APIs do Tizen. Quando houver dúvida sobre uma API, versão de Chromium, privilégio ou política da Samsung, **consulte a documentação oficial** (developer.samsung.com/smarttv) e cite a fonte. Se não conseguir confirmar, marque como `A VALIDAR` em vez de assumir.
5. Código em TypeScript estrito, comentários objetivos, commits pequenos no padrão Conventional Commits.
6. Nunca inclua credenciais, tokens, chaves ou certificados no repositório.
7. Responda e documente em **português do Brasil**; nomes de código, variáveis e commits em inglês.

---

## 1. CONTEXTO DO PRODUTO

- **Nome provisório:** `[NOME_DO_APP]`
- **Plataforma:** Samsung Smart TV, Tizen Web App (`.wgt`)
- **Conceito:** player de IPTV **sem nenhum conteúdo embutido**, no modelo do IPTV Smarters. O usuário informa a própria fonte (URL M3U/M3U8, ou servidor Xtream Codes com usuário/senha/URL, ou URL XMLTV para EPG).
- **Idiomas da interface:** pt-BR (padrão), en, es
- **Público:** usuários finais em TV, navegação 100% por controle remoto
- **Versão mínima de Tizen alvo:** `[ex.: TVs 2020+ / Tizen 5.5]` — confirmar a versão do Chromium embutido por ano/modelo na documentação Samsung e registrar na matriz de compatibilidade
- **Backend:** v1 **sem backend próprio** (tudo no cliente). Se algum requisito exigir backend (ativação por código, config remota), proponha na Fase 1 antes de implementar.

### Fora de escopo (v1)
Gravação, chromecast/cast, multi-tela, pagamentos in-app, qualquer playlist/canal pré-carregado.

---

## 2. REGRAS NÃO NEGOCIÁVEIS

### Conformidade e legal
- O app **nunca** traz, sugere, lista ou promove provedores, playlists ou conteúdo. Nenhum link de playlist padrão.
- Tela de primeiro acesso deve deixar claro que o app é apenas um reprodutor e que o usuário é responsável pela fonte que adicionar.
- Para a revisão da Samsung, preparar conteúdo de demonstração **legal** (ex.: streams HLS de teste de domínio público/licença livre) e documentar nos "notes for reviewer".
- Política de privacidade e termos de uso publicados em URL pública, aderentes à LGPD.

### Técnicas
- Compatibilidade com o Chromium da menor TV-alvo: transpilar/targetar de acordo (sem sintaxe/APIs não suportadas; usar polyfills só quando necessário).
- Navegação: todo elemento interativo alcançável por setas, OK e Voltar; foco **sempre visível**; sem dependência de mouse/toque.
- Performance: listas virtualizadas; parsing de playlists grandes (50 mil+ itens) fora da thread principal (Web Worker); sem vazamento de memória em trocas de canal.
- Segurança: credenciais do usuário armazenadas de forma local e minimizada; nada de logs com URL/senha; preferir HTTPS e avisar quando a fonte for HTTP.

---

## 3. STACK PROPOSTA (validar na Fase 1)

| Camada | Escolha inicial |
|---|---|
| Linguagem | TypeScript (strict) |
| UI | React + Vite (build com target compatível com a TV mais antiga) |
| Navegação por foco | Biblioteca de spatial navigation (ex.: norigin-spatial-navigation) ou implementação própria |
| Estado | Zustand (ou equivalente leve) |
| Persistência | IndexedDB (catálogo/EPG) + localStorage (preferências) |
| Player | **AVPlay (Samsung)** como principal; **hls.js / Shaka** como fallback via `<video>` |
| i18n | i18next (pt-BR, en, es) |
| Testes | Vitest (unit), Playwright ou similar (e2e no navegador), testes manuais em emulador e TV real |
| Lint/Format | ESLint + Prettier + type-check no CI |
| CI | GitHub Actions: lint, testes, build, geração do `.wgt` (assinatura com segredos do CI ou manual) |

Se discordar de algum item, justifique na Fase 1 e proponha alternativa.

---

## FASE 1 — DESCOBERTA, ESCOPO E ARQUITETURA

**Objetivo:** fechar decisões antes de escrever código.

Tarefas:
1. Levantar requisitos funcionais e não funcionais a partir da seção 1 e produzir `docs/PRD.md` (histórias de usuário, priorização MoSCoW).
2. Pesquisar na documentação oficial Samsung: versões de Tizen/Chromium por ano de TV, APIs AVPlay, formatos/codecs/DRM suportados, privilégios necessários, limites de memória, requisitos de aprovação na Seller Office. Registrar em `docs/COMPATIBILIDADE.md` com links.
3. Definir arquitetura (diagrama + descrição): camadas `ui`, `domain`, `data`, `player`, `platform` (adapter para APIs Tizen, com mock para rodar no navegador).
4. Definir modelo de dados (Playlist/Fonte, Canal, Categoria, Filme, Série/Temporada/Episódio, EPG, Perfil, Favorito, Histórico).
5. Definir estratégia de erros, logs e telemetria (opt-in).
6. Listar riscos (CORS, streams MPEG-TS, TVs antigas, memória, rejeição na loja) com mitigação.

**Entregáveis:** `docs/PRD.md`, `docs/COMPATIBILIDADE.md`, `docs/ARQUITETURA.md`, `docs/RISCOS.md`.
**Gate:** aprovação da stack, do escopo da v1 e da matriz de TVs suportadas.

---

## FASE 2 — AMBIENTE, REPOSITÓRIO E ESQUELETO DO APP

**Objetivo:** projeto rodando "Hello TV" no emulador e na TV real.

Tarefas:
1. Estrutura do repositório, `.editorconfig`, ESLint, Prettier, Husky/lint-staged, Conventional Commits.
2. Scaffold do web app com Vite + React + TS; `config.xml` do Tizen com id, nome, versão, ícones (`icon.png`), privilégios mínimos (internet e entrada de teclas do controle) e política de acesso a rede.
3. Documentar em `docs/AMBIENTE.md`: instalação do Tizen Studio/CLI, Samsung TV Emulator, criação do **certificate profile** (autor + distribuidor), ativação do **Developer Mode** na TV, conexão via Device Manager/`sdb`, instalação do `.wgt`.
4. Camada `platform/` com interface única e duas implementações: `TizenPlatform` e `BrowserMockPlatform` (para desenvolver no navegador).
5. Registro de teclas do controle remoto (setas, OK, Voltar, Play/Pause/Stop/FF/RW, cores, números, Info) e tratamento do botão Voltar (nunca fechar o app por engano).
6. Pipeline de CI inicial (lint, type-check, testes, build).
7. Script `npm run build:wgt` que gera o pacote.

**Entregáveis:** app mínimo instalável e funcionando no emulador; CI verde.
**Critérios de aceite:** tela inicial navegável por controle; `.wgt` instala na TV de teste; CI verde.
**Gate:** demonstração em TV real (ou emulador, se a TV ainda não estiver disponível).

---

## FASE 3 — DESIGN SYSTEM E UX DE 10 PÉS

**Objetivo:** base visual e de navegação consistente.

Tarefas:
1. Tokens de design (cores, tipografia, espaçamentos, raios), tema escuro padrão, resolução-base 1920x1080 com escala para 4K.
2. Zonas seguras (overscan), tamanhos mínimos de fonte legíveis a 3 m, contraste adequado.
3. Componentes: Botão, Card de canal/filme, Lista horizontal (carrossel), Grade, Menu lateral, Modal, Teclado virtual (com suporte ao teclado nativo da TV), Toast, Skeleton/loading, Estado vazio, Estado de erro.
4. Sistema de foco: ordem lógica, memória do último foco ao voltar, scroll automático, foco inicial por tela, armadilhas de foco em modais.
5. i18n pt-BR/en/es com todas as strings externalizadas.
6. Storybook (ou página de componentes) rodando no navegador com simulação de teclas.

**Critérios de aceite:** nenhuma tela exige mouse; foco sempre visível; troca de idioma funcional.
**Gate:** aprovação visual dos componentes e do fluxo de navegação.

---

## FASE 4 — NÚCLEO DE DADOS (FONTES, PARSERS, CACHE)

**Objetivo:** carregar e indexar conteúdo a partir de fontes fornecidas pelo usuário.

Tarefas:
1. **Parser M3U/M3U8** robusto (atributos `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, tolerância a linhas malformadas e encodings), executado em **Web Worker**.
2. **Cliente Xtream Codes API**: autenticação, categorias e streams (live, VOD, séries), detalhes de série/episódios, informações de conta (expiração, conexões). Tratar erros e timeouts.
3. **Parser XMLTV** para EPG com janela de tempo configurável (ex.: hoje + 2 dias) e correlação por `tvg-id`.
4. Persistência em IndexedDB com índices para busca; estratégia de **cache + atualização em segundo plano** (stale-while-revalidate), TTL configurável e botão "atualizar agora".
5. Gerenciamento de múltiplas fontes e **perfis** (nome, avatar, favoritos/histórico/PIN por perfil).
6. Tratamento de CORS e rede: usar `fetch/XMLHttpRequest` com a política de acesso definida no `config.xml`; fallback e mensagens de erro claras (timeout, 401/403, DNS, HTTP vs HTTPS).
7. Testes unitários com fixtures (playlists pequenas, grandes e corrompidas).

**Critérios de aceite:** playlist de teste com 50 mil itens carrega sem travar a UI; busca retorna em tempo adequado; dados persistem após reiniciar o app.
**Gate:** aprovação do modelo de dados e de medições de desempenho (tempo de carga, memória).

---

## FASE 5 — PLAYER DE VÍDEO

**Objetivo:** reprodução estável de live, VOD e séries.

Tarefas:
1. Interface `PlayerEngine` com implementações `AvplayEngine` (principal) e `HtmlVideoEngine` (hls.js/Shaka como fallback). Seleção automática por tipo de stream (HLS, DASH, MPEG-TS, MP4/MKV progressivo) e por capacidade da TV.
2. Controles: play/pause, seek, avanço/retrocesso, próximo/anterior, troca de canal por números e por CH+/CH−, volta ao canal anterior.
3. Faixas de áudio e legendas (embutidas e externas SRT/VTT), seleção de qualidade quando aplicável, proporção de tela (16:9, 4:3, zoom, ajustar).
4. Barra de informações (canal, programa atual/próximo via EPG, progresso), mini-guia sobreposto.
5. Retomar de onde parou (VOD/séries), marcação de episódio assistido, autoplay do próximo episódio.
6. Máquina de estados do player (idle, loading, buffering, playing, paused, error) com **retry com backoff**, reconexão em queda de rede e mensagens de erro úteis.
7. Ciclo de vida: pausar/liberar recursos ao ir para segundo plano, liberar instâncias do AVPlay ao trocar de conteúdo (sem vazamento).
8. Teste de matriz: formatos x codecs (H.264, H.265, AAC, AC3/EAC3) nas TVs/emulador disponíveis; registrar resultados.

**Critérios de aceite:** 2 horas de reprodução contínua sem crash nem aumento anormal de memória; zapping de 100 trocas de canal sem degradação.
**Gate:** relatório da matriz de reprodução e aprovação.

---

## FASE 6 — TELAS E FUNCIONALIDADES

**Objetivo:** fluxo completo do usuário.

Tarefas (cada item com testes e estados de loading/erro/vazio):
1. **Onboarding:** aviso legal ("app é só um player"), escolha do tipo de fonte, formulário (M3U / Xtream), teclado virtual, validação e teste de conexão. Opção de ativar/ler dados por QR code ou código para facilitar a digitação (se aprovado na Fase 1).
2. **Seleção de perfil** e gerenciamento de fontes.
3. **Home:** continuar assistindo, favoritos, recém-adicionados.
4. **TV ao vivo:** categorias, lista de canais, busca, favoritos, EPG em grade (guia de programação) com navegação por tempo.
5. **Filmes** e **Séries:** categorias, detalhes (sinopse, ano, elenco quando disponível), temporadas/episódios.
6. **Busca global** (canais, filmes, séries) com teclado virtual.
7. **Favoritos e histórico** por perfil.
8. **Configurações:** idioma, player padrão, proporção, legendas, atualização de listas, tempo de cache, limpar dados, sobre/versão, termos e privacidade.
9. **Controle parental:** PIN por perfil, bloqueio por categoria/canal.
10. Tela de **diagnóstico** (versão do app, modelo/versão do Tizen, status da fonte, últimos erros) para suporte.

**Critérios de aceite:** todos os fluxos concluídos só com controle remoto; nenhuma tela sem tratamento de erro.
**Gate:** demo ponta a ponta em TV real.

---

## FASE 7 — QUALIDADE, DESEMPENHO E SEGURANÇA

**Objetivo:** endurecer o app antes do release.

Tarefas:
1. **Desempenho:** tempo de abertura do app (meta `[ex.: < 5 s]`), tempo para primeiro frame, uso de memória, FPS em rolagem; profiling no emulador e na TV real (Chrome DevTools remoto). Otimizar bundle (code splitting, imagens/logos com lazy loading e cache, limites de tamanho).
2. **Resiliência:** rede instável, fonte fora do ar, resposta gigante, lista corrompida, falta de armazenamento, relógio incorreto, TV sem internet ao abrir.
3. **Testes:** unitários (parsers, estado, regras de negócio), integração (data + player mockado), e2e no navegador com simulação do controle, checklist manual em TV real por modelo.
4. **Segurança/privacidade (LGPD):** revisar armazenamento de credenciais, ausência de dados sensíveis em logs, telemetria **opt-in** e anonimizada, termos e política de privacidade finalizados, mecanismo de apagar todos os dados do usuário.
5. **Acessibilidade básica:** contraste, tamanho de fonte ajustável, feedback visual claro (screen reader apenas se suportado e viável).
6. Auditoria de dependências (licenças compatíveis com distribuição comercial, vulnerabilidades) e arquivo `THIRD_PARTY_LICENSES`.

**Entregáveis:** `docs/QA_REPORT.md` com resultados, métricas e bugs conhecidos classificados por severidade.
**Gate:** zero bugs críticos/altos abertos.

---

## FASE 8 — BUILD DE PRODUÇÃO E ASSINATURA

**Objetivo:** pacote final pronto para a loja.

Tarefas:
1. Versionamento semântico sincronizado entre `package.json` e `config.xml`; changelog.
2. Build de produção (minificação, sem sourcemaps públicos, sem logs de debug, flags de ambiente).
3. Geração do `.wgt` via Tizen CLI e **assinatura** conforme o fluxo exigido pela Samsung para distribuição (confirmar o procedimento atual na documentação: certificado de autor e de distribuidor). Segredos fora do repositório (variáveis do CI ou cofre).
4. Pipeline de release no CI: tag → build → `.wgt` como artefato → checklist de verificação (tamanho do pacote, privilégios declarados, ícone, versão).
5. Instalação do pacote final em TV real e smoke test completo.

**Critérios de aceite:** build reproduzível a partir da tag; `.wgt` instalável e funcional.
**Gate:** aprovação do pacote de release candidate (RC).

---

## FASE 9 — PUBLICAÇÃO NA SAMSUNG (DEPLOY EM PRODUÇÃO)

**Objetivo:** app aprovado e publicado na Samsung Smart TV App Store.

Tarefas:
1. Conferir os **requisitos atuais** de aprovação (guia de QA/validação da Samsung, políticas de conteúdo, requisitos de ícones/screenshots, faixa etária, países) e produzir `docs/CHECKLIST_SAMSUNG.md` com cada requisito e status.
2. Preparar materiais: nome final, descrição (pt-BR/en/es), palavras-chave, ícones, **screenshots 1920x1080**, vídeo (se exigido), política de privacidade e URL de suporte.
3. Cadastro/registro do app na **Samsung Seller Office**: informações, países/regiões de distribuição, classificação etária, upload do `.wgt`.
4. Redigir "notas para o revisor": explicar que o app é player sem conteúdo, fornecer **fontes de demonstração legais** e passo a passo de teste.
5. Submeter, acompanhar o status e tratar rejeições: registrar o motivo, corrigir, incrementar versão e reenviar.
6. **Rollout:** publicar, validar a instalação a partir da loja numa TV real, conferir a versão exibida.

**Gate final:** app publicado e verificado a partir da loja.

---

## FASE 10 — PÓS-PRODUÇÃO E OPERAÇÃO

**Objetivo:** sustentar o produto.

Tarefas:
1. Observabilidade leve (opt-in): erros de reprodução, falhas de carga de fonte, versão de TV — sem dados pessoais.
2. Processo de atualização: ciclo de submissão de novas versões, política de versionamento, compatibilidade retroativa de dados locais (migrações de IndexedDB).
3. Canal de suporte (e-mail/página), FAQ (como obter URL da playlist, como ativar Developer Mode não é necessário ao usuário final) e templates de resposta.
4. Backlog pós-v1 priorizado: `[ex.: catch-up/timeshift, múltiplas telas, favoritos sincronizados, ativação via QR, Android TV/LG webOS]`.
5. Retrospectiva técnica e atualização da documentação.

---

## DEFINIÇÃO DE PRONTO (por fase)

- Código revisado, tipado, lint e testes passando no CI.
- Documentação da fase atualizada em `docs/`.
- Critérios de aceite e gate cumpridos e aprovados por mim.
- Pendências e riscos registrados.

## COMO COMEÇAR

Inicie **somente pela FASE 1**. Apresente o plano da fase, liste as perguntas em aberto que precisa que eu responda e aguarde minha aprovação antes de executar.
