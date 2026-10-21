# Worker de frete — SpaceTek

Cloudflare Worker que faz a cotação real de frete (Frenet ou SuperFrete) para o site.

**Worker publicado em:** `https://spacetek-frete.spacetek.workers.dev`
(subdomínio workers.dev da conta `Callads31@gmail.com's Account`)

O site **não precisa** deste Worker para funcionar: sem o endpoint configurado (ou em caso de
falha), o orçamento usa a tabela estática do painel como estimativa.

## Requisitos

- Conta gratuita no Cloudflare: https://dash.cloudflare.com/sign-up
- Conta em um provedor de cotação:
  - **Frenet** (recomendado, token fixo): https://www.frenet.com.br/ — pegue o **token** em
    *Minha conta → Integrações*.
  - **SuperFrete**: https://web.superfrete.com/ — gere um **token** em *Configurações → Token*.
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
wrangler secret put PROVEDOR_TOKEN
#   -> cole o token do Frenet (ou SuperFrete)

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

## Usar SuperFrete em vez de Frenet

No `wrangler.toml`, troque:

```toml
[vars]
PROVEDOR = "superfrete"
```

Depois `wrangler deploy` novamente e grave o token do SuperFrete com
`wrangler secret put PROVEDOR_TOKEN`.

## Testar

```powershell
# health check
curl https://spacetek-frete.spacetek.workers.dev/health

# cotacao
curl -X POST https://spacetek-frete.spacetek.workers.dev/quote `
  -H "Content-Type: application/json" `
  -d '{\"cepOrigem\":\"18000000\",\"cep\":\"01001000\",\"items\":[{\"width\":16,\"height\":10,\"length\":20,\"weight\":0.6,\"insurance_value\":120,\"quantity\":1}]}'
```

### Testar o token do Frenet direto (sem passar pelo Worker)

```powershell
powershell -ExecutionPolicy Bypass -File .\testar-token.ps1
```
O script pede o token (fica apenas na memória da sua máquina) e chama a Frenet diretamente,
mostrando se o token é aceito ou se a conta está bloqueada.

> O `/health` do Worker também diagnostica: mostra o tamanho do secret e o retorno de
> `GET https://api.frenet.com.br/shipping/info` (200 = token válido; 401 = token recusado).

## Segurança

- O `PROVEDOR_TOKEN` fica como *secret* no Cloudflare — **nunca** no repositório.
- `ALLOWED_ORIGINS` (no `wrangler.toml`) restringe quem pode chamar a API.
  Em produção mantenha só `https://iagocallado.github.io`.

## Arquivos

- `wrangler.toml` — configuração (nome, vars, origens permitidas).
- `src/index.js` — Worker: CORS, validação e adaptadores Frenet/SuperFrete.
