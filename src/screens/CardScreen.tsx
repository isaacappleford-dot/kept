import { useMemo, useState, type ReactNode } from 'react';
import { AmountSheet } from '../components/AmountSheet';
import { Icon, type IconName } from '../components/Icon';
import { KIND_ICON } from '../components/Rows';
import { Button, Header, IconButton, Sheet, SheetItem, Spinner } from '../components/ui';
import { categoryById } from '../config/policies';
import { addSaving, deleteCard, deleteSavingsFor, updateCard } from '../data/db';
import { useCard, useImageUrl, useSavings } from '../data/hooks';
import { cardName, KIND_LABEL, type Card } from '../data/types';
import { deadlines, type Deadline } from '../deadlines/deadlines';
import { remindable } from '../deadlines/filters';
import { checkReminders } from '../deadlines/notify';
import { addToCalendar, shareReceiptPdf } from '../export/actions';
import { countdown, formatLong, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { useSettings } from '../settings';

function Tile({ icon, label, value, sub, tone, children }: { icon: IconName; label: string; value: string; sub?: string; tone?: 'urgent' | 'warn' | 'muted' | 'done'; children?: ReactNode }) {
  const color = { urgent: 'text-urgent', warn: 'text-warn', muted: 'text-white/45', done: 'text-accent' }[tone ?? 'muted'];
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <Icon name={icon} size={22} className={`mt-0.5 shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white/55">{label}</p>
          <p className="text-[18px] font-semibold">{value}</p>
          {sub && <p className={`text-[14px] font-medium ${color}`}>{sub}</p>}
        </div>
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const toneFor = (d?: Deadline) => (!d ? 'muted' : d.urgency === 'week' ? 'urgent' : d.urgency === 'month' ? 'warn' : d.urgency === 'past' ? 'muted' : 'done');

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-4 px-4 py-3">
      <span className="w-32 shrink-0 text-[14px] text-white/55">{label}</span>
      <span className="min-w-0 flex-1 break-words text-[15px]">{value}</span>
    </div>
  );
}

type Ask = null | 'returned' | 'warranty' | 'spend' | 'used';

function CardView({ card }: { card: Card }) {
  const { currency, minReminderAmount } = useSettings();
  const today = todayISO();
  const imageUrl = useImageUrl(card.hasImage ? card.id : null, 'image');
  const savings = useSavings();
  const [ask, setAsk] = useState<Ask>(null);
  const [menu, setMenu] = useState(false);
  const [photo, setPhoto] = useState(false);
  const list = useMemo(() => deadlines([card], today), [card, today]);
  const ret = list.find((d) => d.kind === 'return');
  const war = list.find((d) => d.kind === 'warranty');
  const exp = list.find((d) => d.kind === 'expires');
  const money = (c: number | null) => formatMoney(c, currency);
  const claimed = savings?.filter((s) => s.cardId === card.id) ?? [];
  const isWallet = card.kind !== 'purchase';

  const set = async (patch: Partial<Card>, message: string) => {
    await updateCard(card.id, patch);
    toast(message);
    void checkReminders();
  };

  const warrantyEnd = card.extendedWarrantyUntil && (!card.warrantyUntil || card.extendedWarrantyUntil > card.warrantyUntil) ? card.extendedWarrantyUntil : card.warrantyUntil;

  return (
    <>
      <Header
        title={KIND_LABEL[card.kind]}
        onBack={() => back({ name: isWallet ? 'wallet' : 'home' })}
        right={
          <div className="flex">
            <IconButton icon="edit" label="Edit" onClick={() => navigate({ name: 'edit', id: card.id })} className="bg-transparent" />
            <IconButton icon="more" label="More actions" onClick={() => setMenu(true)} className="bg-transparent" />
          </div>
        }
      />
      <div className="mx-auto max-w-lg space-y-3 px-3 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className="flex items-center gap-4 px-1 py-2">
          <button
            type="button"
            onClick={() => imageUrl && setPhoto(true)}
            aria-label={imageUrl ? 'View receipt photo' : undefined}
            disabled={!imageUrl}
            className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-white/60"
          >
            {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover object-top" /> : <Icon name={KIND_ICON[card.kind]} size={28} />}
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] font-bold leading-tight">{cardName(card)}</h2>
            <p className="text-[15px] text-white/60">
              {card.store || KIND_LABEL[card.kind]} · {formatLong(card.date)}
            </p>
            {!isWallet && card.total !== null && <p className="mt-0.5 text-[20px] font-semibold tabular">{money(card.total)}</p>}
          </div>
        </div>

        {!isWallet && (
          <>
            {card.returnStatus === 'returned' ? (
              <Tile icon="check" label="Return" value="Returned" tone="done">
                <Button
                  variant="ghost"
                  className="min-h-[36px] px-3 text-[13px]"
                  onClick={async () => {
                    await deleteSavingsFor(card.id, 'return');
                    await set({ returnStatus: 'open' }, 'Marked as not returned');
                  }}
                >
                  <Icon name="undo" size={16} /> Undo
                </Button>
              </Tile>
            ) : card.returnBy ? (
              <Tile
                icon="undo"
                label="Return by"
                value={formatLong(card.returnBy)}
                sub={card.returnStatus === 'kept' ? 'Keeping it' : ret ? countdown(ret.daysLeft) : 'Window closed'}
                tone={card.returnStatus === 'kept' ? 'muted' : toneFor(ret)}
              >
                {card.returnStatus === 'open' && ret && ret.daysLeft >= -7 && (
                  <>
                    <Button className="min-h-[36px] px-4 text-[14px]" onClick={() => setAsk('returned')}>
                      I returned it
                    </Button>
                    <Button variant="secondary" className="min-h-[36px] px-4 text-[14px]" onClick={() => void set({ returnStatus: 'kept' }, 'Got it. No more return reminders.')}>
                      Keeping it
                    </Button>
                  </>
                )}
                {card.returnStatus === 'kept' && (
                  <Button variant="ghost" className="min-h-[36px] px-3 text-[13px]" onClick={() => void set({ returnStatus: 'open' }, 'Return reminders are back on')}>
                    <Icon name="undo" size={16} /> Remind me again
                  </Button>
                )}
                {card.returnStatus === 'open' && ret && ret.daysLeft >= 0 && (
                  <Button variant="ghost" className="min-h-[36px] px-3 text-[13px]" onClick={() => void addToCalendar([ret], currency, 'return')}>
                    <Icon name="calendar" size={16} /> Add to Calendar
                  </Button>
                )}
              </Tile>
            ) : (
              <Tile icon="undo" label="Return by" value="No date set" sub={card.store ? 'Check the store’s policy, then add it.' : undefined} tone="muted">
                <Button variant="secondary" className="min-h-[36px] px-4 text-[14px]" onClick={() => navigate({ name: 'edit', id: card.id })}>
                  Add a date
                </Button>
              </Tile>
            )}

            {card.returnStatus !== 'returned' && (
              <Tile
                icon="shield"
                label={card.extendedWarrantyUntil && warrantyEnd === card.extendedWarrantyUntil ? 'Extended warranty until' : 'Warranty until'}
                value={warrantyEnd ? formatLong(warrantyEnd) : 'No warranty'}
                sub={warrantyEnd ? (war ? countdown(war.daysLeft) : 'Ended') : undefined}
                tone={war ? toneFor(war) : 'muted'}
              >
                {war && (
                  <>
                    <Button variant="secondary" className="min-h-[36px] px-4 text-[14px]" onClick={() => setAsk('warranty')}>
                      <Icon name="wrench" size={16} /> Made a claim
                    </Button>
                    <Button variant="ghost" className="min-h-[36px] px-3 text-[13px]" onClick={() => void addToCalendar([war], currency, 'warranty')}>
                      <Icon name="calendar" size={16} /> Add to Calendar
                    </Button>
                  </>
                )}
              </Tile>
            )}
          </>
        )}

        {!isWallet && [ret, war].some((d) => d && !remindable(d, minReminderAmount)) && (
          <p className="px-2 text-[13px] text-white/50">
            {card.category === 'grocery'
              ? 'Groceries don’t get reminders. They still show in Coming Up.'
              : `No reminders for buys under ${formatMoney(minReminderAmount, currency, { whole: true })}. You can change that in Settings.`}
          </p>
        )}

        {isWallet && (
          <>
            <Tile
              icon={KIND_ICON[card.kind]}
              label={card.kind === 'coupon' ? 'Worth' : 'Balance'}
              value={card.used ? 'Used' : money(card.balance) || '—'}
              sub={card.kind !== 'coupon' && card.total && card.balance !== card.total && !card.used ? `of ${money(card.total)}` : undefined}
              tone={card.used ? 'muted' : 'done'}
            >
              {!card.used && card.kind === 'coupon' && (
                <Button className="min-h-[36px] px-4 text-[14px]" onClick={() => setAsk('used')}>
                  I used it
                </Button>
              )}
              {!card.used && card.kind !== 'coupon' && (
                <>
                  <Button className="min-h-[36px] px-4 text-[14px]" onClick={() => setAsk('spend')}>
                    Spent some
                  </Button>
                  <Button variant="secondary" className="min-h-[36px] px-4 text-[14px]" onClick={() => void set({ used: true, balance: 0 }, 'Marked as used up')}>
                    Used it all
                  </Button>
                </>
              )}
              {card.used && (
                <Button
                  variant="ghost"
                  className="min-h-[36px] px-3 text-[13px]"
                  onClick={async () => {
                    await deleteSavingsFor(card.id, 'coupon');
                    await set({ used: false, balance: card.balance || card.total }, 'Back in your Wallet');
                  }}
                >
                  <Icon name="undo" size={16} /> Undo
                </Button>
              )}
            </Tile>
            <Tile
              icon="clock"
              label="Expires"
              value={card.expires ? formatLong(card.expires) : 'Never'}
              sub={card.expires && !card.used ? (exp ? countdown(exp.daysLeft) : 'Expired') : undefined}
              tone={exp ? toneFor(exp) : 'muted'}
            >
              {exp && exp.daysLeft >= 0 && (
                <Button variant="ghost" className="min-h-[36px] px-3 text-[13px]" onClick={() => void addToCalendar([exp], currency, 'expiry')}>
                  <Icon name="calendar" size={16} /> Add to Calendar
                </Button>
              )}
            </Tile>
            {card.code && (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-4 text-left active:bg-white/10"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(card.code)
                    .then(() => toast('Code copied'))
                    .catch(() => toast('Couldn’t copy'));
                }}
              >
                <span className="flex-1">
                  <span className="block text-[13px] text-white/55">Code · tap to copy</span>
                  <span className="block font-mono text-[20px] tracking-wider">{card.code}</span>
                </span>
              </button>
            )}
          </>
        )}

        {claimed.length > 0 && (
          <div className="rounded-2xl bg-accent/10 p-4 text-[14px] text-accent">
            {claimed.map((s) => (
              <p key={s.id}>
                Saved {money(s.amount)} · {s.label}
              </p>
            ))}
          </div>
        )}

        {card.items.length > 0 && (
          <section className="rounded-2xl bg-white/5">
            <h3 className="px-4 pt-3 text-[13px] font-semibold uppercase tracking-wide text-white/45">Items</h3>
            <ul className="divide-y divide-white/10">
              {card.items.map((it, i) => (
                <li key={i} className="flex gap-3 px-4 py-2.5 text-[15px]">
                  <span className="flex-1">{it.name}</span>
                  <span className="tabular text-white/75">{money(it.price)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="divide-y divide-white/10 rounded-2xl bg-white/5">
          {!isWallet && <Detail label="Category" value={categoryById(card.category).label} />}
          {card.online && <Detail label="Delivered" value={card.deliveryDate ? formatLong(card.deliveryDate) : 'Online order'} />}
          <Detail label="Serial number" value={card.serial} />
          <Detail label="Gift for" value={card.giftFor} />
          <Detail label="Box" value={card.location} />
          <Detail label="Notes" value={card.notes} />
        </section>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="secondary" onClick={() => void shareReceiptPdf(card, currency)}>
            <Icon name="file" size={18} /> Export PDF
          </Button>
          <Button variant="secondary" onClick={() => navigate({ name: 'edit', id: card.id })}>
            <Icon name="edit" size={18} /> Edit
          </Button>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={cardName(card)}>
        <SheetItem
          icon="file"
          label="Export as PDF"
          hint="For a warranty claim or expense report"
          onClick={() => {
            setMenu(false);
            void shareReceiptPdf(card, currency);
          }}
        />
        {list.some((d) => d.daysLeft >= 0) && (
          <SheetItem
            icon="calendar"
            label="Add deadlines to Calendar"
            hint="Alerts even when the app is closed"
            onClick={() => {
              setMenu(false);
              void addToCalendar(list, currency, 'deadlines');
            }}
          />
        )}
        <SheetItem
          icon="trash"
          label="Delete"
          onClick={async () => {
            setMenu(false);
            if (!window.confirm(`Delete “${cardName(card)}”? This can’t be undone.`)) return;
            await deleteCard(card.id);
            toast('Deleted');
            void checkReminders();
            back({ name: 'home' });
          }}
        />
      </Sheet>

      <AmountSheet
        open={ask === 'returned'}
        title="Nice. How much did you get back?"
        hint="It’s added to your Savings."
        initial={card.total}
        confirmLabel="Mark as returned"
        optional
        onClose={() => setAsk(null)}
        onConfirm={async (amount) => {
          setAsk(null);
          if (amount) await addSaving({ cardId: card.id, kind: 'return', amount, date: today, label: `Returned ${cardName(card)}${card.store ? ` at ${card.store}` : ''}` });
          await set({ returnStatus: 'returned' }, 'Marked as returned');
        }}
      />
      <AmountSheet
        open={ask === 'warranty'}
        title="What would the fix have cost?"
        hint="The repair or replacement you didn’t pay for. It’s added to your Savings."
        initial={card.total}
        confirmLabel="Save claim"
        onClose={() => setAsk(null)}
        onConfirm={async (amount) => {
          setAsk(null);
          if (!amount) return;
          await addSaving({ cardId: card.id, kind: 'warranty', amount, date: today, label: `Warranty claim: ${cardName(card)}` });
          toast('Claim saved');
        }}
      />
      <AmountSheet
        open={ask === 'used'}
        title="How much did it save you?"
        hint="It’s added to your Savings."
        initial={card.balance ?? card.total}
        confirmLabel="Mark as used"
        optional
        onClose={() => setAsk(null)}
        onConfirm={async (amount) => {
          setAsk(null);
          if (amount) await addSaving({ cardId: card.id, kind: 'coupon', amount, date: today, label: `${cardName(card)}${card.store ? ` at ${card.store}` : ''}` });
          await set({ used: true }, 'Coupon used');
        }}
      />
      <AmountSheet
        open={ask === 'spend'}
        title="How much did you spend?"
        hint={`Balance: ${money(card.balance)}`}
        initial={null}
        confirmLabel="Update balance"
        onClose={() => setAsk(null)}
        onConfirm={async (amount) => {
          setAsk(null);
          if (!amount) return;
          const left = Math.max(0, (card.balance ?? 0) - amount);
          await set({ balance: left, used: left === 0 }, left === 0 ? 'All used up' : `${money(left)} left`);
        }}
      />

      {photo && imageUrl && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black" role="dialog" aria-modal="true" aria-label="Receipt photo">
          <div className="sticky top-0 flex justify-end p-3 pt-[calc(env(safe-area-inset-top)+8px)]">
            <IconButton icon="close" label="Close photo" onClick={() => setPhoto(false)} className="bg-black/60" />
          </div>
          <img src={imageUrl} alt={`Receipt from ${card.store || 'store'}`} className="mx-auto -mt-16 w-full max-w-2xl" />
        </div>
      )}
    </>
  );
}

export default function CardScreen({ id }: { id: string }) {
  const card = useCard(id);
  return (
    <div className="min-h-screen-safe bg-ink">
      {card === undefined && (
        <div className="flex justify-center py-24">
          <Spinner label="Loading" />
        </div>
      )}
      {card === null && (
        <>
          <Header title="" onBack={() => back({ name: 'home' })} />
          <p className="p-8 text-center text-white/60">This card was deleted.</p>
        </>
      )}
      {card && <CardView card={card} />}
    </div>
  );
}
