# Build de Produção e Assinatura Samsung Tizen — NetTV

**Fase:** 8 (Build de Produção e Assinatura)  
**Scripts principais:** `npm run version:sync`, `npm run build`, `npm run build:wgt`, `npm run verify:pkg`

---

## 1. Versionamento Semântico
1. Atualize a versão em [package.json](file:///f:/projeto/NetTV/package.json) (`"version": "x.y.z"`).
2. Execute `npm run version:sync` para atualizar automaticamente o atributo `version` em [public/config.xml](file:///f:/projeto/NetTV/public/config.xml).
3. Atualize o [CHANGELOG.md](file:///f:/projeto/NetTV/CHANGELOG.md) e crie a tag Git `vX.Y.Z`.

---

## 2. Assinatura para Distribuição (Samsung Seller Office)
Para publicar na **Samsung Smart TV App Store**, o pacote `.wgt` deve ser assinado com um **Certificate Profile** contendo:
- **Author Certificate** (`author.p12`): identifica o desenvolvedor/publicador (use sempre o mesmo certificado em atualizações futuras do app).
- **Distributor Certificate** (`distributor.p12`): emitido no Tizen Certificate Manager com nível **Public** (para loja) ou **Partner** (se usar APIs privilegiadas de parceiro).

> **Segurança:** nunca versione arquivos `.p12`, `profiles.xml` ou senhas no repositório. No CI ([release.yml](file:///f:/projeto/NetTV/.github/workflows/release.yml)), armazene-os apenas em **GitHub Secrets**.

---

## 3. Checklist de Verificação do Release Candidate (RC)
1. `npm run lint` e `npm run type-check` verdes.
2. `npm test` com 100% dos testes passando.
3. `npm run build:wgt` gera `./dist` e `./dist-wgt/NetTV.wgt` (quando Tizen CLI está instalado).
4. `npm run verify:pkg` confirma:
   - `config.xml`, `index.html`, `icon.png` presentes;
   - versão sincronizada entre `package.json` e `dist/config.xml`;
   - zero arquivos `.map` (sourcemaps) no pacote;
   - privilégios mínimos declarados (`internet`, `tv.inputdevice`, `avplay`).
5. **Smoke test em TV real:** instalar via `tizen install -n NetTV.wgt -t <TV_DEVICE_ID>`, abrir o app, concluir Onboarding com stream HLS livre, testar zapping, busca, configurações e confirmação de saída via botão `Return/Back`.
