import React from 'react';
import { runInNewContext } from 'node:vm';
import { StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ChatbotPopupV1 } from '../src/chatbot/ChatbotPopupV1';
import { ChatbotPopupV2 } from '../src/chatbot/ChatbotPopupV2';
import { ChatbotModal } from '../src/chatbot/ChatbotModal';
import { createDemoAuthProvider } from '../src/chatbot/auth';
import { chatbotConfig, chatbotUrl } from '../src/chatbot/config';
import {
  isTrustedPage,
  isTrustedMessage,
  scriptJson,
} from '../src/chatbot/bridge';
import { createDirectBridge } from '../src/chatbot/directBridge';
import { createWidgetHost } from '../src/chatbot/widgetHost';

const mockInject = jest.fn();
jest.mock('react-native-webview', () => {
  const ReactModule: typeof React = require('react');
  return {
    WebView: ReactModule.forwardRef((_props, ref) => {
      ReactModule.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInject,
      }));
      return null;
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockInject.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

function getBridgeId(renderer: TestRenderer.ReactTestRenderer) {
  const html = renderer.root.findByType(WebView).props.source.html as string;
  return JSON.parse(html.match(/const bridgeId = (.+);/)![1]) as string;
}
function send(
  renderer: TestRenderer.ReactTestRenderer,
  data: object,
  url = `${chatbotConfig.baseUrl}/react-native-chatbot-v2`,
) {
  return renderer.root.findByType(WebView).props.onMessage({
    nativeEvent: {
      url,
      data: JSON.stringify({
        pageUrl: `${chatbotConfig.baseUrl}/react-native-chatbot-v2`,
        ...data,
      }),
    },
  } as WebViewMessageEvent);
}

test('V2 returns native context and the latest token after refresh, rejecting untrusted requests', async () => {
  const auth = createDemoAuthProvider();
  const getToken = jest.spyOn(auth, 'getToken');
  const onClose = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = TestRenderer.create(
      <ChatbotPopupV2 config={chatbotConfig} auth={auth} onClose={onClose} />,
    );
  });
  const bridgeId = getBridgeId(renderer);
  await act(async () => {
    await send(
      renderer,
      { bridgeId, type: 'request', id: '1', method: 'getToken' },
      'https://evil.test/react-native-chatbot-v2',
    );
    await send(renderer, {
      bridgeId: 'stale',
      type: 'request',
      id: '1',
      method: 'getToken',
    });
    await send(renderer, {
      bridgeId,
      type: 'request',
      id: '1',
      method: 'constructor',
    });
  });
  expect(getToken).not.toHaveBeenCalled();
  expect(mockInject).not.toHaveBeenCalled();
  await act(async () => {
    await send(
      renderer,
      { bridgeId, type: 'request', id: '3', method: 'getToken' },
      chatbotConfig.baseUrl,
    );
  });
  expect(getToken).toHaveBeenCalledTimes(1);
  for (const [method, expected] of [
    ['getToken', 'fake-chatbot-token-0'],
    ['onTokenRefresh', 'fake-chatbot-token-1'],
    ['getToken', 'fake-chatbot-token-1'],
    ['getLanguage', 'vi'],
    ['getEmployeeCode', 'TLG-100215'],
  ]) {
    await act(async () => {
      await send(renderer, { bridgeId, type: 'request', id: '2', method });
    });
    expect(mockInject).toHaveBeenLastCalledWith(
      expect.stringContaining(`"value":"${expected}"`),
    );
  }
  await act(async () => {
    await send(renderer, {
      bridgeId,
      type: 'TOGGLE_FULLSCREEN',
      data: { isFullscreen: true },
    });
  });
  expect(
    renderer.root
      .findAllByType(View)
      .some(view => StyleSheet.flatten(view.props.style)?.height === '100%'),
  ).toBe(true);
  await act(async () => {
    await send(renderer, { bridgeId, type: 'CHAT_CLOSE' });
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(() => renderer.unmount());
});

test('timeout offers retry; retry drops pending replies from the old WebView', async () => {
  let resolveToken!: (value: string) => void;
  const auth = {
    ...createDemoAuthProvider(),
    getToken: () =>
      new Promise<string>(resolve => {
        resolveToken = resolve;
      }),
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = TestRenderer.create(
      <ChatbotPopupV2 config={chatbotConfig} auth={auth} onClose={jest.fn()} />,
    );
  });
  const bridgeId = getBridgeId(renderer);
  const pending = send(renderer, {
    bridgeId,
    type: 'request',
    id: '1',
    method: 'getToken',
  });
  await act(() => {
    jest.advanceTimersByTime(30000);
  });
  const retry = renderer.root.findByProps({ testID: 'chatbot-retry' });
  await act(() => retry.props.onPress());
  expect(getBridgeId(renderer)).not.toBe(bridgeId);
  await act(async () => {
    resolveToken('secret');
    await pending;
  });
  expect(mockInject).not.toHaveBeenCalled();
  await act(() => renderer.unmount());
});

test('failed refresh reports expired authentication and exposes recovery', async () => {
  const onAuthError = jest.fn();
  const auth = {
    ...createDemoAuthProvider(),
    onTokenRefresh: async () => {
      throw new Error('expired');
    },
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = TestRenderer.create(
      <ChatbotPopupV2
        config={chatbotConfig}
        auth={auth}
        onClose={jest.fn()}
        onAuthError={onAuthError}
      />,
    );
  });
  await act(async () => {
    await send(renderer, {
      bridgeId: getBridgeId(renderer),
      type: 'request',
      id: '1',
      method: 'onTokenRefresh',
    });
  });
  expect(onAuthError).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByProps({ testID: 'chatbot-retry' })).toBeTruthy();
  expect(mockInject).toHaveBeenLastCalledWith(
    expect.stringContaining('Native provider failed'),
  );
  await act(() => renderer.unmount());
});

test('host JavaScript initializes widget callbacks and resolves native RPC promises', async () => {
  const postMessage = jest.fn();
  const init = jest.fn().mockResolvedValue({});
  const script: {
    src?: string;
    onload?: () => Promise<void>;
    onerror?: () => void;
  } = {};
  const windowStub = {
    location: { href: `${chatbotConfig.baseUrl}/react-native-chatbot-v2` },
    ReactNativeWebView: { postMessage },
    ChatWidget: { init },
    __chatbotNativeReply: (_response: object) => {},
  };
  const documentStub = {
    createElement: () => script,
    head: { appendChild: jest.fn() },
  };
  const html = createWidgetHost(chatbotConfig, 'test-bridge');
  const code = html.split('<script>')[1].split('</script>')[0];
  // Execute the actual generated host script with a fake DOM, not a duplicate implementation.
  runInNewContext(code, {
    window: windowStub,
    document: documentStub,
    setTimeout,
    clearTimeout,
  });
  expect(script.src).toContain('auto_init=false');
  await script.onload!();
  const callbacks = init.mock.calls[0][0];
  const tokenPromise = callbacks.getToken();
  const request = JSON.parse(postMessage.mock.calls.at(-1)![0]);
  expect(request.method).toBe('getToken');
  windowStub.__chatbotNativeReply({ ...request, value: 'access-token' });
  await expect(tokenPromise).resolves.toBe('access-token');
  callbacks.onClose();
  expect(JSON.parse(postMessage.mock.calls.at(-1)![0]).type).toBe('CHAT_CLOSE');
  script.onerror!();
  expect(JSON.parse(postMessage.mock.calls.at(-1)![0]).type).toBe('error');
});

test('direct bridge accepts only controls from the same window, origin and bot', () => {
  const listeners: Record<string, (event: object) => void> = {};
  const postMessage = jest.fn();
  const windowStub = {
    location: { origin: chatbotConfig.baseUrl, pathname: '/embed' },
    ReactNativeWebView: { postMessage },
    addEventListener: (name: string, callback: (event: object) => void) => {
      listeners[name] = callback;
    },
  };
  runInNewContext(createDirectBridge(chatbotConfig, 'direct'), {
    window: windowStub,
  });
  const event = {
    source: windowStub,
    origin: chatbotConfig.baseUrl,
    data: { source: chatbotConfig.botId, type: 'CHAT_CLOSE' },
  };
  listeners.message({ ...event, source: {} });
  listeners.message({ ...event, origin: 'https://evil.test' });
  listeners.message({ ...event, data: { ...event.data, source: 'wrong-bot' } });
  expect(postMessage).not.toHaveBeenCalled();
  listeners.message(event);
  expect(JSON.parse(postMessage.mock.calls[0][0]).type).toBe('CHAT_CLOSE');
});

test('URL encoding, inline script escaping and origin checks handle hostile inputs', () => {
  const config = { ...chatbotConfig, sessionId: 'user&token=secret</script>' };
  expect(chatbotUrl(config)).toContain(
    'session_id=user%26token%3Dsecret%3C%2Fscript%3E',
  );
  expect(scriptJson('</script>')).not.toContain('<');
  expect(
    isTrustedPage('https://chat.antt.tech.evil.test/embed', config, '/embed'),
  ).toBe(false);
  expect(isTrustedPage(`${config.baseUrl}/embed`, config, '/embed')).toBe(true);
  expect(
    isTrustedPage(
      `${config.baseUrl}/embed`,
      config,
      '/react-native-chatbot-v2',
    ),
  ).toBe(false);
  expect(
    isTrustedMessage(
      config.baseUrl,
      `${config.baseUrl}/react-native-chatbot-v2`,
      config,
      '/react-native-chatbot-v2',
    ),
  ).toBe(true);
  expect(
    isTrustedMessage(
      config.baseUrl,
      `${config.baseUrl}/embed`,
      config,
      '/react-native-chatbot-v2',
    ),
  ).toBe(false);
});

test('V1 opens direct chat without auth, handles controls and retries a failed load', async () => {
  const onClose = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = TestRenderer.create(
      <ChatbotPopupV1 config={chatbotConfig} onClose={onClose} />,
    );
  });
  const webview = () => renderer.root.findByType(WebView);
  expect(webview().props.source.uri).toBe(chatbotUrl(chatbotConfig));
  expect(webview().props.source.html).toBeUndefined();
  const originalBridge = webview().props.injectedJavaScript as string;
  const bridgeId = JSON.parse(
    originalBridge.match(/bridgeId:\s*("[^"]+")/)![1],
  ) as string;
  await act(() => webview().props.onLoadEnd());
  expect(renderer.root.findByType(ChatbotModal).props.loading).toBe(false);
  await act(async () => {
    await send(
      renderer,
      {
        bridgeId,
        pageUrl: `${chatbotConfig.baseUrl}/embed`,
        type: 'TOGGLE_FULLSCREEN',
        data: { isFullscreen: true },
      },
      chatbotConfig.baseUrl,
    );
  });
  expect(renderer.root.findByType(ChatbotModal).props.fullscreen).toBe(true);
  await act(async () => {
    // V1 ignores RPC even when the envelope is otherwise trusted.
    await send(
      renderer,
      {
        bridgeId,
        pageUrl: `${chatbotConfig.baseUrl}/embed`,
        type: 'request',
        id: '1',
        method: 'getToken',
      },
      chatbotConfig.baseUrl,
    );
  });
  expect(mockInject).not.toHaveBeenCalled();
  await act(() => webview().props.onError());
  await act(() =>
    renderer.root.findByProps({ testID: 'chatbot-retry' }).props.onPress(),
  );
  expect(webview().props.injectedJavaScript).not.toBe(originalBridge);
  expect(renderer.root.findByType(ChatbotModal).props.loading).toBe(true);
  const nextBridge = JSON.parse(
    (webview().props.injectedJavaScript as string).match(
      /bridgeId:\s*("[^"]+")/,
    )![1],
  ) as string;
  await act(async () => {
    await send(
      renderer,
      {
        bridgeId: nextBridge,
        pageUrl: `${chatbotConfig.baseUrl}/embed`,
        type: 'CHAT_CLOSE',
      },
      chatbotConfig.baseUrl,
    );
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(() => renderer.unmount());
});
