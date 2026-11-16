# Checklist de Submissão — Samsung TV Seller Office (Fase 9)

**App:** NetTV (`nettv00001.NetTV`)  
**Versão RC:** `0.1.0`  
**Alvo mínimo:** Samsung Tizen 4.0 / 2018+

---

## 1. Requisitos Técnicos e de QA Samsung

| Categoria | Requisito | Status | Evidência / Observação |
|---|---|---|---|
| **Generals / UI** | Navegação 100% por controle remoto, foco sempre visível, sem dependência de mouse | **Atendido** | Testado com `norigin-spatial-navigation` + Chrome DevTools |
| **Return / Back** | Fechar modais/player/subtelas antes de sair; confirmar saída na raiz via `tizen.application.getCurrentApplication().exit()` | **Atendido** | [FocusProvider.tsx](file:///f:/projeto/NetTV/src/ui/focus/FocusProvider.tsx) + [modalBackStack.ts](file:///f:/projeto/NetTV/src/ui/focus/modalBackStack.ts) |
| **Multitasking** | Pausar e liberar `AVPlay` ao receber `visibilitychange` (`suspend()`/`restore()`) | **Atendido** | [PlayerViewport.tsx](file:///f:/projeto/NetTV/src/ui/player/PlayerViewport.tsx) |
| **Network** | Detectar perda de rede e exibir mensagem amigável sem travar | **Atendido** | [httpClient.ts](file:///f:/projeto/NetTV/src/data/http/httpClient.ts) + reconexão `online` |
| **Media Playback** | Controles funcionais, proporção de tela, troca de faixas, sem vazamento no zapping | **Atendido (simulado)** | `A VALIDAR` em TV real / emulador |
| **Conteúdo / Legal** | Nenhum conteúdo/playlist embutido; aviso legal no Onboarding; Política de Privacidade pública (LGPD) | **Atendido** | [OnboardingScreen.tsx](file:///f:/projeto/NetTV/src/ui/screens/OnboardingScreen.tsx) + [privacy.html](file:///f:/projeto/NetTV/public/privacy.html) |
| **Auto Pre-Test Tool** | Validação automática do `.wgt` na Samsung Seller Office | **Pendente (Portal)** | Executar após upload do `.wgt` assinado |

---

## 2. Requisitos de Ativos da Loja (Seller Office)

| Ativo | Especificação Oficial Samsung | Status | Arquivo / Ação |
|---|---|---|---|
| **Ícone 1920×1080 (Foreground)** | PNG 32-bit (RGBA), 72 DPI, `< 300 KB` | **Gerado** | `store-assets/icon-1920x1080-foreground.png` |
| **Ícone 1920×1080 (Background)** | PNG 24-bit (RGB) ou JPG, 72 DPI, `< 300 KB` | **Gerado** | `store-assets/icon-1920x1080-background.png` |
| **Ícone Secundário 512×423** | PNG, `< 300 KB` | **Gerado** | `store-assets/icon-512x423.png` |
| **Screenshots (mín. 4)** | 1920×1080 (ou 1280×720), JPG, `≤ 500 KB` cada | **Pendente (Captura)** | Capturar de `Home`, `TV ao Vivo`, `Filmes/Detalhes` e `Player` |
| **Pacote `.wgt` Assinado** | Assinado com Author + Distributor (Public) | **Pendente (Portal/CI)** | Gerar com `TIZEN_CERT_PROFILE` definitivo |
