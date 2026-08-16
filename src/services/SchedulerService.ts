export class SchedulerService {
  /**
   * 开始目标时间的倒计时。
   * @param targetTimeStr HH:MM:SS 格式
   * @param onTick 状态更新回调
   * @returns 目标时间到达时解析的 Promise
   */
  static async scheduleTask(targetTimeStr: string, onTick?: (remaining: number) => void, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const targetDate = this.parseTargetTime(targetTimeStr);
      if (!targetDate) {
        return reject(new Error("无效的时间格式"));
      }

      const TRIGGER_THRESHOLD = 0.01;
      let lastLoggedSec = -999;
      let timerId: ReturnType<typeof setTimeout> | undefined;

      const onAbort = () => {
        clearTimeout(timerId);
        cleanup();
        reject(new Error("Task cancelled"));
      };

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const checkLoop = () => {
        if (signal?.aborted) {
          cleanup();
          return reject(new Error("Task cancelled"));
        }

        const now = new Date();
        const diff = targetDate.getTime() - now.getTime();
        const remainingSeconds = diff / 1000;
        const displaySec = Math.floor(remainingSeconds);

        // 触发条件
        if (remainingSeconds <= TRIGGER_THRESHOLD) {
          cleanup();
          resolve(); // 时间到达
          return;
        }

        // 等待
        let nextInterval = 50; // 默认短间隔
        if (remainingSeconds > 30) {
          // 距离还远，沉睡较久
          if (Math.floor(remainingSeconds) % 30 === 0 && Math.floor(remainingSeconds) !== lastLoggedSec) {
            onTick?.(remainingSeconds);
            lastLoggedSec = Math.floor(remainingSeconds);
          }
          nextInterval = 1000;
        } else if (remainingSeconds > 10) {
          nextInterval = 500;
        } else {
          // 最后10秒倒计时
          if (displaySec !== lastLoggedSec && displaySec >= 0) {
            onTick?.(displaySec);
            lastLoggedSec = displaySec;
          }
          // 等待
          nextInterval = Math.max(10, Math.min(50, (remainingSeconds * 1000) / 5));
        }

        timerId = setTimeout(checkLoop, nextInterval);
      };

      // 监听取消事件以立即清理定时器
      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

      checkLoop();
    });
  }

  // 将 HH:MM:SS 解析为 Date 对象
  private static parseTargetTime(timeStr: string): Date | null {
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 3) return null;

    const now = new Date();
    const target = new Date(now);
    target.setHours(parts[0], parts[1], parts[2], 0);

    // 如果目标时间早于当前时间，则假定为明天
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target;
  }
}
