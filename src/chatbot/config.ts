export interface ChatbotConfig {
  baseUrl: string;
  botId: string;
  clientId: string;
  sessionId: string;
  color: string;
  language: string;
}

// Keep this session stable while the same user is chatting. Replace on login/logout.
export const chatbotConfig: ChatbotConfig = {
  baseUrl: 'https://chat.antt.tech',
  botId: '640fd94e-0b78-4522-83ae-e9860c5ff947',
  clientId: 'ChatBot_App',
  sessionId: `rn-sample-${Date.now()}`,
  color: '088c45',
  language: 'vi',
};

export function chatbotUrl(config: ChatbotConfig, widget = false): string {
  const params: Record<string, string> = {
    id: config.botId,
    mode: 'mobile',
    client_id: config.clientId,
    session_id: config.sessionId,
    color: config.color,
    language: config.language,
    auto_open: 'true',
    v: 'mobile-callbacks-1',
    ...(widget ? { auto_init: 'false' } : {}),
  };
  const query = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  return `${config.baseUrl}/${widget ? 'widget.js' : 'embed'}?${query}`;
}
