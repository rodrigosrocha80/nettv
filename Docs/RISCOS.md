# Matriz de Riscos e Mitigações — NetTV

**Versão:** 1.0 (Fase 1)

| ID | Risco | Probabilidade | Impacto | Mitigação Planejada |
|---|---|---|---|---|
| **R-01** | **Incompatibilidade JS/CSS no Chromium M56 (TVs 2018)** | Alta | Alto | Configurar `@vitejs/plugin-legacy` com target `chrome 56`; incluir polyfills mínimos (`AbortController`, `ResizeObserver` se necessário); validar dependências (evitar libs que exijam ES2020+ sem transpilação); testar obrigatoriamente no emulador Tizen 4.0. |
| **R-02** | **Streams MPEG-TS (`.ts`) não tocam no navegador/HTML5** | Alta | Médio | Na TV real/emulador, usar `AvplayEngine` que suporta MPEG-TS nativamente. No navegador de desenvolvimento (`BrowserMockPlatform`), documentar a limitação e usar streams HLS/MP4 de teste ou proxy/transmuxing apenas em dev. |
| **R-03** | **Vazamento de memória em trocas rápidas de canal (Zapping) ou listas 50k+** | Média | Alto | Garantir chamada síncrona/ordenada de `webapis.avplay.stop()` + `close()` antes de abrir novo stream e ao receber `visibilitychange`; usar Web Workers com streaming/chunking no parser M3U; virtualizar todas as listas longas e limitar cache de imagens/logos. |
| **R-04** | **Bloqueio de CORS em requisições HTTP/HTTPS** | Média | Alto | Declarar `<tizen:privilege name="http://tizen.org/privilege/internet"/>` e `<access origin="*" subdomains="true"/>` no `config.xml` (em apps empacotados Tizen `file://`, a política WARP do `config.xml` libera origens declaradas). Em dev no browser, usar proxy Vite se necessário. |
| **R-05** | **Rejeição na Samsung Seller Office por suspeita de pirataria/IPTV** | Média | Crítico | Zero conteúdo/links embutidos; aviso legal explícito no primeiro acesso; termos de uso e política de privacidade (LGPD) em URL pública; incluir streams de demonstração 100% legais (ex.: Big Buck Bunny / Apple BipBop HLS) nas "Notes for Reviewer". |
| **R-06** | **Travamento ou OOM (Out of Memory) em TVs 2018–2019 com RAM limitada** | Média | Alto | Janela de EPG limitada (padrão: hoje + 2 dias); limpar registros expirados no IndexedDB ao sincronizar; lazy loading de capas/logos; monitorar PSS com PMS API quando disponível. |
| **R-07** | **Legendas externas SRT/VTT não suportadas nativamente pelo AVPlay** | Média | Médio | Testar comportamento no emulador na Fase 5 (`A VALIDAR`). Já prever parser SRT/VTT em JS renderizado como overlay HTML sincronizado com `oncurrentplaytime` como fallback confiável. |
| **R-08** | **Vazamento de credenciais do usuário em logs ou no pareamento QR** | Baixa | Crítico | Sanitizador obrigatório em todo logger; pareamento QR com TTL curto (5 min), leitura única (one-time read), sem persistência em disco e sempre sobre HTTPS. |
| **R-09** | **Falta de TV física para validação final de codecs/DRM/remote** | Média | Alto | Desenvolver e validar rigorosamente no Tizen Studio TV Emulator (Tizen 4.0 e Tizen 7.0/8.0) desde a Fase 2, e planejar empréstimo/teste em TV física antes da submissão na Seller Office (Fases 7–8). |

