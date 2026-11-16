export interface SubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

function parseTimestampToSec(raw: string): number | null {
  // Suporta HH:MM:SS,mmm (SRT), HH:MM:SS.mmm (VTT) e MM:SS.mmm (VTT curto)
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const h = Number.parseFloat(parts[0] ?? '0');
    const m = Number.parseFloat(parts[1] ?? '0');
    const s = Number.parseFloat(parts[2] ?? '0');
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) {
      return h * 3600 + m * 60 + s;
    }
  } else if (parts.length === 2) {
    const m = Number.parseFloat(parts[0] ?? '0');
    const s = Number.parseFloat(parts[1] ?? '0');
    if (Number.isFinite(m) && Number.isFinite(s)) {
      return m * 60 + s;
    }
  }
  return null;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

export function parseSubtitles(rawContent: string): SubtitleCue[] {
  const content = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  const blocks = content.split(/\r?\n\r?\n/);
  const cues: SubtitleCue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = (blocks[i] ?? '').trim();
    if (!block || block.indexOf('WEBVTT') === 0 || block.indexOf('NOTE') === 0) {
      continue;
    }

    const lines = block.split(/\r?\n/);
    let timeLineIdx = -1;
    for (let j = 0; j < lines.length; j++) {
      if ((lines[j] ?? '').indexOf('-->') !== -1) {
        timeLineIdx = j;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx] ?? '';
    const arrowParts = timeLine.split('-->');
    if (arrowParts.length < 2) continue;

    const startSec = parseTimestampToSec(arrowParts[0] ?? '');
    // VTT pode ter atributos após o timestamp final (ex.: align:start)
    const endToken = (arrowParts[1] ?? '').trim().split(/\s+/)[0] ?? '';
    const endSec = parseTimestampToSec(endToken);

    if (startSec === null || endSec === null || endSec <= startSec) {
      continue;
    }

    const textLines = lines.slice(timeLineIdx + 1);
    const text = stripTags(textLines.join('\n'));
    if (text) {
      cues.push({ startSec, endSec, text });
    }
  }

  return cues.sort((a, b) => a.startSec - b.startSec);
}

export function findActiveCue(cues: SubtitleCue[], positionSec: number): string | null {
  if (cues.length === 0) return null;

  // Busca binária para localizar o cue ativo em O(log n)
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (!cue) break;

    if (positionSec < cue.startSec) {
      high = mid - 1;
    } else if (positionSec > cue.endSec) {
      low = mid + 1;
    } else {
      return cue.text;
    }
  }

  return null;
}
