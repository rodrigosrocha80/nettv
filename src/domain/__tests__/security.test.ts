import { describe, expect, it } from 'vitest';
import { hashPin, sanitizeUrl, validateSourceUrl, verifyPin } from '../security';

describe('security utilities', () => {
  it('sanitizes credentials and query strings from URLs', () => {
    expect(
      sanitizeUrl('https://user:secret@iptv.example.com:8080/get.php?username=a&password=b'),
    ).toBe('https://***:***@iptv.example.com:8080/get.php?***');
    expect(sanitizeUrl('http://host.com/live/myuser/mypass/12345.m3u8')).toBe(
      'http://host.com/live/***/***/12345.m3u8',
    );
    expect(sanitizeUrl('not a valid url?token=123')).toBe('not a valid url?***');
  });

  it('validates http and https source URLs', () => {
    expect(validateSourceUrl('https://example.com/list.m3u')).toEqual({
      valid: true,
      isHttp: false,
      normalizedUrl: 'https://example.com/list.m3u',
    });
    expect(validateSourceUrl('http://example.com/list.m3u')).toEqual({
      valid: true,
      isHttp: true,
      normalizedUrl: 'http://example.com/list.m3u',
    });
    expect(validateSourceUrl('ftp://example.com/list.m3u').valid).toBe(false);
    expect(validateSourceUrl('   ').valid).toBe(false);
  });

  it('hashes and verifies parental PIN consistently', async () => {
    const hash = await hashPin('1234');
    expect(hash).toHaveLength(64);
    expect(await verifyPin('1234', hash)).toBe(true);
    expect(await verifyPin('0000', hash)).toBe(false);
  });
});
