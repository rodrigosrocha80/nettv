import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { logDiagnostic, clearDiagnosticEvents } from '../../domain/diagnostics';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import { BrowserMockPlatform } from '../../platform/browserMockPlatform';
import { FocusProvider } from '../focus/FocusProvider';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LiveTvScreen } from '../screens/LiveTvScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

function withFocus(ui: React.ReactNode) {
  const platform = new BrowserMockPlatform();
  return <FocusProvider platform={platform}>{ui}</FocusProvider>;
}

describe('Phase 6 screens and user flows', () => {
  beforeEach(() => {
    clearDiagnosticEvents();
    useProfileStore.getState().resetStore();
    useSourceStore.getState().resetStore();
    useCatalogStore.getState().clearCatalog();
  });

  it('renders Onboarding with legal notice and validates invalid URL', () => {
    render(withFocus(<OnboardingScreen onComplete={vi.fn()} />));

    expect(screen.getByText(/apenas um reprodutor de mídia/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Conectar e Sincronizar/i));
    expect(screen.getByRole('alert')).toHaveTextContent(/URL inválida/i);
  });

  it('renders HomeScreen with channels and VOD items', () => {
    useCatalogStore.setState({
      loadedSourceId: 'src-1',
      categories: [{ id: 'c1', sourceId: 'src-1', kind: 'live', name: 'Abertos', order: 0 }],
      channels: [
        {
          id: 'ch-1',
          sourceId: 'src-1',
          categoryId: 'c1',
          number: 1,
          name: 'TV Cultura',
          nameLower: 'tv cultura',
          streamUrl: 'https://cdn.example.com/cultura.m3u8',
        },
      ],
      vodItems: [
        {
          id: 'vod-1',
          sourceId: 'src-1',
          categoryId: 'c2',
          title: 'Filme Livre',
          titleLower: 'filme livre',
          streamUrl: 'https://cdn.example.com/filme.mp4',
        },
      ],
      series: [],
    });

    render(withFocus(<HomeScreen onOpenPlayer={vi.fn()} onGoToOnboarding={vi.fn()} />));
    expect(screen.getByText('TV Cultura')).toBeInTheDocument();
    expect(screen.getByText('Filme Livre')).toBeInTheDocument();
  });

  it('renders LiveTvScreen, switches to EPG view, and guards locked category with PIN', () => {
    useProfileStore.setState({
      profiles: [
        {
          id: 'p1',
          name: 'Casa',
          avatarId: 'default',
          pinHash: 'dummy-hash',
          lockedCategoryIds: ['cat-adult'],
          lockedChannelIds: [],
          createdAt: 1,
        },
      ],
      activeProfileId: 'p1',
    });

    useCatalogStore.setState({
      categories: [
        { id: 'cat-1', sourceId: 'src-1', kind: 'live', name: 'Notícias', order: 0 },
        { id: 'cat-adult', sourceId: 'src-1', kind: 'live', name: 'Restrito', order: 1 },
      ],
      channels: [
        {
          id: 'ch-news',
          sourceId: 'src-1',
          categoryId: 'cat-1',
          name: 'Canal News',
          nameLower: 'canal news',
          streamUrl: 'https://cdn.example.com/news.m3u8',
        },
      ],
    });

    render(withFocus(<LiveTvScreen onOpenPlayer={vi.fn()} />));

    fireEvent.click(screen.getByText(/Restrito/i));
    expect(screen.getByText(/Conteúdo Bloqueado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Cancelar/i));

    fireEvent.click(screen.getByText(/Guia EPG/i));
    expect(screen.getByText(/\+2h/i)).toBeInTheDocument();
  });

  it('renders DiagnosticsScreen with sanitized source URL and sanitized logs', () => {
    useSourceStore.setState({
      sources: [
        {
          id: 'src-1',
          name: 'Fonte Teste',
          type: 'xtream',
          url: 'https://user:pass@panel.example.com/get.php?token=xyz',
          cacheTtlMinutes: 720,
          epgWindowDays: 2,
          createdAt: 1,
        },
      ],
      activeSourceId: 'src-1',
    });

    logDiagnostic('error', 'data', 'Erro em https://user:secret@host.com/list.m3u?k=1');

    render(withFocus(<DiagnosticsScreen onBack={vi.fn()} />));

    expect(
      screen.getByText(/https:\/\/\*\*\*:\*\*\*@panel\.example\.com\/get\.php\?\*\*\*/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Erro em https:\/\/\*\*\*:\*\*\*@host\.com\/list\.m3u\?\*\*\*/),
    ).toBeInTheDocument();
  });

  it('renders SettingsScreen and opens Terms modal', () => {
    render(
      withFocus(
        <SettingsScreen onOpenDiagnostics={vi.fn()} onNotify={vi.fn()} onDataCleared={vi.fn()} />,
      ),
    );

    fireEvent.click(screen.getByText(/Termos e Privacidade/i));
    expect(screen.getByText(/apenas um reprodutor de mídia/i)).toBeInTheDocument();
  });
});
