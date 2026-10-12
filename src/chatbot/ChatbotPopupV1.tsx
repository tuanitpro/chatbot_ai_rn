import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ChatbotConfig, chatbotUrl } from './config';
import { fullscreenValue, isTrustedPage, readBridgeMessage } from './bridge';
import { ChatbotModal, useChatbotModal } from './ChatbotModal';
import { createDirectBridge } from './directBridge';

export interface ChatbotPopupV1Props {
  config: ChatbotConfig;
  onClose: () => void;
}

export function ChatbotPopupV1({ config, onClose }: ChatbotPopupV1Props) {
  const popup = useChatbotModal();
  const { bridgeId, setFullscreen, fail, finishLoading } = popup;
  const source = useMemo(() => ({ uri: chatbotUrl(config) }), [config]);
  const directBridge = useMemo(
    () => createDirectBridge(config, bridgeId),
    [config, bridgeId],
  );

  function onMessage(event: WebViewMessageEvent) {
    const message = readBridgeMessage(event, config, '/embed', bridgeId);
    if (!message) {
      return;
    }
    if (message.type === 'CHAT_CLOSE') {
      onClose();
    }
    if (message.type === 'TOGGLE_FULLSCREEN') {
      const value = fullscreenValue(message);
      if (value !== undefined) {
        setFullscreen(value);
      }
    }
  }

  return (
    <ChatbotModal {...popup} onRetry={popup.retry} onClose={onClose}>
      <WebView<object>
        key={bridgeId}
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
        injectedJavaScriptBeforeContentLoaded={directBridge}
        injectedJavaScript={directBridge}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={request =>
          request.isTopFrame === false ||
          isTrustedPage(request.url, config, '/embed')
        }
        onLoadEnd={finishLoading}
        onError={fail}
        onHttpError={event => {
          if (isTrustedPage(event.nativeEvent.url, config, '/embed')) {
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
