import { Icon, type IconName } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { EmptyState, Header, Spinner } from '../components/ui';
import { deleteSaving } from '../data/db';
import { useSavings } from '../data/hooks';
import { summarise } from '../data/savings';
import type { SavingKind } from '../data/types';
import { formatShort, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { useSettings } from '../settings';

const KINDS: Array<{ id: SavingKind; label: string; icon: IconName }> = [
  { id: 'return', label: 'Returns', icon: 'undo' },
  { id: 'warranty', label: 'Warranty claims', icon: 'shield' },
  { id: 'coupon', label: 'Coupons used', icon: 'tag' },
];

export default function SavingsScreen() {
  const savings = useSavings();
  const { currency } = useSettings();
  const today = todayISO();
  const sum = summarise(savings ?? [], today);
  const money = (c: number) => formatMoney(c, currency);

  return (
    <div className="min-h-screen-safe bg-ink pb-tabs">
      <Header large title="Savings" />
      <div className="mx-auto max-w-lg px-3">
        {savings === undefined && (
          <div className="flex justify-center py-20">
            <Spinner label="Loading" />
          </div>
        )}
        {savings && (
          <>
            <div className="mb-4 rounded-3xl bg-gradient-to-br from-good/25 to-white/5 p-6 text-center">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-white/60">Money kept</p>
              <p className="text-[48px] font-bold leading-tight tabular" aria-live="polite">
                {money(sum.total)}
              </p>
              <p className="text-[14px] text-white/65">{sum.thisYear !== sum.total ? `${money(sum.thisYear)} this year` : sum.total ? 'Nice work.' : 'Your first save is coming.'}</p>
            </div>
            <div className="mb-6 grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <div key={k.id} className="rounded-2xl bg-white/5 p-3">
                  <Icon name={k.icon} size={20} className="text-good" />
                  <p className="mt-1 text-[17px] font-semibold tabular">{formatMoney(sum.byKind[k.id], currency, { whole: true })}</p>
                  <p className="text-[12px] text-white/55">{k.label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {savings && savings.length > 0 && (
          <section>
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">History</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {savings.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate({ name: 'card', id: s.cardId })}>
                    <span className="block truncate text-[15px]">{s.label}</span>
                    <span className="block text-[13px] text-white/50">{formatShort(s.date, today)}</span>
                  </button>
                  <span className="font-semibold tabular text-good">+{money(s.amount)}</span>
                  <button
                    type="button"
                    aria-label={`Remove “${s.label}”`}
                    className="flex h-10 w-10 items-center justify-center text-white/35"
                    onClick={async () => {
                      if (!window.confirm('Remove this from your savings?')) return;
                      await deleteSaving(s.id);
                      toast('Removed');
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {savings && savings.length === 0 && (
          <EmptyState icon="savings" title="How this adds up">
            <ul className="space-y-2 text-left text-[15px] text-white/65">
              <li>
                <strong className="text-white">Returns:</strong> tap “I returned it” on a card.
              </li>
              <li>
                <strong className="text-white">Warranty claims:</strong> tap “Made a claim” when coverage pays for a fix.
              </li>
              <li>
                <strong className="text-white">Coupons:</strong> tap “I used it” in your Wallet.
              </li>
            </ul>
          </EmptyState>
        )}
      </div>
      <TabBar current="savings" />
    </div>
  );
}
