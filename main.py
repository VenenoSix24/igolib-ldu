# -*- coding: utf-8 -*-
"""
主程序入口

默认启动 Web API 服务器。
如需使用命令行界面 (CLI)，请加上 --cli 参数。
"""
import sys
import os
import logger_config

def main():
    """程序主函数，解析命令行参数并启动相应模式。"""
    
    # 检查是否传入了 '--cli' 参数
    if '--cli' in sys.argv:
        print("--- 启动命令行界面 (CLI) 模式 ---")
        print("(提示: 直接运行 'python main.py' 即可启动 Web 界面)")
        print("-" * 50)
        try:
            from cli import run_cli
            run_cli()
        except ImportError as e:
            print(f"\n❌ 错误：无法导入 CLI 模块: {e}")
        except Exception as e:
            print(f"\n❌ 运行 CLI 时发生未知错误: {e}")
    else:
        # 默认行为: 启动 Web 服务器
        print("--- 启动 Web 服务器模式 ---")
        try:
            import uvicorn
            # 动态获取 web_app.py 的路径用于 uvicorn
            app_module_str = "web_app:app"
            
            print("\n  API 服务已启动，请确保前端 React 服务也在运行。")
            print("  后端 API 文档: http://127.0.0.1:8000/docs")
            print("  (使用 --host 0.0.0.0 参数可允许局域网访问)")
            print("  (使用 --cli 参数可启动命令行模式)")
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

if __name__ == "__main__":
    main()