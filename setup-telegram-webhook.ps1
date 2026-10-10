
$ErrorActionPreference = "Stop"

$tokenSecure = Read-Host "Введи TELEGRAM_BOT_TOKEN" -AsSecureString
$secretSecure = Read-Host "Введи TELEGRAM_WEBHOOK_SECRET" -AsSecureString

$tokenPtr = [IntPtr]::Zero
$secretPtr = [IntPtr]::Zero

try {
    $tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
    $secretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretSecure)

    $botToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
    $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr)

    if ([string]::IsNullOrWhiteSpace($botToken) -or
        [string]::IsNullOrWhiteSpace($secret)) {
        throw "Токен и секрет не должны быть пустыми."
    }

    $body = @{
        url = "https://psychologytarasovmaxim.vercel.app/api/telegram-webhook"
        secret_token = $secret
        drop_pending_updates = $false
    } | ConvertTo-Json

    $result = Invoke-RestMethod `
        -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body

    if ($result.ok) {
        Write-Host "Webhook успешно зарегистрирован!"
    } else {
        Write-Host "Telegram не подтвердил регистрацию."
        Write-Host $result.description
    }
}
catch {
    Write-Host "Ошибка настройки webhook:"
    Write-Host $_.Exception.Message
}
finally {
    if ($tokenPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr)
    }
    if ($secretPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr)
    }
    $botToken = $null
    $secret = $null
}