interface HostBridge {
  postMessage(msg: unknown): void;
}

function getBridge(): HostBridge | null {
  const w = window as unknown as {
    webkit?: { messageHandlers?: { live?: HostBridge } };
    chrome?: { webview?: HostBridge };
  };
  return w.webkit?.messageHandlers?.live ?? w.chrome?.webview ?? null;
}

export function hasHost(): boolean {
  return getBridge() !== null;
}

function send(method: string, params: unknown[]): void {
  const bridge = getBridge();
  if (!bridge) {
    console.warn('[ipc] no host bridge available; would send', method, params);
    return;
  }
  bridge.postMessage({ method, params });
}

export function closeWithResult(result: unknown): void {
  send('close_and_send', [JSON.stringify(result)]);
}

export function cancel(): void {
  send('close_and_send', ['']);
}
