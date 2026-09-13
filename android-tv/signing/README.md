# Assinatura de produção do PontoView Telas

A atualização in-place do Android exige que todas as versões do APK usem a mesma chave de assinatura.

## Regra principal

A chave privada **não deve ser enviada ao repositório**. Ela deve ser gerada uma única vez, guardada em local seguro e cadastrada como secrets do GitHub Actions.

## Gerar a chave

Em uma máquina segura com Java instalado:

```bash
keytool -genkeypair -v \
  -keystore pontoview-release.jks \
  -alias pontoview \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Guarde o arquivo `pontoview-release.jks` e as senhas fora do repositório.

## Secrets esperados pelo GitHub Actions

Em **Settings → Secrets and variables → Actions**, crie:

- `PV_ANDROID_KEYSTORE_B64`
- `PV_ANDROID_KEYSTORE_PASSWORD`
- `PV_ANDROID_KEY_ALIAS`
- `PV_ANDROID_KEY_PASSWORD`

O primeiro secret deve conter o arquivo JKS codificado em Base64.

### Windows PowerShell

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("pontoview-release.jks")) | Set-Clipboard
```

### Linux/macOS

```bash
base64 -w 0 pontoview-release.jks
```

No macOS, se `-w` não existir:

```bash
base64 pontoview-release.jks | tr -d '\n'
```

## Migração da assinatura de debug

As versões de teste antigas foram geradas com assinatura de debug do CI. Elas não podem receber uma APK de produção por cima.

Quando a assinatura de produção for habilitada, será necessária **uma única reinstalação limpa** no dispositivo:

1. desinstalar a versão debug;
2. instalar a primeira APK assinada de produção;
3. parear novamente a tela, se o Android tiver removido os dados do app;
4. a partir daí, atualizações futuras usam a mesma assinatura e podem ser instaladas in-place.

Nunca regenere a chave de produção depois que clientes começarem a usar o aplicativo.
