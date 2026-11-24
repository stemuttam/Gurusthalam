
import { useTheme } from './use-theme.js';
import type { ThemePreference } from './theme-storage.js';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  shortLabel: string;
  icon: 'sun' | 'moon' | 'monitor';
}

const options: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light theme',
    shortLabel: 'Light',
    icon: 'sun',
  },
  {
    value: 'dark',
    label: 'Dark theme',
    shortLabel: 'Dark',
    icon: 'moon',
  },
  {
    value: 'system',
    label: 'System theme',
    shortLabel: 'System',
    icon: 'monitor',
  },
];

function ThemeIcon({ name }: { name: ThemeOption['icon'] }) {
  if (name === 'sun') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
    );
  }

  if (name === 'moon') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="gt-theme-switcher" role="group" aria-label="Theme preference">
      {options.map((option) => {
        const selected = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            className="gt-theme-switcher__option"
            aria-label={option.label}
            aria-pressed={selected}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => setTheme(option.value)}
          >
            <ThemeIcon name={option.icon} />
            <span>{option.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
