import { navigate, type Route } from '../lib/router';
import { Icon, type IconName } from './Icon';

const TABS: Array<{ route: Route['name']; label: string; icon: IconName }> = [
  { route: 'home', label: 'Coming Up', icon: 'clock' },
  { route: 'wallet', label: 'Wallet', icon: 'wallet' },
  { route: 'scan', label: 'Scan', icon: 'scan' },
  { route: 'receipts', label: 'Receipts', icon: 'receipt' },
  { route: 'savings', label: 'Savings', icon: 'savings' },
];

export function TabBar({ current }: { current: Route['name'] }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
        {TABS.map((t) => {
          const active = current === t.route;
          if (t.route === 'scan') {
            return (
              <li key={t.route} className="-mt-5">
                <button
                  type="button"
                  aria-label="Scan a receipt"
                  onClick={() => navigate({ name: 'scan' })}
                  className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-accent text-ink shadow-[0_6px_24px_rgba(255,90,95,0.35)] active:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Icon name="scan" size={28} strokeWidth={2} />
                </button>
              </li>
            );
          }
          return (
            <li key={t.route}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => !active && navigate({ name: t.route } as Route, { replace: true })}
                className={`flex min-h-[52px] min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium ${active ? 'text-accent' : 'text-white/55 active:text-white'}`}
              >
                <Icon name={t.icon} size={24} />
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
