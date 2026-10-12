import { useEffect, useRef, useState } from 'react';
import { APP } from '../config/app';
import { Button, Header, Row, Section, Toggle } from '../components/ui';
import { exportBackup, importBackup } from '../data/backup';
import { clearAll, listCards } from '../data/db';
import { formatBytes, isPersisted, requestPersistence, storageUsage, type Usage } from '../data/storage';
import { deadlines } from '../deadlines/deadlines';
import { checkReminders, notificationPermission, requestNotifications } from '../deadlines/notify';
import { loadSampleData } from '../demo/sampleData';
import { addToCalendar, shareInventory } from '../export/actions';
import { shareOrDownload } from '../export/share';
import { isIOS, isStandalone } from '../lib/platform';
import { formatShort, todayISO } from '../lib/dates';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { dismissInstall, useInstall } from '../pwa/install';
import { setSettings, useSettings } from '../settings';

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'JPY', 'INR', 'MXN', 'CHF', 'SEK', 'NOK', 'DKK'];

export default function SettingsScreen() {
  const s = useSettings();
  const install = useInstall();
  const restore = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [perm, setPerm] = useState(notificationPermission());

  useEffect(() => {
    void storageUsage().then(setUsage);
    void isPersisted().then(setPersisted);
  }, []);

  const setNotifications = async (on: boolean) => {
    if (!on) return setSettings({ notifications: false });
    const ok = await requestNotifications();
    setPerm(notificationPermission());
    setSettings({ notifications: ok });
    if (ok) {
      toast('Reminders are on');
      void checkReminders();
    } else toast(notificationPermission() === 'denied' ? 'Notifications are blocked in your phone’s settings' : 'Notifications weren’t allowed');
  };

  const notifyHint =
    perm === 'unsupported'
      ? isIOS && !isStandalone()
        ? 'On iPhone, add Kept to your Home Screen first (iOS 16.4 or later).'
        : 'Not available in this browser. Use Calendar instead.'
      : perm === 'denied'
        ? 'Blocked. Allow notifications for this site in your phone’s settings.'
        : 'Shown when you open the app and something is due.';

  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Settings" onBack={() => back({ name: 'home' })} />
      <div className="mx-auto max-w-lg px-3">
        <Section title="Reminders">
          <Toggle label="Notifications" hint={notifyHint} checked={s.notifications && perm === 'granted'} onChange={(v) => void setNotifications(v)} />
          <Toggle label="Badge on app icon" hint="How many deadlines are due this week" checked={s.badge} onChange={(v) => {
            setSettings({ badge: v });
            void checkReminders();
          }} />
          <Row
            label="Add all deadlines to Calendar"
            hint="The most reliable reminders: your calendar alerts you even when Kept is closed"
            icon="calendar"
            onClick={async () => void addToCalendar(deadlines(await listCards(), todayISO()), s.currency)}
          />
        </Section>

        <Section title="Scanning">
          <Toggle label="Read receipts automatically" hint="Text is read on this phone. Turn off to type details yourself." checked={s.autoRead} onChange={(v) => setSettings({ autoRead: v })} />
          <label className="flex min-h-[56px] items-center gap-4 px-4">
            <span className="flex-1 text-[16px]">Currency</span>
            <select
              value={s.currency}
              onChange={(e) => setSettings({ currency: e.target.value })}
              className="min-h-[40px] rounded-lg bg-white/10 px-3 text-white focus:outline focus:outline-2 focus:outline-accent"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c} className="bg-ink-800">
                  {c}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <Section title="Backup">
          <div className="px-4 py-3 text-[14px] text-white/75">
            <p>Your receipts live only on this phone{usage ? ` (${formatBytes(usage.used)})` : ''}. Save a backup to iCloud Drive, Google Drive or Files to move phones or be safe.</p>
            <p className="mt-1 text-[13px] text-white/50">{s.lastBackupAt ? `Last backup: ${formatShort(new Date(s.lastBackupAt).toISOString().slice(0, 10))}` : 'No backup yet.'}</p>
          </div>
          <Row
            label="Save a backup"
            icon="download"
            onClick={async () => {
              const blob = await exportBackup();
              const outcome = await shareOrDownload(new File([blob], `${APP.filePrefix}-backup-${todayISO()}.json`, { type: 'application/json' }));
              if (outcome === 'shared' || outcome === 'downloaded') {
                setSettings({ lastBackupAt: Date.now() });
                toast('Backup saved');
              } else if (outcome === 'needs-gesture') toast('Tap again to save');
            }}
          />
          <Row label="Restore from a backup" hint="Adds its cards to this phone" onClick={() => restore.current?.click()} />
          <input
            ref={restore}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const n = await importBackup(f);
                toast(`Restored ${n} card${n === 1 ? '' : 's'}`);
                void checkReminders();
              } catch (err) {
                toast((err as Error).message);
              }
            }}
          />
          {persisted === false && (
            <Row
              label="Protect my receipts"
              hint="Ask the browser not to clear them when space is low"
              onClick={async () => {
                const ok = await requestPersistence();
                setPersisted(ok);
                toast(ok ? 'Storage protected' : 'The browser declined. Installing the app usually helps.');
              }}
            />
          )}
        </Section>

        <Section title="Export">
          <Row label="Everything I own (PDF)" hint="For insurance claims" icon="file" onClick={async () => void shareInventory(await listCards(), s.currency, 'pdf')} />
          <Row label="Everything I own (spreadsheet)" icon="download" onClick={async () => void shareInventory(await listCards(), s.currency, 'csv')} />
        </Section>

        {install.mode && (
          <Section title="Install">
            {install.mode === 'android' ? (
              <Row label={`Install ${APP.name}`} hint="Adds it to your home screen and works offline" onClick={() => void install.prompt()} />
            ) : (
              <div className="px-4 py-3 text-[14px] text-white/75">
                <p className="font-medium text-white">Add to Home Screen</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>Tap the Share button in Safari.</li>
                  <li>Choose “Add to Home Screen”.</li>
                  <li>Open {APP.name} from your Home Screen. Reminders and the badge need this on iPhone.</li>
                </ol>
                <button type="button" className="mt-2 min-h-[44px] text-[13px] text-white/50" onClick={dismissInstall}>
                  Don’t remind me
                </button>
              </div>
            )}
          </Section>
        )}

        <Section title="Data">
          <Row
            label="Add sample cards"
            hint="A few made-up receipts to try things out"
            icon="plus"
            onClick={async () => {
              await loadSampleData(todayISO());
              toast('Sample cards added');
            }}
          />
          <div className="p-3">
            <Button
              variant="danger"
              className="w-full"
              onClick={async () => {
                if (!window.confirm('Delete every receipt, card and saving on this phone? This can’t be undone.')) return;
                await clearAll();
                setUsage(await storageUsage());
                void checkReminders();
                toast('Everything deleted');
              }}
            >
              Delete everything
            </Button>
          </div>
        </Section>

        <Section title="About">
          <Row label="Privacy" hint="Everything stays on your phone" onClick={() => navigate({ name: 'privacy' })} />
          <Row label="Credits & licenses" onClick={() => navigate({ name: 'credits' })} />
          <Row label="Show the intro again" onClick={() => setSettings({ onboarded: false })} />
        </Section>
        <p className="pb-4 text-center text-[12px] text-white/40">
          {APP.name} · free, no ads, no accounts · v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
