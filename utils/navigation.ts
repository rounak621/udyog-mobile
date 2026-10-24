/**
 * Safely navigates back if there is navigation history on the stack,
 * or replaces to fallbackPath if the screen was opened directly without history.
 */
export function safeBack(
  router: { canGoBack?: () => boolean; back: () => void; replace: (href: any) => void },
  fallbackPath: string = '/(tabs)'
): void {
  if (typeof router.canGoBack === 'function' && router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackPath as any);
  }
}
