import { useMemo, useState } from 'react';
import { CardRow } from '../components/Rows';
import { TabBar } from '../components/TabBar';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Header, IconButton, Spinner } from '../components/ui';
import { useCards } from '../data/hooks';
import { cardName, isWallet, nextCharge, type Card } from '../data/types';
import { countdown, daysBetween, formatShort, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { navigate } from '../lib/router';
import { startManual } from '../scan/pipeline';
import { useSettings } from '../settings';

interface StoreGroup {
  store: string;
  cards: Card[];
  total: number;
}

export function groupByStore(cards: Card[]): StoreGroup[] {
  const map = new Map<string, Card[]>();
  for (const c of cards) {
    const key = c.store.trim() || 'Other';
    const k = [...map.keys()].find((x) => x.toLowerCase() === key.toLowerCase()) ?? key;
    map.set(k, [...(map.get(k) ?? []), c]);
  }
  return [...map.entries()]
    .map(([store, cs]) => ({
      store,
      cards: cs.sort((a, b) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999') || cardName(a).localeCompare(cardName(b))),
      total: cs.reduce((s, c) => s + (c.balance ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total || a.store.localeCompare(b.store));
}

export default function WalletScreen() {
  const cards = useCards();
  const { currency } = useSettings();
  const today = todayISO();
  const [showUsed, setShowUsed] = useState(false);
  const wallet = useMemo(() => (cards ?? []).filter((c) => isWallet(c.kind)), [cards]);
  const renewals = useMemo(
    () =>
      (cards ?? [])
        .filter((c) => c.kind === 'renewal' && !c.used)
        .map((c) => ({ card: c, next: nextCharge(c, today) }))
        .sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999')),
    [cards, today],
  );
  const active = wallet.filter((c) => !c.used && (!c.expires || c.expires >= today));
  const inactive = wallet.filter((c) => !active.includes(c));
  const groups = groupByStore(active);
  const total = active.filter((c) => c.kind !== 'coupon').reduce((s, c) => s + (c.balance ?? 0), 0);
  const coupons = active.filter((c) => c.kind === 'coupon').length;

  return (
    <div className="min-h-screen-safe bg-ink pb-tabs">
      <Header
        large
        title="Wallet"
        right={
          <IconButton
            icon="plus"
            label="Add coupon, gift card or credit"
            onClick={() => {
              startManual('coupon');
              navigate({ name: 'review' });
            }}
            className="bg-transparent"
          />
        }
      />
      <div className="mx-auto max-w-lg">
        {cards === undefined && (
          <div className="flex justify-center py-20">
            <Spinner label="Loading" />
          </div>
        )}
        {cards && active.length > 0 && (
          <div className="mx-3 mb-5 rounded-3xl bg-gradient-to-br from-accent/25 to-white/5 p-5">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-white/60">Gift cards & store credit</p>
            <p className="text-[34px] font-bold tabular">{formatMoney(total, currency)}</p>
            <p className="text-[14px] text-white/65">
              {coupons ? `Plus ${coupons} coupon${coupons === 1 ? '' : 's'} · ` : ''}across {groups.length} store{groups.length === 1 ? '' : 's'}
            </p>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.store} className="mb-5">
            <h2 className="mb-1 px-1">
              {g.store === 'Other' ? (
                <span className="flex min-h-[32px] items-center justify-between px-3 text-[13px] font-semibold uppercase tracking-wide text-white/45">
                  <span>No store</span>
                  {g.total > 0 && <span className="tabular">{formatMoney(g.total, currency)}</span>}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate({ name: 'store', store: g.store })}
                  className="flex min-h-[32px] w-full items-center justify-between rounded-lg px-3 text-[13px] font-semibold uppercase tracking-wide text-white/45 active:bg-white/5"
                  aria-label={`Everything at ${g.store}`}
                >
                  <span className="flex items-center gap-1">
                    {g.store} <Icon name="arrow" size={14} />
                  </span>
                  {g.total > 0 && <span className="tabular">{formatMoney(g.total, currency)}</span>}
                </button>
              )}
            </h2>
            <ul className="mx-3 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5" aria-label={g.store}>
              {g.cards.map((c) => {
                const days = c.expires ? daysBetween(today, c.expires) : null;
                return <CardRow key={c.id} card={c} right={days !== null && days <= 14 ? countdown(days) : undefined} />;
              })}
            </ul>
          </section>
        ))}

        <section className="mb-5">
          <h2 className="mb-1 px-4 text-[13px] font-semibold uppercase tracking-wide text-white/45">Trials & subscriptions</h2>
          <ul className="mx-3 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5" aria-label="Trials and subscriptions">
            {renewals.map(({ card: c, next }) => {
              const days = next ? daysBetween(today, next) : null;
              return <CardRow key={c.id} card={c} right={days !== null && days >= 0 ? (days <= 14 ? countdown(days) : formatShort(next!, today)) : undefined} />;
            })}
            <li>
              <button
                type="button"
                className="flex min-h-[52px] w-full items-center gap-2 px-4 text-[15px] text-accent active:bg-white/5"
                onClick={() => {
                  startManual('renewal');
                  navigate({ name: 'review' });
                }}
              >
                <Icon name="plus" size={18} /> Add a trial or subscription
              </button>
            </li>
          </ul>
          {renewals.length === 0 && <p className="mt-1 px-4 text-[13px] text-white/50">Kept reminds you 3 days and 1 day before it charges, so you can cancel in time.</p>}
        </section>

        {cards && active.length === 0 && (
          <EmptyState icon="wallet" title="Nothing in your Wallet">
            <p className="text-[15px] text-white/60">Scan coupons, gift cards and store-credit slips. You’ll see balances by store and get a nudge before anything expires.</p>
            <Button className="mt-2" onClick={() => navigate({ name: 'scan' })}>
              Scan one
            </Button>
          </EmptyState>
        )}

        {inactive.length > 0 && (
          <div className="px-3">
            <Button variant="ghost" className="w-full" onClick={() => setShowUsed((v) => !v)} aria-expanded={showUsed}>
              {showUsed ? 'Hide' : 'Show'} used & expired ({inactive.length})
            </Button>
            {showUsed && (
              <ul className="mt-2 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5 opacity-70">
                {inactive.map((c) => (
                  <CardRow key={c.id} card={c} right={c.used ? 'Used' : 'Expired'} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <TabBar current="wallet" />
    </div>
  );
}
