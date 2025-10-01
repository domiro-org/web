import { createContext, useContext, useEffect, type ReactNode } from "react";

export interface WideShellContextValue {
  /** 设置侧栏内容 */
  setSidebar: (content: ReactNode | null) => void;
  /** 清空侧栏 */
  clearSidebar: () => void;
}

export const WideShellContext = createContext<WideShellContextValue | undefined>(undefined);

/**
 * 供页面设置右侧侧栏内容的 Hook，组件卸载时自动清理。
 * @param content 需要展示的侧栏节点
 */
export function useWideShellSidebar(content: ReactNode | null) {
  const context = useContext(WideShellContext);

  useEffect(() => {
    if (!context) {
      return undefined;
    }

    context.setSidebar(content);
    return () => {
      context.clearSidebar();
    };
  }, [content, context]);
}
