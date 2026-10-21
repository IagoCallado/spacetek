# Worker de frete — SpaceTek

Cloudflare Worker que faz a cotação real de frete (Frenet ou SuperFrete) para o site.

**Worker publicado em:** `https://spacetek-frete.spacetek.workers.dev`
(subdomínio workers.dev da conta `Callads31@gmail.com's Account`)

O site **não precisa** deste Worker para funcionar: sem o endpoint configurado (ou em caso de
falha), o orçamento usa a tabela estática do painel como estimativa.

## Requisitos

- Conta gratuita no Cloudflare: https://dash.cloudflare.com/sign-up
- Conta em um provedor de cotação:
  - **SuperFrete** (em uso): https://web.superfrete.com/ — gere o token em
    *Integrações → Integrar em Desenvolvedores → Confirmar*.
  - **Frenet**: https://www.frenet.com.br/ — token em *Minha conta → Dados Cadastrais → Chaves de Acesso → TOKEN*.
- Node.js instalado (para o `wrangler`).

## Deploy (primeira vez)

> Já publicado. Para republicar depois de mexer no código: `npm run deploy` (ou `wrangler deploy`).

No terminal, dentro da pasta `worker`:

```powershell
# 1. Instalar o wrangler (uma vez)
npm install -g wrangler

# 2. Autenticar (abre o navegador)
wrangler login

# 3. Gravar o token do provedor (pede o valor, nao vai para o repositorio)
wrangler secret put SUPERFRETE_TOKEN
#   -> cole o token da SuperFrete

# 4. (Opcional) CEP de origem como segredo; normalmente vem do painel do site
wrangler secret put CEP_ORIGEM
#   -> ex.: 18000000

# 5. Publicar
wrangler deploy
```

> **Atenção:** o `wrangler secret put` só funciona **depois** do primeiro `wrangler deploy`
> (é preciso o Worker existir na conta) e **precisa ser executado dentro da pasta `worker`**
> (é lá que está o `wrangler.toml` com o nome do Worker).

O `wrangler deploy` imprime a URL, algo como:

```
https://spacetek-frete.spacetek.workers.dev
```

> O certificado do subdomínio `*.workers.dev` pode levar ~1–2 minutos para ser emitido
> logo após o primeiro deploy — se der "handshake failure", é só esperar e repetir.

## Ativar no site

1. Abra o painel admin do site → **Frete**.
2. Cole a URL no campo **Endpoint de cotação real (Worker)**.
3. Preencha o **CEP de origem** e clique em **Salvar**.

Pronto: ao digitar um CEP válido no orçamento, as opções reais aparecem para escolha.

## Provedores

O provedor ativo vem da var `PROVEDOR` no `wrangler.toml`:

| PROVEDOR | Secret do token | Endpoint |
|---|---|---|
| `superfrete` | `SUPERFRETE_TOKEN` | `https://api.superfrete.com/api/v0/calculator` |
| `frenet` | `FRENET_TOKEN` | `https://api.frenet.com.br/shipping/quote` |

`PROVEDOR_TOKEN` continua funcionando como fallback de qualquer um dos dois.
Para trocar de provedor: mude a var, grave o secret correspondente e rode `wrangler deploy`.

### SuperFrete — detalhes

- **Serviços cotados**: `SUPERFRETE_SERVICES = "1,2,17"` → 1 = PAC, 2 = SEDEX, 17 = Mini Envios.
  Outros códigos: 3 = Jadlog, 33 = J&T.
- **Sandbox**: troque `SUPERFRETE_URL` para `https://sandbox.superfrete.com/api/v0/calculator`
  e use o token de https://sandbox.superfrete.com/#/integrations (etiquetas de sandbox não valem postagem real).
- **Cabeçalhos obrigatórios**: `Authorization: Bearer {token}` e
  `User-Agent: NomeDaApp/versao (email@tecnico.com)`.
- A cotação é **grátis**; só a emissão da etiqueta é cobrada.
- A API marca serviços inviáveis com `has_error: true` (ex.: Mini Envios acima do limite) —
  o Worker descarta esses itens em vez de mostrar preço zero.

## Testar

```powershell
# health check
curl https://spacetek-frete.spacetek.workers.dev/health

# cotacao
curl -X POST https://spacetek-frete.spacetek.workers.dev/quote `
  -H "Content-Type: application/json" `
  -d '{\"cepOrigem\":\"18000000\",\"cep\":\"01001000\",\"items\":[{\"width\":16,\"height\":10,\"length\":20,\"weight\":0.6,\"insurance_value\":120,\"quantity\":1}]}'
```

### Testar o token do provedor direto (sem passar pelo Worker)

```powershell
powershell -ExecutionPolicy Bypass -File .\testar-token.ps1
```
O script pede o token (fica apenas na memória da sua máquina) e chama a SuperFrete diretamente,
mostrando se o token é aceito.

> O `/health` do Worker também diagnostica: mostra o tamanho do secret e faz uma cotação
> mínima de teste (200 = token válido; 401/403 = token recusado).

## Segurança

- Os tokens ficam como *secret* no Cloudflare — **nunca** no repositório.
- `ALLOWED_ORIGINS` (no `wrangler.toml`) restringe quem pode chamar a API.
  Em produção mantenha só `https://iagocallado.github.io`.

## Arquivos

- `wrangler.toml` — configuração (nome, vars, origens permitidas).
- `src/index.js` — Worker: CORS, validação e adaptadores Frenet/SuperFrete.
- `testar-token.ps1` — teste local do token, sem expor no chat.
