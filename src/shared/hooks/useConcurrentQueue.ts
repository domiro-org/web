import { useCallback, useRef } from "react";

/**
 * 简易并发队列，保证同一时刻不超过指定并发数运行任务。
 * @param concurrency 最大并发数
 */
export function useConcurrentQueue(concurrency: number) {
  const activeCountRef = useRef(0);
  const queueRef = useRef<Array<() => void>>([]);

  const processQueue = useCallback(() => {
    // 清理已完成的任务并触发下一批
    if (activeCountRef.current >= concurrency) {
      return;
    }

    const next = queueRef.current.shift();
    if (!next) {
      return;
    }

    next();
  }, [concurrency]);

  const enqueue = useCallback(
    <T,>(task: () => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const run = () => {
          activeCountRef.current += 1;
          task()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              activeCountRef.current = Math.max(activeCountRef.current - 1, 0);
              processQueue();
            });
        };

        if (activeCountRef.current < concurrency) {
          run();
        } else {
          queueRef.current.push(run);
        }
      });
    },
    [concurrency, processQueue]
  );

  const clear = useCallback(() => {
    queueRef.current = [];
  }, []);

  return { enqueue, clear } as const;
}
