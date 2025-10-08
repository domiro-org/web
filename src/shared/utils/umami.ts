/**
 * @description 向页面注入 Umami 统计脚本。
 * @param source - 脚本地址
 * @param siteId - Umami 站点标识
 */
export const injectUmamiScript = (source: string, siteId: string): void => {
  if (document.querySelector(`script[data-website-id="${siteId}"]`)) {
    return
  }

  const script = document.createElement("script")
  script.defer = true
  script.src = source
  script.dataset.websiteId = siteId
  // 将统计脚本追加到页面头部，保证在应用初始化后加载
  document.head.append(script)
}
