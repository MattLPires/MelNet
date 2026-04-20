import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from './SettingsPage';

const mockPrefs: Record<string, string> = {};

const mockGetAll = vi.fn(async () => ({ ...mockPrefs }));
const mockSet = vi.fn(async (_key: string, _value: string) => {});

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockPrefs).forEach((k) => delete mockPrefs[k]);

  Object.defineProperty(window, 'melnetDb', {
    value: {
      preferences: {
        getAll: mockGetAll,
        set: mockSet,
      },
    },
    writable: true,
    configurable: true,
  });
});

describe('SettingsPage', () => {
  it('renders all settings controls', async () => {
    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Configurações')).toBeInTheDocument();
    });

    expect(screen.getByTestId('network-select')).toBeInTheDocument();
    expect(screen.getByTestId('notifications-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('autostart-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('loads saved preferences from SQLite on mount', async () => {
    mockPrefs.networkInterface = 'Wi-Fi';
    mockPrefs.notifications = 'false';
    mockPrefs.autoStart = 'true';
    mockPrefs.darkTheme = 'false';

    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('network-select')).toHaveValue('Wi-Fi');
    });

    expect(screen.getByTestId('notifications-toggle')).not.toBeChecked();
    expect(screen.getByTestId('autostart-toggle')).toBeChecked();
    expect(screen.getByTestId('theme-toggle')).not.toBeChecked();
  });

  it('persists network interface change via SQLite', async () => {
    const user = userEvent.setup();
    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('network-select')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId('network-select'), 'Ethernet');

    expect(mockSet).toHaveBeenCalledWith('networkInterface', 'Ethernet');
  });

  it('persists notifications toggle via SQLite', async () => {
    const user = userEvent.setup();
    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-toggle')).toBeInTheDocument();
    });

    // Default is true, clicking should set to false
    await user.click(screen.getByTestId('notifications-toggle'));

    expect(mockSet).toHaveBeenCalledWith('notifications', 'false');
  });

  it('persists auto-start toggle via SQLite', async () => {
    const user = userEvent.setup();
    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('autostart-toggle')).toBeInTheDocument();
    });

    // Default is false, clicking should set to true
    await user.click(screen.getByTestId('autostart-toggle'));

    expect(mockSet).toHaveBeenCalledWith('autoStart', 'true');
  });

  it('persists theme toggle via SQLite', async () => {
    const user = userEvent.setup();
    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    // Default is true (dark), clicking should set to false (light)
    await user.click(screen.getByTestId('theme-toggle'));

    expect(mockSet).toHaveBeenCalledWith('darkTheme', 'false');
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPage onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByTestId('back-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('back-btn'));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders network interface options', async () => {
    render(<SettingsPage onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('network-select')).toBeInTheDocument();
    });

    const select = screen.getByTestId('network-select');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('Automático');
    expect(options[1]).toHaveTextContent('Ethernet');
    expect(options[2]).toHaveTextContent('Wi-Fi');
    expect(options[3]).toHaveTextContent('VPN');
  });
});
