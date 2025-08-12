# -*- coding: utf-8 -*-
"""
主程序入口

根据命令行参数启动 Web UI 或命令行界面 (CLI)。
"""
import sys
import os

import logger_config

# print("代码正在被这个 Python 解释器运行:", sys.executable)
# print("解释器正在这些路径中寻找库:", sys.path)

def main():
    """程序主函数，解析命令行参数并启动相应模式。"""
    # 检查是否传入了 '--web' 参数
    if '--web' in sys.argv:
        print("--- 启动 Web 服务器模式 ---")
        try:
            import uvicorn
            from web_app import app # 从 web_app 模块导入 FastAPI 实例
            
            # 动态获取 web_app.py 的路径用于 uvicorn
            # 这使得即使用户不在项目根目录也能正确启动
            app_module_str = "web_app:app"
            
            print("\n  请在浏览器中打开 http://127.0.0.1:8000")
            print("  (使用 --host 0.0.0.0 参数可允许局域网访问)")
            print("-" * 50)
            
            # 获取额外的 uvicorn 参数
            uvicorn_args = {
                "host": "127.0.0.1",
                "port": 8000,
                "reload": True
            }

            if "--host" in sys.argv:
                try:
                    host_index = sys.argv.index("--host") + 1
                    if host_index < len(sys.argv):
                        uvicorn_args["host"] = sys.argv[host_index]
                except (ValueError, IndexError):
                    print("警告: --host 参数使用不正确，将使用默认值 127.0.0.1")

            uvicorn.run(app_module_str, **uvicorn_args)

        except ImportError:
            print("\n❌ 错误：启动 Web 界面需要 uvicorn 和 fastapi。")
            print("请先安装依赖: pip install uvicorn fastapi")
        except Exception as e:
            print(f"\n❌ 启动 Web 服务器时发生未知错误: {e}")

    else:
        print("--- 启动命令行界面 (CLI) 模式 ---")
        print("(提示: 使用 'python main.py --web' 参数可启动 Web 界面)")
        print("-" * 50)
        try:
            from cli import run_cli
            run_cli()
        except ImportError as e:
            print(f"\n❌ 错误：无法导入 CLI 模块: {e}")
        except Exception as e:
            print(f"\n❌ 运行 CLI 时发生未知错误: {e}")

if __name__ == "__main__":
    main()