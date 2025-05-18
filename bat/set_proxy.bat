@echo off
echo Setting system proxy for mitmproxy (127.0.0.1:8080)...

:: 设置代理服务器地址和端口
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:8080" /f
if %errorlevel% neq 0 (
    echo ERROR: Failed to set ProxyServer registry key. Run as administrator?
    goto End
)

:: 启用代理
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f
if %errorlevel% neq 0 (
    echo ERROR: Failed to set ProxyEnable registry key. Run as administrator?
    :: 尝试回滚 ProxyServer 设置（可选）
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer /t REG_SZ /d "" /f
    goto End
)

:: 可选：设置不对本地地址使用代理 (通常需要)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyOverride /t REG_SZ /d "<local>" /f

echo Proxy enabled successfully. (127.0.0.1:8080)
echo Note: Some applications may need a restart to use the new proxy settings.

:End
pause