import { useEffect, useMemo, useState } from 'react';
import { AmountSheet } from '../components/AmountSheet';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Rows';
import { Button, EmptyState, Header, Spinner } from '../components/ui';
import { addSaving, updateCard } from '../data/db';
import { useCards, useSavings } from '../data/hooks';
import { cardName, KIND_LABEL, type Card } from '../data/types';
import type { Deadline } from '../deadlines/deadlines';
import { checkinItems } from '../deadlines/digest';
import { checkReminders } from '../deadlines/notify';
import { countdown, daysBetween, formatShort, relativeDay, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { setSettings, useSettings } from '../settings';

/** The weekly check-in: decide on every return you can still make, and use what's about to expire. */
export default function CheckinScreen() {
  const cards = useCards();
  const savings = useSavings();
  const s = useSettings();
  const today = todayISO();
  const money = (c: number | null) => formatMoney(c, s.currency, { whole: true });

  // Freeze the list when the screen opens, so decided rows stay visible (with their answer).
  const [ids, setIds] = useState<{ returns: string[]; expiring: string[]; soon: Deadline[] } | null>(null);
  useEffect(() => {
    if (!cards || ids) return;
    const it = checkinItems(cards, today, s.minReminderAmount);
    setIds({ returns: it.returns.map((d) => d.cardId), expiring: it.expiring.map((d) => d.cardId), soon: it.soon });
  }, [cards, ids, today, s.minReminderAmount]);

  const [later, setLater] = useState<Record<string, boolean>>({});
  const [asking, setAsking] = useState<Card | null>(null);
  const byId = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);
  const returns = (ids?.returns ?? []).map((id) => byId.get(id)).filter((c): c is Card => !!c);
  const expiring = (ids?.expiring ?? []).map((id) => byId.get(id)).filter((c): c is Card => !!c);
  const walletTotal = cards ? checkinItems(cards, today, s.minReminderAmount).walletTotal : 0;
  const month = today.slice(0, 7);
  const savedThisMonth = (savings ?? []).filter((x) => x.date.startsWith(month)).reduce((sum, x) => sum + x.amount, 0);

  const set = async (card: Card, patch: Partial<Card>, message: string) => {
    await updateCard(card.id, patch);
    toast(message);
    void checkReminders();
  };

  const finish = () => {
    setSettings({ lastCheckinAt: Date.now() });
    toast('All set. See you next Sunday.');
    navigate({ name: 'home' }, { replace: true });
  };

  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+110px)]">
      <Header title="Weekly check-in" onBack={() => back({ name: 'home' })} />
      <div className="mx-auto max-w-lg px-3">
        {!ids && (
          <div className="flex justify-center py-20">
            <Spinner label="Loading" />
          </div>
        )}

        {ids && returns.length + expiring.length + ids.soon.length === 0 && (
          <EmptyState icon="check" title="Nothing to decide this week">
            <p className="text-[15px] text-white/60">No returns still open and nothing about to expire.</p>
          </EmptyState>
        )}

        {returns.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Can still return</h2>
            <ul className="space-y-2">
              {returns.map((c) => {
                const left = c.returnBy ? countdown(Math.max(0, daysBetween(today, c.returnBy))) : '';
                const status =
                  c.returnStatus === 'kept'
                    ? 'Keeping it'
                    : c.returnStatus === 'returned'
                      ? 'Returned'
                      : c.returnStatus === 'returning'
                        ? c.returnMethod === 'mail'
                          ? 'Mailing it back'
                          : 'Taking it back'
                        : later[c.id]
                          ? 'Decide later'
                          : null;
                return (
                  <li key={c.id} className={`rounded-2xl bg-white/5 p-3 ${status ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Thumb card={c} size={44} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate({ name: 'card', id: c.id })}>
                        <span className="block truncate text-[16px] font-medium">{cardName(c)}</span>
                        <span className="block truncate text-[13px] text-white/55">
                          {[c.store, c.total !== null ? money(c.total) : '', c.returnBy ? `return by ${daysBetween(today, c.returnBy) < 7 ? relativeDay(c.returnBy, today) : formatShort(c.returnBy, today)}` : ''].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                      {!status && <span className="shrink-0 text-[13px] font-semibold text-warn">{left}</span>}
                    </div>
                    {status ? (
                      <p className="mt-2 flex items-center gap-1 px-1 text-[14px] text-good">
                        <Icon name="check" size={16} /> {status}
                      </p>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={`Decide on ${cardName(c)}`}>
                        <Button variant="secondary" className="min-h-[40px] px-2 text-[14px]" onClick={() => void set(c, { returnStatus: 'kept' }, 'Keeping it. No more return reminders.')}>
                          Keep it
                        </Button>
                        <Button className="min-h-[40px] px-2 text-[14px]" onClick={() => setAsking(c)}>
                          Returned
                        </Button>
                        <Button variant="ghost" className="min-h-[40px] px-2 text-[14px]" onClick={() => setLater((m) => ({ ...m, [c.id]: true }))}>
                          Not sure
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {expiring.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Use it before it expires</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {expiring.map((c) => (
                <li key={c.id}>
                  <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5" onClick={() => navigate({ name: 'card', id: c.id })}>
                    <Thumb card={c} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">
                        {c.balance ? `${money(c.balance)} ` : ''}
                        {c.store ? `${c.store} ` : ''}
                        {KIND_LABEL[c.kind].toLowerCase()}
                      </span>
                      <span className="block truncate text-[13px] text-white/55">
                        {c.used ? 'Used' : c.expires ? `Expires ${relativeDay(c.expires, today)} · ${formatShort(c.expires, today)}` : ''}
                      </span>
                    </span>
                    <Icon name="arrow" size={18} className="text-white/40" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ids && ids.soon.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/45">Also this week</h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {ids.soon.map((d) => (
                <li key={d.key}>
                  <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5" onClick={() => navigate({ name: 'card', id: d.cardId })}>
                    <Icon name={d.kind === 'price' ? 'trend' : d.kind === 'refund' ? 'box' : 'repeat'} size={22} className="shrink-0 text-white/60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{d.name}</span>
                      <span className="block truncate text-[13px] text-white/55">
                        {d.kind === 'price'
                          ? `Check for a lower price at ${d.store || 'the store'} (until ${formatShort(d.date, today)})`
                          : d.kind === 'refund'
                            ? 'Did the refund arrive?'
                            : `${/\btrial\b/i.test(d.card.title) ? 'Ends' : 'Renews'} ${relativeDay(d.date, today)}${d.amount ? ` · ${money(d.amount)}` : ''}`}
                      </span>
                    </span>
                    <Icon name="arrow" size={18} className="text-white/40" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ids && (walletTotal > 0 || savedThisMonth > 0) && (
          <div className="mb-6 grid grid-cols-2 gap-2">
            {walletTotal > 0 && (
              <button type="button" onClick={() => navigate({ name: 'wallet' })} className="rounded-2xl bg-white/5 p-4 text-left active:bg-white/10">
                <p className="text-[22px] font-semibold tabular">{money(walletTotal)}</p>
                <p className="text-[13px] text-white/55">on gift cards and credit</p>
              </button>
            )}
            {savedThisMonth > 0 && (
              <button type="button" onClick={() => navigate({ name: 'savings' })} className="rounded-2xl bg-good/10 p-4 text-left active:bg-good/20">
                <p className="text-[22px] font-semibold tabular text-good">{money(savedThisMonth)}</p>
                <p className="text-[13px] text-white/55">saved this month</p>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <Button className="w-full" onClick={finish} disabled={!ids}>
            Done
          </Button>
        </div>
      </div>

      <AmountSheet
        open={!!asking}
        title="Nice. How much did you get back?"
        hint="It’s added to your Savings."
        initial={asking?.total ?? null}
        confirmLabel="Mark as returned"
        optional
        onClose={() => setAsking(null)}
        onConfirm={async (amount) => {
          const c = asking!;
          setAsking(null);
          if (amount) await addSaving({ cardId: c.id, kind: 'return', amount, date: today, label: `Returned ${cardName(c)}${c.store ? ` at ${c.store}` : ''}` });
          await set(c, { returnStatus: 'returned' }, 'Marked as returned');
        }}
      />
    </div>
  );
}
