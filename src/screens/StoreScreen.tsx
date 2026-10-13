import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { CardRow, Thumb } from '../components/Rows';
import { ShowCode } from '../components/ShowCode';
import { Button, EmptyState, Header, Spinner } from '../components/ui';
import { MEMBERSHIPS } from '../config/policies';
import { getImage } from '../data/db';
import { useCards } from '../data/hooks';
import { cardName, isWallet, KIND_LABEL, nextCharge, type Card } from '../data/types';
import { deadlines } from '../deadlines/deadlines';
import { findStore, sameStore } from '../deadlines/policy';
import { countdown, formatShort, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { back, navigate } from '../lib/router';
import { useSettings } from '../settings';

/** One sentence on the store's usual policies, including the user's memberships. */
function policyLine(store: string, memberships: readonly string[]): string | null {
  const p = findStore(store);
  if (!p) return null;
  const parts: string[] = [];
  const perk = p.perks?.find((x) => memberships.includes(x.membership));
  const perkLabel = perk && MEMBERSHIPS.find((m) => m.id === perk.membership)?.label;
  if (perk?.returnDays) parts.push(`Returns: ${perk.returnDays} days with your ${perkLabel}`);
  else if (p.returnDays === null) parts.push('Returns: usually no fixed limit');
  else {
    const days = p.returnDays + (perk?.extraDays ?? 0);
    const elec = p.electronicsDays !== undefined && p.electronicsDays !== p.returnDays ? ` (${p.electronicsDays + (perk?.extraDays ?? 0)} for electronics)` : '';
    parts.push(`Returns: usually ${days} days${elec}${perk?.extraDays ? ` with your ${perkLabel}` : ''}`);
  }
  if (p.priceAdjustDays) parts.push(p.priceAdjustDays === 'return' ? 'refunds price drops while you can still return' : `refunds price drops for ${p.priceAdjustDays} days`);
  return `${parts.join('; ')}.`;
}

export default function StoreScreen({ store }: { store: string }) {
  const cards = useCards();
  const s = useSettings();
  const today = todayISO();
  const [showing, setShowing] = useState<{ card: Card; image: Blob | null } | null>(null);
  const money = (c: number | null) => formatMoney(c, s.currency);
  const name = findStore(store)?.name ?? store;

  const here = useMemo(() => (cards ?? []).filter((c) => sameStore(c.store, store)), [cards, store]);
  const wallet = here.filter((c) => isWallet(c.kind) && !c.used && (c.balance ?? 1) > 0 && (!c.expires || c.expires >= today));
  const walletTotal = wallet.filter((c) => c.kind !== 'coupon').reduce((sum, c) => sum + (c.balance ?? 0), 0);
  const list = useMemo(() => deadlines(here, today), [here, today]);
  const returns = list.filter((d) => d.kind === 'return' && d.daysLeft >= 0);
  const prices = list.filter((d) => d.kind === 'price' && d.daysLeft >= 0);
  const past = here.filter((c) => c.kind === 'purchase').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const renewals = here.filter((c) => c.kind === 'renewal' && !c.used);
  const empty = wallet.length + returns.length + prices.length + past.length + renewals.length === 0;
  const policy = policyLine(store, s.memberships);

  const show = async (card: Card) => setShowing({ card, image: card.hasImage ? ((await getImage(card.id))?.image ?? null) : null });

  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title={name} onBack={() => back({ name: 'wallet' })} />
      <div className="mx-auto max-w-lg px-3">
        {!cards && (
          <div className="flex justify-center py-20">
            <Spinner label="Loading" />
          </div>
        )}
        {policy && <p className="mb-4 px-1 text-[14px] text-white/60">{policy}</p>}

        {wallet.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 flex justify-between px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">
              <span>Use here</span>
              {walletTotal > 0 && <span className="tabular">{money(walletTotal)} in credit</span>}
            </h2>
            <ul className="space-y-2">
              {wallet.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                  <Thumb card={c} size={44} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate({ name: 'card', id: c.id })}>
                    <span className="block truncate text-[16px] font-medium">
                      {c.balance ? `${money(c.balance)} ` : ''}
                      {c.kind === 'coupon' && c.title ? c.title : KIND_LABEL[c.kind].toLowerCase()}
                    </span>
                    <span className="block truncate text-[13px] text-white/55">{c.expires ? `Expires ${formatShort(c.expires, today)}` : 'No expiry'}</span>
                  </button>
                  {(c.code || c.hasImage) && (
                    <Button className="min-h-[40px] px-4 text-[14px]" onClick={() => void show(c)}>
                      <Icon name="qr" size={16} /> Show
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {returns.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Can still return</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {returns.map((d) => (
                <CardRow key={d.key} card={d.card} right={countdown(d.daysLeft)} />
              ))}
            </ul>
          </section>
        )}

        {prices.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Check for a lower price</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {prices.map((d) => (
                <CardRow key={d.key} card={d.card} right={`until ${formatShort(d.date, today)}`} />
              ))}
            </ul>
          </section>
        )}

        {past.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Recent purchases</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {past.map((c) => (
                <CardRow key={c.id} card={c} />
              ))}
            </ul>
          </section>
        )}

        {renewals.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Trials & subscriptions</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {renewals.map((c) => {
                const next = nextCharge(c, today);
                return <CardRow key={c.id} card={c} right={next ? formatShort(next, today) : undefined} />;
              })}
            </ul>
          </section>
        )}

        {cards && empty && (
          <EmptyState icon="store" title={`Nothing from ${name} yet`}>
            <p className="text-[15px] text-white/60">Receipts, coupons and credit from this store will show up here.</p>
          </EmptyState>
        )}
      </div>

      {showing && (
        <ShowCode
          title={`${name}: ${showing.card.kind === 'coupon' ? cardName(showing.card) : KIND_LABEL[showing.card.kind]}`}
          image={showing.image}
          code={showing.card.code}
          onClose={() => setShowing(null)}
        />
      )}
    </div>
  );
}
