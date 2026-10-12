import type { ReactNode } from 'react';
import type { Card } from '../data/types';
import type { Deadline } from '../deadlines/deadlines';
import { REFUND_CHECK_DAYS } from '../config/policies';
import { addDays, countdown, formatLong, formatShort, type ISODate } from '../lib/dates';
import { Icon, type IconName } from './Icon';
import { Button } from './ui';

export function Tile({ icon, label, value, sub, tone, children }: { icon: IconName; label: string; value: string; sub?: string; tone?: 'urgent' | 'warn' | 'muted' | 'done'; children?: ReactNode }) {
  const color = { urgent: 'text-urgent', warn: 'text-warn', muted: 'text-white/45', done: 'text-good' }[tone ?? 'muted'];
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

export const toneFor = (d?: Deadline) => (!d ? 'muted' : d.urgency === 'week' ? 'urgent' : d.urgency === 'month' ? 'warn' : d.urgency === 'past' ? 'muted' : 'done');

const small = 'min-h-[36px] px-4 text-[14px]';
const ghost = 'min-h-[36px] px-3 text-[13px]';

interface Props {
  card: Card;
  ret?: Deadline;
  refund?: Deadline;
  today: ISODate;
  onAsk: (what: 'returned') => void;
  onStart: () => void;
  onShowLabel: () => void;
  onAddLabel: () => void;
  /** A return label / QR picture (or code) is saved. */
  hasLabel: boolean;
  set: (patch: Partial<Card>, message: string) => Promise<void>;
}

/**
 * The return, start to finish: open → "Return it" (in store / by mail) →
 * mailed: save the label, "Dropped it off" → "Did the refund arrive?" → returned.
 */
export function ReturnTile({ card, ret, refund, today, onAsk, onStart, onShowLabel, onAddLabel, hasLabel, set }: Props) {
  if (card.returnStatus === 'returned') {
    return (
      <Tile icon="check" label="Return" value="Returned" tone="done">
        <Button variant="ghost" className={ghost} onClick={() => void set({ returnStatus: 'open', returnMethod: null, droppedOffOn: null, refundCheckOn: null }, 'Marked as not returned')}>
          <Icon name="undo" size={16} /> Undo
        </Button>
      </Tile>
    );
  }

  const cancel = (
    <Button variant="ghost" className={ghost} onClick={() => void set({ returnStatus: 'open', returnMethod: null, droppedOffOn: null, refundCheckOn: null }, 'Return cancelled')}>
      Not returning it
    </Button>
  );

  if (card.returnStatus === 'returning' && card.returnMethod === 'mail' && card.droppedOffOn) {
    const due = refund && refund.daysLeft <= 0;
    return (
      <Tile
        icon="box"
        label="Refund on its way"
        value={`Dropped off ${formatShort(card.droppedOffOn, today)}`}
        sub={card.refundCheckOn ? (due ? 'Has it arrived?' : `We’ll check with you ${formatShort(card.refundCheckOn, today)}`) : undefined}
        tone={due ? 'urgent' : 'muted'}
      >
        <Button className={small} onClick={() => onAsk('returned')}>
          Refund arrived
        </Button>
        {due && (
          <Button variant="secondary" className={small} onClick={() => void set({ refundCheckOn: addDays(today, 7) }, 'We’ll ask again in a week')}>
            Not yet
          </Button>
        )}
        {hasLabel && (
          <Button variant="ghost" className={ghost} onClick={onShowLabel}>
            <Icon name="qr" size={16} /> Label
          </Button>
        )}
      </Tile>
    );
  }

  if (card.returnStatus === 'returning') {
    const mail = card.returnMethod === 'mail';
    return (
      <Tile
        icon={mail ? 'box' : 'store'}
        label={mail ? 'Drop it off by' : 'Take it back by'}
        value={card.returnBy ? formatLong(card.returnBy) : 'No date set'}
        sub={ret ? countdown(ret.daysLeft) : card.returnBy ? 'Window closed' : undefined}
        tone={toneFor(ret)}
      >
        {mail ? (
          <>
            <Button
              className={small}
              onClick={() => void set({ droppedOffOn: today, refundCheckOn: addDays(today, REFUND_CHECK_DAYS) }, `Dropped off. We’ll check the refund in ${REFUND_CHECK_DAYS} days.`)}
            >
              Dropped it off
            </Button>
            {hasLabel ? (
              <Button variant="secondary" className={small} onClick={onShowLabel}>
                <Icon name="qr" size={16} /> Show label
              </Button>
            ) : (
              <Button variant="secondary" className={small} onClick={onAddLabel}>
                <Icon name="qr" size={16} /> Add label or QR
              </Button>
            )}
          </>
        ) : (
          <Button className={small} onClick={() => onAsk('returned')}>
            I returned it
          </Button>
        )}
        {cancel}
      </Tile>
    );
  }

  if (!card.returnBy) {
    return (
      <Tile icon="undo" label="Return by" value="No date set" sub={card.store ? 'Check the store’s policy, then add it.' : undefined} tone="muted">
        <Button variant="secondary" className={small} onClick={onStart}>
          Return it
        </Button>
      </Tile>
    );
  }

  return (
    <Tile
      icon="undo"
      label="Return by"
      value={formatLong(card.returnBy)}
      sub={card.returnStatus === 'kept' ? 'Keeping it' : ret ? countdown(ret.daysLeft) : 'Window closed'}
      tone={card.returnStatus === 'kept' ? 'muted' : toneFor(ret)}
    >
      {card.returnStatus === 'open' && ret && ret.daysLeft >= -7 && (
        <>
          <Button className={small} onClick={onStart}>
            Return it
          </Button>
          <Button variant="secondary" className={small} onClick={() => void set({ returnStatus: 'kept' }, 'Got it. No more return reminders.')}>
            Keeping it
          </Button>
        </>
      )}
      {card.returnStatus === 'kept' && (
        <Button variant="ghost" className={ghost} onClick={() => void set({ returnStatus: 'open' }, 'Return reminders are back on')}>
          <Icon name="undo" size={16} /> Remind me again
        </Button>
      )}
    </Tile>
  );
}
