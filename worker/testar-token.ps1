# Testa o token da SuperFrete direto na sua maquina (o token nao sai do computador).
# Uso:  powershell -ExecutionPolicy Bypass -File .\worker\testar-token.ps1
$ErrorActionPreference = "Stop"

$sec = Read-Host "Cole o token da SuperFrete (Integrações > Integrar em Desenvolvedores)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
$token = $token.Trim()

$url = "https://api.superfrete.com/api/v0/calculator"
$ua = "SpaceTek Frete (contato@spacetek.com)"

Write-Host ""
Write-Host "Token: $($token.Length) caracteres" -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Cyan

Write-Host "`n1) POST /calculator (cotacao de teste)" -ForegroundColor Yellow
$body = '{"from":{"postal_code":"01153000"},"to":{"postal_code":"20020050"},"services":"1,2,17","options":{"own_hand":false,"receipt":false,"insurance_value":120,"use_insurance_value":true},"products":[{"quantity":1,"weight":0.3,"height":4,"width":11,"length":17}]}'
& curl.exe -s -m 40 -X POST $url -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -H "User-Agent: $ua" -d $body
Write-Host ""

Write-Host "`nComo interpretar:" -ForegroundColor Green
Write-Host "  - array com {id,name,price,delivery_time,company}  -> token OK, cotacao real funcionando."
Write-Host "  - 401 / 403 / 'token invalido'                    -> token recusado; gere outro em"
Write-Host "    https://web.superfrete.com/#/integrations (Integrar em Desenvolvedores > Confirmar)."
Write-Host "  - has_error:true em um servico                     -> aquele servico nao atende o pacote;"
Write-Host "    o Worker ja descarta esses itens."
$token = $null
