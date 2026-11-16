# Matriz de Compatibilidade e Especificações Oficiais Samsung Tizen

**Produto:** NetTV  
**Alvo mínimo definido:** TVs Samsung **2018+** (Tizen 4.0 em diante)  
**Fonte primária:** Documentação oficial Samsung Developers (`https://developer.samsung.com/smarttv`)

> **Regra de rigor:** Itens confirmados na documentação oficial da Samsung estão referenciados abaixo. Pontos dependentes de hardware específico ou que não puderam ser verificados em detalhes para um modelo específico estão marcados como **`A VALIDAR`**.

---

## 1. Matriz Tizen OS × Ano da TV × Web Engine (Chromium)

De acordo com a documentação oficial de *General Specifications / Web Engine* da Samsung Smart TV:

| Ano do Modelo | Versão Tizen OS | Versão do Chromium (Web Engine) | Impacto Técnico no NetTV |
|---|---|---|---|
| **2018** | Tizen 4.0 | **Chromium M56** | **Linha de corte mínima.** Sem `...obj` (spread em objetos), sem `?.` / `??`, sem `AbortController`, sem `ResizeObserver`, sem `Promise.finally`. Exige transpilação (`@vitejs/plugin-legacy` / target `chrome56`) e polyfills mínimos. |
| **2019** | Tizen 5.0 | **Chromium M63** | Suporta `Promise.finally` e spread em objetos, mas ainda sem `?.` / `??` e `ResizeObserver`. |
| **2020** | Tizen 5.5 | **Chromium M69** | Suporta `ResizeObserver` e `AbortController`. |
| **2021** | Tizen 6.0 | **Chromium M76** | Suporte moderno mais amplo, ainda sem `?.` / `??` (chegam no M80). |
| **2022** | Tizen 6.5 | **Chromium M85** | Suporte completo a ES2020 (`?.`, `??`). |
| **2023** | Tizen 7.0 | **Chromium M94** | Web engine moderna. |
| **2024** | Tizen 8.0 | **Chromium M108** | Web engine moderna. |
| **2025+** | Tizen 9.0 / 10.0 | `A VALIDAR` (Chromium > M108) | Manter compatibilidade retroativa via bundle transpilado. |

**Fonte:** Samsung Developers — Smart TV General Specifications (Web Engine).

---

## 2. APIs de Mídia e Controle Remoto (Tizen / Samsung Product API)

### 2.1 `webapis.avplay` (Player Principal)
- **Inclusão obrigatória no `index.html`:** `<script type="text/javascript" src="$WEBAPIS/webapis/webapis.js"></script>`
- **Privilégio obrigatório no `config.xml`:** `<tizen:privilege name="http://developer.samsung.com/privilege/avplay" />`
- **Ciclo de estados oficial:** `NONE` → (`open`) → `IDLE` → (`prepare` / `prepareAsync`) → `READY` → (`play`) → `PLAYING` ↔ (`pause`) ↔ `PAUSED` → (`stop`) → `IDLE` → (`close`) → `NONE`.
- **Faixas de Áudio e Legendas:**
  - `webapis.avplay.getTotalTrackInfo()` retorna faixas `AUDIO` e `TEXT`.
  - `webapis.avplay.setSelectTrack(trackType, trackIndex)` permite troca dinâmica (`AUDIO` em `PLAYING`; `TEXT` em `PLAYING`/`PAUSED`; nota: `TEXT` não é suportado via `setSelectTrack` para DASH).
  - `webapis.avplay.setExternalSubtitlePath(fullLocalPath)` carrega legenda externa no estado **`IDLE`** (antes de `prepare`). Requer caminho local absoluto (ex.: baixado para `wgt-private-tmp` via `tizen.download`).
  - *Nota de implementação para SRT/VTT:* A documentação oficial exemplifica `.smi`, SMPTE-TT e DFXP; suporte nativo a `.srt`/`.vtt` externos via `setExternalSubtitlePath` em TVs 2018–2024 deve ser tratado com cautela e marcado como **`A VALIDAR`** no emulador/TV — tendo como fallback seguro renderização de legendas VTT/SRT em camada HTML/WebVTT overlay sincronizada com `oncurrentplaytime`.

### 2.2 `tizen.tvinputdevice` (Controle Remoto)
- **Privilégio obrigatório no `config.xml`:** `<tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>`
- **Teclas obrigatórias (funcionam sem registro explícito):** Setas direcionais (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`), `Enter`, `Back` (`XF86Back` / `10009` no Tizen).
- **Teclas dependentes de dispositivo (exigem `tizen.tvinputdevice.registerKey(...)`):** `MediaPlay`, `MediaPause`, `MediaPlayPause`, `MediaStop`, `MediaFastForward`, `MediaRewind`, `ChannelUp`, `ChannelDown`, `ColorF0Red`, `ColorF1Green`, `ColorF2Yellow`, `ColorF3Blue`, `0`–`9`, `Info`.

### 2.3 Rede e Política de Acesso (`config.xml`)
- **Privilégio obrigatório:** `<tizen:privilege name="http://tizen.org/privilege/internet"/>`
- **Política WARP:** `<access origin="*" subdomains="true"></access>` (necessário porque o usuário pode informar qualquer servidor IPTV externo).
- **Outras APIs úteis:** `tizen.systeminfo` / `webapis.productinfo` (modelo/firmware para tela de Diagnóstico — **`A VALIDAR`** nível de privilégio exigido no `config.xml` para `productinfo`).

---

## 3. Protocolos, Containers e Codecs Suportados

Conforme *Samsung Smart TV General Specifications* e *Streaming Feature Support*:

| Protocolo / Formato | Suporte AVPlay | Observações da Documentação Samsung |
|---|---|---|
| **HLS (`.m3u8`)** | Sim | Suporta segmentos MPEG-TS e fMP4 (desde Tizen 3.0). Trick play (FF/RW) requer tag `EXT-X-I-FRAME-STREAM_INF`. |
| **MPEG-DASH (`.mpd`)** | Sim | Suporta fMP4. Seleção de faixa `TEXT` via `setSelectTrack` não suportada em DASH. |
| **MPEG-TS (`.ts`, `.tp`, `.trp`)** | Sim | Suportado diretamente via AVPlay (essencial para listas IPTV ao vivo em TS). *Nota:* Navegadores desktop (`<video>` / `hls.js`) **não** reproduzem `.ts` bruto diretamente sem transmuxing. |
| **MP4 / MKV / MOV** | Sim | Amplamente suportado para VOD/Séries. |
| **Vídeo: H.264 (AVC)** | Sim | Perfis BP/MP/HP até FHD/4K conforme modelo e level. |
| **Vídeo: H.265 (HEVC)** | Sim | Main / Main10 (4K/8K conforme tier da TV). |
| **Áudio: AAC / HE-AAC** | Sim | Suportado nativamente em MP4, MKV, HLS, TS. |
| **Áudio: AC3 / E-AC3 (DD+)** | Sim | Suportado na maioria dos modelos; DTS depende do ano do modelo (`A VALIDAR` em 2018+). |
| **DRM** | Sim (Widevine L1 / AES-128 / SAMPLE-AES) | PlayReady e Verimatrix foram descontinuados em modelos recentes (Tizen 7.0+). |

---

## 4. Memória, Performance e Requisitos da Samsung Seller Office

### 4.1 Gestão de Memória (Hardware Resource Management)
- A Samsung monitora consumo total somando **PSS** (RAM residente), **SWAP** e **GPU/GEM** (texturas, imagens, UI).
- Existe a API **PMS** (`getWebAppMemoryUsage`, `getWebAppMemoryLimit`, `setMemoryUsageCallback`) para monitorar uso em runtime.
- **Limites exatos em MB por modelo de 2018–2024:** **`A VALIDAR`** na documentação específica de cada ano / emulador (tipicamente apps web devem operar com folga abaixo de ~150–250 MB de PSS total em TVs de entrada para evitar OOM killer do sistema).

### 4.2 Checklist de Qualidade e Seller Office
Baseado no *Samsung Smart TV Development Checklist* e *Seller Office Launch Checklist*:
1. **Generals / UI:** Navegação 100% por controle remoto, foco sempre visível, tratamento correto da tecla `Return/Back` (exibir confirmação antes de sair do app via `tizen.application.getCurrentApplication().exit()`, nunca fechar abruptamente).
2. **Connection:** Detectar perda de rede e exibir feedback amigável ao usuário sem travar o app.
3. **Media Playback:** Controles funcionais, tratamento de erros de stream, sincronia A/V, suporte a troca de proporção.
4. **Multitasking:** Ao receber evento `visibilitychange` (app minimizado/segundo plano), pausar reprodução e liberar recursos do `AVPlay` (`suspend()` ou `stop()`/`close()` conforme ciclo de vida).
5. **Empacotamento e Assinatura:** Pacote `.wgt` contendo `config.xml`, `author-signature.xml` e `signature1.xml`. Passar no **Auto Pre-Test Tool** da Seller Office antes da submissão humana.
6. **Notas para o Revisor:** Explicar claramente que o app é um player neutro sem conteúdo e fornecer streams HLS de teste **100% legais/domínio público** para validação do QA da Samsung.

