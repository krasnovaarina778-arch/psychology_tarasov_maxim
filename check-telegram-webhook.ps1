
$secure = Read-Host "Введи TELEGRAM_BOT_TOKEN" -AsSecureString
$ptr = [IntPtr]::Zero

try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

    $result = Invoke-RestMethod `
        -Uri "https://api.telegram.org/bot$token/getWebhookInfo" `
        -Method Get

    Write-Host "Webhook URL:" $result.result.url
    Write-Host "Последняя ошибка:" $result.result.last_error_message
    Write-Host "Ожидающих обновлений:" $result.result.pending_update_count
}
catch {
    Write-Host "Не удалось проверить webhook."
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $token = $null
}