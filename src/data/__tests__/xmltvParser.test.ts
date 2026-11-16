import { describe, expect, it } from 'vitest';
import { parseXmltv, parseXmltvTimestamp } from '../parsers/xmltvParser';

describe('xmltvParser', () => {
  it('parses XMLTV timestamps with and without timezone offsets', () => {
    const utc = parseXmltvTimestamp('20261116120000 +0000');
    const brt = parseXmltvTimestamp('20261116090000 -0300');
    expect(utc).toBe(Date.UTC(2026, 10, 16, 12, 0, 0));
    expect(brt).toBe(utc);
    expect(parseXmltvTimestamp('invalid')).toBeNull();
  });

  it('filters programs by time window and allowedChannelIds', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20261116100000 +0000" stop="20261116110000 +0000" channel="globo.br">
    <title>Bom Dia &amp; Cia</title>
    <desc><![CDATA[Programa matinal <ao vivo>]]></desc>
  </programme>
  <programme start="20261116110000 +0000" stop="20261116120000 +0000" channel="other.br">
    <title>Outro Canal</title>
  </programme>
  <programme start="20261125100000 +0000" stop="20261125110000 +0000" channel="globo.br">
    <title>Muito no Futuro</title>
  </programme>
</tv>`;

    const windowStartMs = Date.UTC(2026, 10, 16, 9, 0, 0);
    const windowEndMs = Date.UTC(2026, 10, 18, 9, 0, 0);

    const res = parseXmltv(xml, {
      sourceId: 'src-1',
      windowStartMs,
      windowEndMs,
      allowedChannelIds: new Set(['globo.br']),
    });

    expect(res.totalScanned).toBe(3);
    expect(res.filteredOut).toBe(2);
    expect(res.programs).toHaveLength(1);
    expect(res.programs[0]).toMatchObject({
      channelEpgId: 'globo.br',
      title: 'Bom Dia & Cia',
      description: 'Programa matinal <ao vivo>',
    });
  });
});
