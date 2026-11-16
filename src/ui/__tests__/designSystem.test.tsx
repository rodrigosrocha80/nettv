import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n, { changeAppLanguage } from '../../i18n';
import { BrowserMockPlatform } from '../../platform/browserMockPlatform';
import { EmptyState, ErrorState, Modal, VirtualKeyboard } from '../components';
import { FocusProvider } from '../focus/FocusProvider';

const flushScheduler = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe('Design System & i18n', () => {
  it('alterna idioma entre pt-BR, en e es', async () => {
    await changeAppLanguage('pt-BR');
    expect(i18n.t('common.retry')).toBe('Tentar novamente');

    await changeAppLanguage('en');
    expect(i18n.t('common.retry')).toBe('Try again');

    await changeAppLanguage('es');
    expect(i18n.t('common.retry')).toBe('Reintentar');

    await changeAppLanguage('pt-BR');
  });

  it('renderiza EmptyState e ErrorState com ação de retry', async () => {
    const onRetry = vi.fn();
    const platform = new BrowserMockPlatform();

    const { unmount } = render(
      <FocusProvider platform={platform}>
        <EmptyState title="Vazio" description="Sem itens" />
        <ErrorState description="Falha de rede" onRetry={onRetry} />
      </FocusProvider>,
    );

    await flushScheduler();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(screen.getByText('Vazio')).toBeInTheDocument();
    expect(screen.getByText('Falha de rede')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('VirtualKeyboard digita, apaga e limpa texto', async () => {
    const onChange = vi.fn();
    const platform = new BrowserMockPlatform();

    const { unmount } = render(
      <FocusProvider platform={platform}>
        <VirtualKeyboard value="ab" onChange={onChange} />
      </FocusProvider>,
    );

    await flushScheduler();
    fireEvent.click(screen.getByText('c'));
    expect(onChange).toHaveBeenCalledWith('abc');

    fireEvent.click(screen.getByText('Apagar'));
    expect(onChange).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getByText('Limpar'));
    expect(onChange).toHaveBeenCalledWith('');
    unmount();
  });

  it('Modal só renderiza conteúdo quando aberto', async () => {
    const platform = new BrowserMockPlatform();

    const { rerender, unmount } = render(
      <FocusProvider platform={platform}>
        <Modal isOpen={false} title="Aviso">
          <p>Conteúdo</p>
        </Modal>
      </FocusProvider>,
    );

    await flushScheduler();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <FocusProvider platform={platform}>
        <Modal isOpen={true} title="Aviso">
          <p>Conteúdo</p>
        </Modal>
      </FocusProvider>,
    );

    await flushScheduler();
    expect(screen.getByRole('dialog', { name: 'Aviso' })).toBeInTheDocument();
    unmount();
  });
});
