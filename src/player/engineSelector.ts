import { detectStreamFormat } from './formatDetector';
import type { EngineType, StreamFormat } from './types';

export interface EngineSelectionContext {
  isTizen: boolean;
  hasAvplay: boolean;
  preferredEngine?: EngineType | 'auto';
  streamUrl: string;
}

export interface EngineSelectionResult {
  engineType: EngineType;
  format: StreamFormat;
}

export function selectPlayerEngine(ctx: EngineSelectionContext): EngineSelectionResult {
  const format = detectStreamFormat(ctx.streamUrl);

  if (ctx.preferredEngine === 'html5') {
    return { engineType: 'html5', format };
  }

  if (ctx.preferredEngine === 'avplay' && ctx.hasAvplay) {
    return { engineType: 'avplay', format };
  }

  // Na TV Samsung Tizen com webapis.avplay disponível, AVPlay é o motor principal
  // para todos os formatos (HLS, DASH, MPEG-TS, MP4/MKV).
  if (ctx.isTizen && ctx.hasAvplay) {
    return { engineType: 'avplay', format };
  }

  return { engineType: 'html5', format };
}
