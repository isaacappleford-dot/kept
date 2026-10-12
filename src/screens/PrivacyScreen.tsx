import { APP } from '../config/app';
import { Header } from '../components/ui';
import { back } from '../lib/router';

export default function PrivacyScreen() {
  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Privacy" onBack={() => back({ name: 'settings' })} />
      <article className="mx-auto max-w-prose space-y-4 px-5 text-[15px] leading-relaxed text-white/80">
        <h2 className="text-[20px] font-semibold text-white">The short version: your receipts never leave your phone.</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>No servers.</strong> {APP.name} is a static web app. After it loads, it makes no network requests except to update itself from the same
            site.
          </li>
          <li>
            <strong>On-device reading.</strong> Receipt text is read by a text recogniser running in your browser. Photos and PDFs are never uploaded.
          </li>
          <li>
            <strong>No accounts, ads, analytics or tracking.</strong> Nothing to sign up for, nothing to buy, and your data is never sold.
          </li>
          <li>
            <strong>Local storage.</strong> Cards, photos and savings are stored in this browser’s storage (IndexedDB) on this device. Clearing browser data,
            removing the Home Screen app, or (on iPhone) not opening the app for a long time can delete them, so save a backup now and then.
          </li>
          <li>
            <strong>Backups and exports</strong> are files you save yourself, wherever you choose (iCloud Drive, Files, email). We never see them.
          </li>
          <li>
            <strong>Reminders</strong> are worked out on the phone. Notifications are shown by your browser; calendar events go to your own calendar app.
          </li>
        </ul>
      </article>
    </div>
  );
}
