# Worker de frete — SpaceTek

Cloudflare Worker que faz a cotação real de frete (Frenet ou SuperFrete) para o site.

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

O `wrangler deploy` imprime a URL, algo como:

```
https://spacetek-frete.SUA-CONTA.workers.dev
```

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
curl https://spacetek-frete.SUA-CONTA.workers.dev/health

# cotacao
curl -X POST https://spacetek-frete.SUA-CONTA.workers.dev/quote `
  -H "Content-Type: application/json" `
  -d '{\"cepOrigem\":\"18000000\",\"cep\":\"01001000\",\"items\":[{\"width\":16,\"height\":10,\"length\":20,\"weight\":0.6,\"insurance_value\":120,\"quantity\":1}]}'
```

## Segurança

- O `PROVEDOR_TOKEN` fica como *secret* no Cloudflare — **nunca** no repositório.
- `ALLOWED_ORIGINS` (no `wrangler.toml`) restringe quem pode chamar a API.
  Em produção mantenha só `https://iagocallado.github.io`.

## Arquivos

- `wrangler.toml` — configuração (nome, vars, origens permitidas).
- `src/index.js` — Worker: CORS, validação e adaptadores Frenet/SuperFrete.
