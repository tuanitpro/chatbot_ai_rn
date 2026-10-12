import { ChatbotConfig } from './config';
import { scriptJson } from './bridge';

export function createDirectBridge(
  config: ChatbotConfig,
  bridgeId: string,
): string {
  return `(() => {
    if (window.location.origin !== ${scriptJson(config.baseUrl)} ||
        window.location.pathname !== '/embed' || window.__rnChatbotInstalled) return;
    window.__rnChatbotInstalled = true;
    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.source !== ${scriptJson(config.botId)}) return;
      if (message.type !== 'CHAT_CLOSE' && message.type !== 'TOGGLE_FULLSCREEN') return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: message.type, data: message.data, pageUrl: window.location.href, bridgeId: ${scriptJson(
          bridgeId,
        )}
      }));
    });
  })(); true;`;
}
