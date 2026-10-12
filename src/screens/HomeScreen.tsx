import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { InstallBanner } from '../components/InstallBanner';
import { DeadlineRow } from '../components/Rows';
import { TabBar } from '../components/TabBar';
import { Button, Header, IconButton, Sheet, Spinner } from '../components/ui';
import { exportBackup } from '../data/backup';
import { saveBackupFile } from '../data/backupActions';
import { checkinItems } from '../deadlines/digest';
import { useCards } from '../data/hooks';
import { deadlines, groupDeadlines } from '../deadlines/deadlines';
import { checkReminders, notificationPermission, requestNotifications } from '../deadlines/notify';
import { loadSampleData } from '../demo/sampleData';
import { addToCalendar } from '../export/actions';
import { todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { setSettings, useSettings } from '../settings';

const DAY = 86_400_000;

/** The "back up?" popup shows at most once per app launch, and once a month. */
let backupAskedThisLaunch = false;

function BackupPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Build the file as soon as the popup opens, so tapping Save opens the share sheet immediately.
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (open) void exportBackup().then(setBlob, () => setBlob(null));
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Back up your receipts?">
      <p className="mb-4 px-2 text-center text-[15px] text-white/70">
        They’re only on this phone. Save a copy to iCloud Drive or Files so a new phone, or deleting the app, doesn’t lose them.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          disabled={!blob}
          onClick={async () => {
            if (await saveBackupFile(blob)) onClose();
          }}
        >
          {blob ? 'Save a backup' : 'Getting it ready…'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
      </div>
    </Sheet>
  );
}

export default function HomeScreen() {
  const cards = useCards();
  const s = useSettings();
  const today = todayISO();
  const list = useMemo(() => (cards ? deadlines(cards, today) : []), [cards, today]);
  const groups = groupDeadlines(list);
  const week = list.filter((d) => d.urgency === 'week');
  const atStake = week.filter((d) => d.kind !== 'warranty').reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const [perm, setPerm] = useState(notificationPermission());
  const [backupOpen, setBackupOpen] = useState(false);

  const toDecide = useMemo(() => {
    if (!cards) return 0;
    const it = checkinItems(cards, today, s.minReminderAmount);
    return it.returns.length + it.expiring.length;
  }, [cards, today, s.minReminderAmount]);
  const showCheckin = s.checkin && toDecide > 0 && Date.now() - s.lastCheckinAt > 6 * DAY;

  // Every now and then (a month after the last backup or "Not now"), once people have
  // used Kept for a week and saved a few receipts, ask if they'd like a backup.
  useEffect(() => {
    if (!cards || backupAskedThisLaunch || cards.length < 5) return;
    const oldest = Math.min(...cards.map((c) => c.createdAt));
    if (Date.now() - oldest < 7 * DAY) return;
    if (Date.now() - Math.max(s.lastBackupAt, s.backupReminderDismissedAt) < 30 * DAY) return;
    const t = window.setTimeout(() => {
      // Counts as asked once it's actually on screen; then not again for a month.
      backupAskedThisLaunch = true;
      setSettings({ backupReminderDismissedAt: Date.now() });
      setBackupOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [cards, s.lastBackupAt, s.backupReminderDismissedAt]);

  const showNotifyCard = cards && cards.length > 0 && !s.notifications && perm !== 'unsupported' && perm !== 'denied';

  return (
    <div className="min-h-screen-safe bg-ink pb-tabs">
      <Header
        large
        title="Coming Up"
        right={
          <>
            {list.some((d) => d.daysLeft >= 0) && (
              <IconButton icon="calendar" label="Add all deadlines to Calendar" onClick={() => void addToCalendar(list, s.currency)} className="bg-transparent" />
            )}
            <IconButton icon="settings" label="Settings" onClick={() => navigate({ name: 'settings' })} className="bg-transparent" />
          </>
        }
      />
      <div className="mx-auto max-w-lg">
        {cards === undefined && (
          <div className="flex justify-center py-20">
            <Spinner label="Loading" />
          </div>
        )}

        {cards && list.length > 0 && (
          <p className="px-4 pb-3 text-[15px] text-white/65">
            {week.length === 0
              ? 'Nothing due this week.'
              : `${week.length} deadline${week.length === 1 ? '' : 's'} this week${atStake ? ` · ${formatMoney(atStake, s.currency, { whole: true })} at stake` : ''}.`}
          </p>
        )}

        {showCheckin && (
          <button
            type="button"
            onClick={() => navigate({ name: 'checkin' })}
            className="mx-3 mb-4 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-accent/15 p-4 text-left active:bg-accent/25"
          >
            <Icon name="check" size={22} className="shrink-0 text-accent" />
            <span className="flex-1">
              <span className="block text-[16px] font-semibold">Weekly check-in</span>
              <span className="block text-[13px] text-white/65">
                {toDecide} thing{toDecide === 1 ? '' : 's'} to decide · about a minute
              </span>
            </span>
            <Icon name="arrow" size={18} className="text-white/50" />
          </button>
        )}

        {showNotifyCard && (
          <div className="mx-3 mb-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-[13px] text-white/80">
            <Icon name="bell" size={22} className="shrink-0 text-accent" />
            <p className="flex-1">Get a heads-up at 9 am when a deadline is close, even when the app is closed.</p>
            <Button
              className="min-h-[36px] px-3 text-[13px]"
              onClick={async () => {
                const ok = await requestNotifications();
                setPerm(notificationPermission());
                setSettings({ notifications: ok });
                if (ok) void checkReminders();
                else toast('Notifications aren’t allowed. Calendar alerts still work.');
              }}
            >
              Turn on
            </Button>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.id} className="mb-5" aria-labelledby={`g-${g.id}`}>
            <h2 id={`g-${g.id}`} className={`mb-1 px-4 text-[13px] font-semibold uppercase tracking-wide ${g.id === 'week' ? 'text-urgent' : 'text-white/45'}`}>
              {g.title}
            </h2>
            <ul className="mx-3 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5" aria-label={g.title}>
              {g.items.map((d) => (
                <DeadlineRow key={d.key} d={d} />
              ))}
            </ul>
          </section>
        ))}

        {cards && list.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
            <svg viewBox="0 0 120 120" className="w-28" aria-hidden="true">
              <path d="M30 14h60v92l-10-7-10 7-10-7-10 7-10-7-10 7z" fill="#f4f1ea" opacity="0.9" />
              <path d="M42 36h36M42 50h36M42 64h22" stroke="#0b0c0c" strokeOpacity="0.3" strokeWidth="5" strokeLinecap="round" />
              <circle cx="88" cy="86" r="20" fill="#ff5a5f" />
              <path d="M79 86l6 6 12-13" stroke="#0b0c0c" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-[21px] font-semibold">{cards.length ? 'Nothing coming up' : 'Snap a receipt once'}</h2>
            <p className="text-[15px] text-white/60">
              {cards.length
                ? 'No return windows, warranties or coupons ending soon.'
                : 'Kept turns it into a card with the return-by and warranty dates, then reminds you before money slips away.'}
            </p>
            <Button className="mt-2 w-full max-w-xs" onClick={() => navigate({ name: 'scan' })}>
              <Icon name="scan" size={20} /> Scan a receipt
            </Button>
            {cards.length === 0 && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await loadSampleData(today);
                  toast('Added sample cards. Delete them any time in Settings.');
                }}
              >
                Try it with sample cards
              </Button>
            )}
          </div>
        )}

        <InstallBanner />
      </div>
      <BackupPopup open={backupOpen} onClose={() => setBackupOpen(false)} />
      <TabBar current="home" />
    </div>
  );
}
