package com.igolib.ldu

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : TauriActivity() {
    private var isReady = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        // 安装 SplashScreen API (Android 12+)
        val splashScreen = installSplashScreen()
        
        // 保持 Splash 直到内容准备好
        splashScreen.setKeepOnScreenCondition { !isReady }
        
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        
        // 设置窗口背景为白色，避免渲染时的空白帧
        window.decorView.setBackgroundColor(android.graphics.Color.WHITE)
        
        // 延迟标记准备完成，给 WebView 足够时间渲染
        window.decorView.post {
            // 使用 postDelayed 确保 WebView 已经开始渲染
            window.decorView.postDelayed({
                isReady = true
            }, 300) // 300ms 延迟足够 WebView 初始化
        }
    }
}
