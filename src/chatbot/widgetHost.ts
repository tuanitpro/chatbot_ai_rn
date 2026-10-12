import { ChatbotConfig, chatbotUrl } from './config';
import { scriptJson } from './bridge';

export function createWidgetHost(
  config: ChatbotConfig,
  bridgeId: string,
): string {
  return `<!doctype html>
<html lang="${config.language === 'en' ? 'en' : 'vi'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden}</style></head>
<body><script>
(() => {
  const bridgeId = ${scriptJson(bridgeId)};
  const pending = new Map();
  let sequence = 0;
  const send = message => window.ReactNativeWebView.postMessage(JSON.stringify({...message, bridgeId, pageUrl: window.location.href}));
  const callNative = method => new Promise((resolve, reject) => {
    const id = String(++sequence);
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Native request timed out')); }, 20000);
    pending.set(id, {resolve, reject, timer});
    send({type: 'request', id, method});
  });
  window.__chatbotNativeReply = response => {
    if (response.bridgeId !== bridgeId) return;
    const task = pending.get(response.id);
    if (!task) return;
    pending.delete(response.id);
    clearTimeout(task.timer);
    if (response.error) task.reject(new Error(response.error));
    else task.resolve(response.value);
  };
  window.ChatWidgetAutoInit = false;
  const script = document.createElement('script');
  script.src = ${scriptJson(chatbotUrl(config, true))};
  script.async = true;
  script.onerror = () => send({type: 'error'});
  script.onload = async () => {
    try {
      if (!window.ChatWidget) throw new Error('Widget unavailable');
      const widget = await window.ChatWidget.init({
        getToken: () => callNative('getToken'),
        onTokenRefresh: () => callNative('onTokenRefresh'),
        getLanguage: () => callNative('getLanguage'),
        getEmployeeCode: () => callNative('getEmployeeCode'),
        onClose: () => send({type: 'CHAT_CLOSE'}),
        onFullscreenChange: data => send({type: 'TOGGLE_FULLSCREEN', data}),
      });
      if (!widget) throw new Error('Widget initialization failed');
      send({type: 'initialized'});
    } catch (_) { send({type: 'error'}); }
  };
  document.head.appendChild(script);
})();
</script></body></html>`;
}
