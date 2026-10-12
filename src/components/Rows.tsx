import type { Deadline } from '../deadlines/deadlines';
import { useImageUrl } from '../data/hooks';
import { cardName, KIND_LABEL, type Card } from '../data/types';
import { countdown, formatShort, relativeDay } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { navigate } from '../lib/router';
import { useSettings } from '../settings';
import { Icon, type IconName } from './Icon';

export const KIND_ICON: Record<Card['kind'], IconName> = { purchase: 'receipt', coupon: 'tag', giftcard: 'gift', credit: 'card', renewal: 'repeat' };
const DEADLINE_LABEL: Record<Deadline['kind'], string> = {
  return: 'Return by',
  warranty: 'Warranty ends',
  expires: 'Expires',
  price: 'Price-drop refund until',
  refund: 'Check refund',
  charge: 'Charges',
};

export function Thumb({ card, size = 48 }: { card: Card; size?: number }) {
  const url = useImageUrl(card.hasImage ? card.id : null);
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-white/70" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icon name={KIND_ICON[card.kind]} size={size > 40 ? 22 : 18} />}
    </span>
  );
}

export function DeadlineRow({ d }: { d: Deadline }) {
  const { currency } = useSettings();
  const color = d.urgency === 'week' ? 'text-urgent' : d.urgency === 'past' ? 'text-white/40' : d.urgency === 'month' ? 'text-warn' : 'text-white/60';
  const money = d.amount ? formatMoney(d.amount, currency, { whole: true }) : '';
  const label = `${DEADLINE_LABEL[d.kind]} ${formatShort(d.date)}: ${d.name}${d.store ? ` at ${d.store}` : ''}${money ? `, ${money}` : ''}. ${countdown(d.daysLeft)}.`;
  return (
    <li>
      <button
        type="button"
        aria-label={label}
        onClick={() => navigate({ name: 'card', id: d.cardId })}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5"
      >
        <Thumb card={d.card} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{d.name}</span>
          <span className="block truncate text-[13px] text-white/55">
            {DEADLINE_LABEL[d.kind]} {formatShort(d.date)}
            {d.store ? ` · ${d.store}` : ''}
            {money ? ` · ${money}` : ''}
          </span>
        </span>
        <span className={`shrink-0 text-right text-[13px] font-semibold tabular ${color}`}>
          {d.kind === 'refund' && d.daysLeft <= 0 ? 'Check now' : d.urgency === 'later' ? relativeDay(d.date) : countdown(d.daysLeft)}
        </span>
      </button>
    </li>
  );
}

export function CardRow({ card, right }: { card: Card; right?: string }) {
  const { currency } = useSettings();
  const amount = card.kind === 'purchase' ? card.total : card.balance;
  const sub = [card.store || KIND_LABEL[card.kind], formatShort(card.date)];
  if (card.kind === 'purchase' && card.returnStatus === 'returned') sub.push('Returned');
  if (card.kind === 'purchase' && card.returnStatus === 'returning') sub.push('Returning');
  if (card.kind === 'renewal' && card.used) sub.push('Done');
  else if (card.kind !== 'purchase' && card.used) sub.push('Used');
  return (
    <li>
      <button type="button" onClick={() => navigate({ name: 'card', id: card.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5">
        <Thumb card={card} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{cardName(card)}</span>
          <span className="block truncate text-[13px] text-white/55">{sub.join(' · ')}</span>
        </span>
        <span className="shrink-0 text-[15px] font-semibold tabular text-white/85">{right ?? (amount !== null ? formatMoney(amount, currency) : '')}</span>
      </button>
    </li>
  );
}
