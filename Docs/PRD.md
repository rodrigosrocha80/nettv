# PRD — NetTV (Samsung Smart TV IPTV Player)

**Versão:** 1.0 (Fase 1)  
**Produto:** NetTV  
**Plataforma:** Samsung Smart TV — Tizen Web App (`.wgt`)  
**Idiomas:** `pt-BR` (padrão), `en`, `es`

---

## 1. Visão Geral e Posicionamento

O **NetTV** é um reprodutor de mídia e listas IPTV para **Samsung Smart TV (Tizen 4.0+ / modelos 2018 em diante)**, operado 100% por controle remoto (experiência "10 pés").

### Princípio Inegociável de Conformidade
- O aplicativo **não contém, fornece, hospeda, lista, sugere ou promove** nenhum canal, filme, série, playlist ou provedor de conteúdo.
- Todo conteúdo reproduzido é de responsabilidade exclusiva do usuário final, que informa sua própria fonte (URL M3U/M3U8, credenciais Xtream Codes API e/ou URL XMLTV de EPG).
- Na primeira execução (Onboarding), o usuário deve visualizar e aceitar explicitamente o termo de responsabilidade esclarecendo que o NetTV é apenas um reprodutor de mídia.

---

## 2. Público-Alvo e Personas

1. **Usuário Final em Sala de Estar (TV):** busca interface limpa, rápida, com letras legíveis a 3 metros, navegação intuitiva pelas setas/OK/Voltar do controle remoto e troca ágil de canais (zapping).
2. **Usuário Multi-perfil (Família):** deseja separar favoritos, histórico ("continuar assistindo") e aplicar controle parental (PIN) por perfil/categoria.
3. **Revisor da Samsung Seller Office:** precisa testar o app de forma simples com fontes de demonstração legais (streams públicos HLS/DASH livres) documentadas nas notas de revisão.

---

## 3. Escopo da Versão 1.0 (v1)

### Dentro do Escopo (v1)
- Onboarding com aviso legal obrigatório + configuração de fonte (M3U/M3U8, Xtream Codes, XMLTV EPG).
- **Pareamento via QR Code / Código Curto (Backend Efêmero Mínimo):** geração de código temporário na TV e QR Code apontando para página web responsiva onde o usuário digita URL/credenciais no celular e envia com segurança para a TV (TTL curto, sem retenção persistente no servidor).
- Gerenciamento de múltiplas fontes e múltiplos perfis locais (avatar, nome, favoritos, histórico, PIN parental).
- Seções principais: **Home** (Continuar Assistindo, Favoritos, Recém-Adicionados), **TV ao Vivo** (categorias, canais, guia EPG em grade), **Filmes (VOD)**, **Séries** (temporadas e episódios), **Busca Global**, **Configurações** e **Diagnóstico**.
- Player de vídeo robusto com `AVPlay` (principal) e fallback HTML5 (`hls.js` / Shaka Player), suporte a faixas de áudio, legendas, proporção de tela, barra de informações com EPG atual/próximo, mini-guia e retomada de VOD/séries.
- Internacionalização completa (`pt-BR`, `en`, `es`).

### Fora de Escopo (v1)
- Gravação de transmissões (PVR/DVR).
- Chromecast / Cast / AirPlay.
- Multi-tela (Picture-in-Picture ou múltiplas streams simultâneas).
- Pagamentos in-app ou assinaturas.
- Qualquer playlist, canal ou catálogo pré-carregado.
- Catch-up / Timeshift avançado (planejado para pós-v1).

---

## 4. Requisitos Funcionais e Priorização MoSCoW

| ID | História de Usuário / Requisito | Prioridade |
|---|---|---|
| **RF-01** | Como usuário, quero ver um aviso legal claro na primeira abertura confirmando que o app é apenas um player sem conteúdo embutido. | **Must** |
| **RF-02** | Como usuário, quero adicionar uma fonte via **URL M3U/M3U8** ou **Xtream Codes** (URL, usuário, senha) e opcionalmente URL **XMLTV** para EPG. | **Must** |
| **RF-03** | Como usuário, quero escanear um **QR Code** (ou digitar código curto) para preencher a URL/credenciais pelo celular sem precisar digitar tudo no controle remoto. | **Should** |
| **RF-04** | Como usuário, quero navegar por todo o aplicativo usando apenas as teclas do controle remoto (Setas, OK, Voltar, Números, CH+/CH-, Play/Pause/Stop/FF/RW, Cores, Info). | **Must** |
| **RF-05** | Como usuário, quero assistir canais de **TV ao Vivo** organizados por categoria, com zapping rápido (CH+/CH-, números e retorno ao canal anterior). | **Must** |
| **RF-06** | Como usuário, quero consultar o **Guia de Programação (EPG)** em grade com navegação por horário e ver programa atual/próximo na barra do player. | **Must** |
| **RF-07** | Como usuário, quero navegar e reproduzir **Filmes (VOD)** e **Séries** (temporadas/episódios), com sinopse, capa e retomada automática de onde parei. | **Must** |
| **RF-08** | Como usuário, quero buscar canais, filmes e séries globalmente usando teclado virtual ou teclado nativo da TV. | **Must** |
| **RF-09** | Como usuário, quero criar múltiplos **perfis** locais, cada um com seus próprios favoritos, histórico e **PIN de controle parental** para bloquear categorias/canais. | **Should** |
| **RF-10** | Como usuário, quero alternar faixas de áudio, legendas (embutidas e externas SRT/VTT) e proporção de tela (Ajustar, 16:9, 4:3, Zoom) durante a reprodução. | **Must** |
| **RF-11** | Como usuário, quero atualizar manualmente minha lista/EPG, configurar TTL de cache e poder apagar todos os meus dados locais (LGPD). | **Must** |
| **RF-12** | Como usuário/suporte, quero acessar uma tela de **Diagnóstico** exibindo versão do app, modelo/versão do Tizen, status da fonte e últimos erros sanitizados. | **Should** |
| **RF-13** | Como usuário, quero escolher o idioma da interface (`pt-BR`, `en`, `es`) e optar por enviar ou não telemetria anônima de falhas (opt-in). | **Could** |

---

## 5. Requisitos Não Funcionais (RNFs)

- **RNF-01 (Compatibilidade):** Suportar Samsung Smart TVs **2018+ (Tizen 4.0 / Chromium M56+)** até modelos atuais (Tizen 8.0+ / Chromium M108+).
- **RNF-02 (Resolução e UX 10 pés):** Layout base `1920x1080` com escala proporcional para 4K, respeitando zonas seguras (overscan ~5%), contraste mínimo WCAG AA para TV e fonte mínima legível a 3 metros (≥ 22px em 1080p para texto de leitura).
- **RNF-03 (Performance de Parsing e UI):** Listas com 50.000+ itens devem ser parseadas em **Web Worker** sem bloquear a thread principal; listas longas devem usar **virtualização** mantendo rolagem fluida.
- **RNF-04 (Estabilidade e Memória):** Zero vazamento de memória em trocas de canal (100 zappings consecutivos) e em reprodução contínua de 2+ horas; liberação explícita de `webapis.avplay.close()` ao sair/trocar de mídia ou ir para segundo plano.
- **RNF-05 (Tempo de Abertura):** Cold start até a tela inicial interativa inferior a **5 segundos** em TVs alvo (emulador/hardware).
- **RNF-06 (Segurança e Privacidade - LGPD):** Credenciais armazenadas apenas localmente (minimizadas); nunca registrar URLs completas, tokens ou senhas em logs; alertar visualmente quando a fonte usar `HTTP` sem TLS; política de privacidade e termos acessíveis em URL pública.
- **RNF-07 (Resiliência de Rede):** Tratamento claro de offline, timeout, 401/403, DNS, listas corrompidas e reconexão automática com backoff exponencial no player.

