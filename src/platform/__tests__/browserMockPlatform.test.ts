import { describe, expect, it, vi } from 'vitest';
import { BrowserMockPlatform } from '../browserMockPlatform';
import type { RemoteKey } from '../types';

describe('BrowserMockPlatform', () => {
  it('mapeia teclas direcionais, OK e Voltar corretamente', () => {
    const platform = new BrowserMockPlatform();
    platform.init();

    const received: RemoteKey[] = [];
    platform.onRemoteKey((key) => received.push(key));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));

    expect(received).toEqual(['RIGHT', 'OK', 'BACK', 'NUM_1']);
    platform.dispose();
  });

  it('permite cancelar inscrição de listener com unsubscribe', () => {
    const platform = new BrowserMockPlatform();
    platform.init();

    const listener = vi.fn();
    const unsubscribe = platform.onRemoteKey(listener);
    unsubscribe();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(listener).not.toHaveBeenCalled();

    platform.dispose();
  });

  it('retorna informações de dispositivo para ambiente browser', () => {
    const platform = new BrowserMockPlatform();
    const info = platform.getDeviceInfo();

    expect(info.platform).toBe('browser');
    expect(info.modelName).toBe('Browser Simulator');
  });
});
