# Matriz de Reprodução (Formatos × Codecs) — NetTV

**Fase:** 5 (Player de Vídeo)  
**Motores implementados:** `AvplayEngine` (Tizen principal) e `HtmlVideoEngine` (`hls.js` / `<video>` fallback)

---

## 1. Matriz de Suporte Esperado vs Validado

| Formato / Protocolo        | Vídeo         | Áudio             | `HtmlVideoEngine` (Navegador)                  | `AvplayEngine` (Tizen TV / Emulador) | Observações                                                                              |
| -------------------------- | ------------- | ----------------- | ---------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| **HLS (`.m3u8`)**          | H.264 (AVC)   | AAC / HE-AAC      | Validado via `hls.js`                          | `A VALIDAR EM TV REAL`               | ABR + seleção de qualidade e faixas de áudio no `hls.js`.                                |
| **HLS (`.m3u8`)**          | H.265 (HEVC)  | AAC / AC3         | Depende do SO/browser                          | `A VALIDAR EM TV REAL`               | Tizen 2018+ suporta HEVC via AVPlay.                                                     |
| **MPEG-TS (`.ts`)**        | H.264 / H.265 | AAC / AC3 / E-AC3 | Não suportado (emite erro acionável)           | `A VALIDAR EM TV REAL`               | Principal formato de IPTV ao vivo; roteado automaticamente para `AvplayEngine` no Tizen. |
| **MP4 / MKV (VOD/Séries)** | H.264 / H.265 | AAC / AC3 / E-AC3 | MP4 H.264+AAC suportado; MKV/AC3 limitado      | `A VALIDAR EM TV REAL`               | Retomar de onde parou (`seekTo`), legendas externas SRT/VTT via overlay HTML.            |
| **MPEG-DASH (`.mpd`)**     | H.264 / H.265 | AAC               | `A VALIDAR` (sem Shaka na v1; fallback nativo) | `A VALIDAR EM TV REAL`               | AVPlay suporta DASH nativamente.                                                         |

---

## 2. Testes Automatizados Executados (Ambiente Simulado)

- **Zapping de 100 trocas de canal (`AvplayEngine` mockado):** 101 aberturas com 100 encerramentos (`stop()` + `close()`) prévios, sem acúmulo de instâncias.
- **Retry com backoff exponencial (`1s → 2s → 4s`):** validado em erro recuperável com recuperação automática.
- **Legendas externas (SRT e WebVTT):** parser e busca binária de cues validados.
- **Autoplay de próximo episódio (Séries):** contagem regressiva de 10s e transição automática validada.

---

## 3. Pendências para Validação em Hardware/Emulador (Fases 6–7)

- [ ] Executar teste de **2 horas de reprodução contínua** em TV real / emulador Tizen monitorando memória (PMS).
- [ ] Validar **zapping de 100 trocas reais** de stream HLS e MPEG-TS em TV real.
- [ ] Confirmar codecs AC3/E-AC3 e HEVC em modelo Tizen 2018–2024 disponível.
