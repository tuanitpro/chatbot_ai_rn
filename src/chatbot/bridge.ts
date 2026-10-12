import { WebViewMessageEvent } from 'react-native-webview';
import { ChatbotConfig } from './config';

// Safe to interpolate inside an inline script, including dynamic session IDs.
export const scriptJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');

export function isTrustedPage(
  url: string,
  config: ChatbotConfig,
  path: string,
): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === config.baseUrl && parsed.pathname === path;
  } catch {
    return false;
  }
}

// WebView 14 on recent Android returns the sender ORIGIN in nativeEvent.url,
// while iOS/older Android return a full URL. Validate the document path separately.
export function isTrustedMessage(
  nativeUrl: string,
  pageUrl: unknown,
  config: ChatbotConfig,
  path: string,
): boolean {
  try {
    return (
      new URL(nativeUrl).origin === config.baseUrl &&
      typeof pageUrl === 'string' &&
      isTrustedPage(pageUrl, config, path)
    );
  } catch {
    return false;
  }
}

export function readBridgeMessage(
  event: WebViewMessageEvent,
  config: ChatbotConfig,
  path: string,
  bridgeId: string,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(event.nativeEvent.data);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const message = parsed as Record<string, unknown>;
    return message.bridgeId === bridgeId &&
      isTrustedMessage(event.nativeEvent.url, message.pageUrl, config, path)
      ? message
      : null;
  } catch {
    return null;
  }
}

export function fullscreenValue(
  message: Record<string, unknown>,
): boolean | undefined {
  const data = message.data;
  return data &&
    typeof data === 'object' &&
    'isFullscreen' in data &&
    typeof data.isFullscreen === 'boolean'
    ? data.isFullscreen
    : undefined;
}
