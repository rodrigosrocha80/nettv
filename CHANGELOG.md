# Changelog — NetTV

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-11-16 (Release Candidate)

### Adicionado
- **Arquitetura e Plataforma Tizen:** camada `PlatformAdapter` (`TizenPlatform` + `BrowserMockPlatform`), suporte a teclas do controle remoto e ciclo de vida (`visibilitychange`).
- **Design System 10-ft:** tokens para 1920x1080/4K, zonas seguras, navegação espacial (`norigin-spatial-navigation`), memória de foco, modal com *focus trap*, teclado virtual e i18n (`pt-BR`, `en`, `es`).
- **Núcleo de Dados:** parsers M3U/M3U8 e XMLTV em Web Workers, cliente Xtream Codes API, persistência em IndexedDB com *stale-while-revalidate*, múltiplos perfis e sanitização de URLs.
- **Player de Vídeo:** `AvplayEngine` (Tizen principal) + `HtmlVideoEngine` (`hls.js` fallback), legendas externas SRT/VTT, zapping (CH+/CH-, números, canal anterior), retomar VOD e autoplay de próximo episódio.
- **Telas:** Onboarding (com aviso legal), Perfis/Fontes, Home, TV ao Vivo + Guia EPG em grade, Filmes, Séries, Busca global, Favoritos/Histórico, Configurações (escala de fonte, telemetria opt-in, controle parental) e Diagnóstico.
- **Build e Qualidade:** code splitting, minificação Terser (`drop_console`), scripts `version:sync`, `verify:pkg`, `build:wgt` e pipeline de release.
