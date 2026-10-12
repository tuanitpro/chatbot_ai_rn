import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ChatbotAuthProvider } from './auth';
import { ChatbotConfig } from './config';
import {
  fullscreenValue,
  isTrustedPage,
  readBridgeMessage,
  scriptJson,
} from './bridge';
import { ChatbotModal, useChatbotModal } from './ChatbotModal';
import { createWidgetHost } from './widgetHost';

export interface ChatbotPopupV2Props {
  config: ChatbotConfig;
  auth: ChatbotAuthProvider;
  onClose: () => void;
  onAuthError?: () => void;
}

export function ChatbotPopupV2({
  config,
  auth,
  onClose,
  onAuthError,
}: ChatbotPopupV2Props) {
  const popup = useChatbotModal();
  const { bridgeId, setFullscreen, fail, finishLoading } = popup;
  const webView = useRef<WebView<object>>(null);
  const active = useRef(true);
  const currentBridge = useRef(bridgeId);
  currentBridge.current = bridgeId;
  const source = useMemo(
    () => ({
      html: createWidgetHost(config, bridgeId),
      baseUrl: `${config.baseUrl}/react-native-chatbot-v2`,
    }),
    [config, bridgeId],
  );

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function onMessage(event: WebViewMessageEvent) {
    const message = readBridgeMessage(
      event,
      config,
      '/react-native-chatbot-v2',
      bridgeId,
    );
    if (!message) {
      return;
    }
    switch (message.type) {
      case 'CHAT_CLOSE':
        onClose();
        return;
      case 'TOGGLE_FULLSCREEN': {
        const value = fullscreenValue(message);
        if (value !== undefined) {
          setFullscreen(value);
        }
        return;
      }
      case 'initialized':
        finishLoading();
        return;
      case 'error':
        fail();
        return;
      case 'request':
        break;
      default:
        return;
    }
    if (typeof message.id !== 'string' || !/^[0-9]{1,10}$/.test(message.id)) {
      return;
    }
    const method = message.method;
    if (
      method !== 'getToken' &&
      method !== 'onTokenRefresh' &&
      method !== 'getLanguage' &&
      method !== 'getEmployeeCode'
    ) {
      return;
    }
    let value: string | null = null;
    let requestError: string | undefined;
    try {
      value = await auth[method]();
      if ((method === 'getToken' || method === 'onTokenRefresh') && !value) {
        throw new Error('Authentication unavailable');
      }
    } catch {
      requestError = 'Native provider failed';
      if (method === 'getToken' || method === 'onTokenRefresh') {
        if (active.current && currentBridge.current === bridgeId) {
          onAuthError?.();
          fail();
        }
      }
    }
    // Discard service results after close or retry, even if the old promise resolves late.
    if (!active.current || currentBridge.current !== bridgeId) {
      return;
    }
    const response = scriptJson({
      bridgeId,
      id: message.id,
      value,
      error: requestError,
    });
    webView.current?.injectJavaScript(
      `window.__chatbotNativeReply?.(${response}); true;`,
    );
  }

  return (
    <ChatbotModal
      {...popup}
      onRetry={popup.retry}
      onClose={onClose}
      errorDescription="Kiểm tra kết nối và cấu hình xác thực, sau đó thử lại."
    >
      <WebView<object>
        key={bridgeId}
        ref={webView}
        source={source}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows
        onOpenWindow={() => {}}
        allowFileAccess={false}
        mixedContentMode="never"
        onMessage={onMessage}
        onShouldStartLoadWithRequest={request =>
          request.isTopFrame === false ||
          isTrustedPage(request.url, config, '/react-native-chatbot-v2') ||
          request.url === 'about:blank'
        }
        onError={fail}
        onHttpError={event => {
          const url = event.nativeEvent.url;
          if (
            isTrustedPage(url, config, '/react-native-chatbot-v2') ||
            url.startsWith(`${config.baseUrl}/widget.js?`)
          ) {
            fail();
          }
        }}
        onContentProcessDidTerminate={fail}
        onRenderProcessGone={fail}
      />
    </ChatbotModal>
  );
}
const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#fff' },
});
