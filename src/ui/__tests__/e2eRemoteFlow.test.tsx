import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import App from '../../App';
import { clearAllUserData } from '../../data/db/userRepository';
import { resetDbConnectionForTests } from '../../data/db/database';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';

describe('Phase 7 E2E remote navigation integration', () => {
  beforeEach(async () => {
    await clearAllUserData();
    useProfileStore.getState().resetStore();
    useSourceStore.getState().resetStore();
    useCatalogStore.getState().clearCatalog();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbConnectionForTests();
  });

  it('boots to Onboarding when no sources exist and handles Back key exit confirmation', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Adicionar Fonte IPTV/i)).toBeInTheDocument();
    });

    // Simula tecla Back (Escape no BrowserMockPlatform) para abrir confirmação de saída
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.getByText(/Deseja sair do NetTV\?/i)).toBeInTheDocument();
    });

    // Fecha modal pressionando Escape novamente
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText(/Deseja sair do NetTV\?/i)).not.toBeInTheDocument();
    });
  });
});
