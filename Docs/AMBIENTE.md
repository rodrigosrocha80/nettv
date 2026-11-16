# Guia de Ambiente — Samsung Tizen Studio, Emulador e Dispositivo Real

Este documento descreve como configurar o ambiente local no Windows para empacotar, assinar e testar o **NetTV** (`.wgt`) no **Samsung TV Emulator** e em uma **Samsung Smart TV** física.

---

## 1. Instalação do Tizen Studio + TV Extension

1. Baixe o **Tizen Studio with IDE** (ou CLI) em:  
   `https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html`
2. Ao concluir a instalação, abra o **Package Manager** do Tizen Studio:
   - Na aba **Main SDK**, instale a plataforma base (ex.: `Tizen SDK tools`).
   - Na aba **Extension SDK**, localize **TV Extensions** (ex.: `TV Extensions-8.0` ou compatível com o emulador desejado, além de `TV Extensions-4.0` se quiser testar Chromium M56) e instale **Samsung Certificate Extension** + **TV Emulator**.
3. Adicione as ferramentas do Tizen ao `PATH` do Windows (exemplo padrão):
   - `C:\tizen-studio\tools`
   - `C:\tizen-studio\tools\ide\bin`
4. Verifique no terminal:
   ```powershell
   tizen version
   sdb version
   ```

---

## 2. Criação do Certificate Profile (Author + Distributor)

> **Importante:** Nunca commite arquivos `.p12`, `.cer` ou `profiles.xml` no Git (já bloqueados no `.gitignore`).

1. No Tizen Studio, abra **Tools → Certificate Manager** (ícone de chave).
2. Clique em **`+`** e escolha **Samsung** (Samsung Certificate Extension).
3. Selecione o tipo **TV**.
4. Informe um nome para o perfil (ex.: `NetTVProfile`).
5. **Author Certificate:** crie um novo certificado de autor e faça login com sua Samsung Account.
6. **Distributor Certificate:**
   - Para **Emulador** e **TV em Developer Mode**, selecione **Public** (ou adicione o DUID da TV física conectado via `sdb`).
7. Conclua e confirme que o perfil `NetTVProfile` está ativo.

---

## 3. Executando no Samsung TV Emulator

1. Abra o **Emulator Manager** no Tizen Studio.
2. Crie ou inicie uma VM **TV** (ex.: `T-samsung-7.0-x86` ou `T-samsung-4.0-x86`).
3. Com o emulador ligado, gere e instale o `.wgt`:
   ```powershell
   $env:TIZEN_CERT_PROFILE = "NetTVProfile"
   npm run build:wgt
   tizen install -n dist-wgt\NetTV.wgt -t <NOME_DO_EMULADOR>
   ```
4. Para listar o nome exato do alvo conectado:
   ```powershell
   sdb devices
   ```

---

## 4. Ativando Developer Mode e Testando em TV Física

1. Na Samsung Smart TV, abra o app **Apps** (Smart Hub).
2. Digite no controle remoto a sequência **`12345`**.
3. No modal **Developer Mode**, ative a chave para **ON** e informe o **IP do seu computador** na mesma rede Wi-Fi/cabo.
4. Reinicie a TV (segurando o botão Power ou desligando da tomada por alguns segundos).
5. No PC, conecte via `sdb`:
   ```powershell
   sdb connect <IP_DA_TV>:26101
   sdb devices
   ```
6. Instale o `.wgt` assinado com um Distributor Certificate que contenha o **DUID** da TV:
   ```powershell
   tizen install -n dist-wgt\NetTV.wgt -t <DEVICE_ID>
   ```
