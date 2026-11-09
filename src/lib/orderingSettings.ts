export interface OrderingSettings {
  visible: boolean;
  tallyUrl: string;
}

export type OrderingSettingsUpdate = Partial<OrderingSettings>;

export function isTallyFormUrl(value: string): boolean {
  if (value.length > 2048 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'tally.so' || url.hostname === 'www.tally.so')
      && !url.username && !url.password && !url.port
      && /^\/r\/[a-zA-Z0-9]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function isOrderingSettings(value: unknown): value is OrderingSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<OrderingSettings>;
  return typeof settings.visible === 'boolean'
    && typeof settings.tallyUrl === 'string'
    && (settings.tallyUrl === '' || isTallyFormUrl(settings.tallyUrl));
}

// Keep the audit entry useful without recording query parameters from a form URL.
export function orderingAuditDetail(settings: OrderingSettings): string {
  return `visible=${settings.visible}; destination=${settings.tallyUrl ? 'tally' : 'coming-soon'}`;
}
