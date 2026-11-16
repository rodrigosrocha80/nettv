import { describe, expect, it } from 'vitest';
import { parseM3u } from '../parsers/m3uParser';

describe('m3uParser', () => {
  it('parses small M3U with live channels, VOD, series, and EPG header', () => {
    const sample = `\uFEFF#EXTM3U url-tvg="https://epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="globo.br" tvg-name="Globo HD" tvg-logo="https://img.example.com/globo.png" tvg-chno="5" group-title="Abertos, Brasil",Globo HD
https://stream.example.com/live/globo.m3u8
#EXTINF:-1 tvg-logo="https://img.example.com/movie.jpg" group-title="Filmes",Matrix (1999)
https://stream.example.com/movie/user/pass/matrix.mp4
#EXTINF:-1 group-title="Séries",Minha Serie S01E01
https://stream.example.com/series/user/pass/101.mkv
#EXTINF:-1 group-title="Séries",Minha Serie S01E02
https://stream.example.com/series/user/pass/102.mkv
`;

    const result = parseM3u(sample, 'src-1');

    expect(result.detectedEpgUrl).toBe('https://epg.example.com/guide.xml');
    expect(result.skippedLines).toBe(0);
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]).toMatchObject({
      sourceId: 'src-1',
      name: 'Globo HD',
      number: 5,
      epgChannelId: 'globo.br',
      logoUrl: 'https://img.example.com/globo.png',
      streamUrl: 'https://stream.example.com/live/globo.m3u8',
    });

    expect(result.vodItems).toHaveLength(1);
    expect(result.vodItems[0]).toMatchObject({
      title: 'Matrix (1999)',
      streamUrl: 'https://stream.example.com/movie/user/pass/matrix.mp4',
    });

    expect(result.series).toHaveLength(1);
    expect(result.series[0]?.title).toBe('Minha Serie');
    expect(result.series[0]?.seasons[0]?.episodes).toHaveLength(2);
    expect(result.categories.map((c) => c.name)).toContain('Abertos, Brasil');
  });

  it('tolerates malformed lines, missing attributes, and invalid URLs', () => {
    const corrupted = `#EXTM3U
#EXTINF:-1
linha_invalida_sem_protocolo
#EXTGRP:Noticias
https://stream.example.com/news.m3u8
#EXTINF:-1 tvg-id="band" group-title=Esportes,Band Sports
#EXTVLCOPT:http-user-agent=VLC
https://stream.example.com/band.m3u8
texto solto aleatorio
`;

    const result = parseM3u(corrupted, 'src-corrupt');
    expect(result.skippedLines).toBe(2);
    expect(result.channels).toHaveLength(2);
    expect(result.channels[1]?.name).toBe('Band Sports');
    expect(result.channels[1]?.epgChannelId).toBe('band');
  });

  it('parses 50,000 items quickly without crashing', () => {
    const total = 50000;
    const chunks: string[] = ['#EXTM3U\n'];
    for (let i = 0; i < total; i++) {
      const cat = `Categoria ${i % 40}`;
      chunks.push(
        `#EXTINF:-1 tvg-id="ch-${i}" tvg-logo="https://img.example.com/${i}.png" group-title="${cat}",Canal Teste ${i}\nhttps://cdn.example.com/live/${i}.m3u8\n`,
      );
    }
    const bigPlaylist = chunks.join('');

    const start = performance.now();
    const result = parseM3u(bigPlaylist, 'src-50k');
    const elapsedMs = performance.now() - start;

    expect(result.channels).toHaveLength(total);
    expect(result.categories).toHaveLength(40);
    expect(elapsedMs).toBeLessThan(3000);
  });
});
