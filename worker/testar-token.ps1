# Testa o token do Frenet direto na sua maquina (o token nao sai do computador).
# Uso:  powershell -ExecutionPolicy Bypass -File .\worker\testar-token.ps1
$ErrorActionPreference = "Stop"

$sec = Read-Host "Cole o TOKEN da Frenet (Dados Cadastrais > Chaves de Acesso > TOKEN)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
$token = $token.Trim()

Write-Host ""
Write-Host "Token: $($token.Length) caracteres" -ForegroundColor Cyan

Write-Host "`n1) GET /shipping/info (servicos da conta)" -ForegroundColor Yellow
& curl.exe -s -m 30 "https://api.frenet.com.br/shipping/info" -H "token: $token"
Write-Host ""

Write-Host "2) POST /shipping/quote (cotacao de teste)" -ForegroundColor Yellow
$body = '{"SellerCEP":"18000000","RecipientCEP":"01001000","ShipmentInvoiceValue":120,"RecipientCountry":"BR","ShippingItemArray":[{"Height":10,"Length":20,"Width":16,"Weight":0.6,"Quantity":1}]}'
& curl.exe -s -m 30 -X POST "https://api.frenet.com.br/shipping/quote" -H "Content-Type: application/json" -H "token: $token" -d $body
Write-Host ""

Write-Host "`nComo interpretar:" -ForegroundColor Green
Write-Host "  - lista de servicos / ShippingSevicesArray  -> token OK, a cotacao real funciona."
Write-Host "  - {'Message':'Acesso negado!'}                 -> token invalido ou conta sem liberacao."
Write-Host "    (nesse caso: confira se voce copiou o campo TOKEN, e nao a chave ou a senha;"
Write-Host "     confirme e-mail/celular validados; e, se houver mensalidade em atraso,"
Write-Host "     o token e bloqueado - fale com o suporte da Frenet: frenet.com.br/suporte)"
$token = $null
