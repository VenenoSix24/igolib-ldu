@echo off
echo Disabling system proxy...

:: 禁用代理
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f
if %errorlevel% neq 0 (
    echo ERROR: Failed to disable proxy (set ProxyEnable to 0). Run as administrator?
    goto End
)

:: 可选：清除代理服务器地址（禁用后通常不需要，但更干净）
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer /t REG_SZ /d "" /f

:: 可选：清除本地地址绕过设置
:: reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyOverride /f

echo Proxy disabled successfully.

:End
pause