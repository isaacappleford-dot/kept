import { APP } from '../config/app';
import { shareOrDownload } from '../export/share';
import { todayISO } from '../lib/dates';
import { toast } from '../lib/toast';
import { setSettings } from '../settings';
import { exportBackup } from './backup';

/**
 * Saves a backup file through the share sheet (iPhone: Save to Files → iCloud
 * Drive). Pass a blob built ahead of time when calling from a tap, so the share
 * sheet opens while the tap still counts.
 */
export async function saveBackupFile(prebuilt?: Blob | null): Promise<boolean> {
  const blob = prebuilt ?? (await exportBackup());
  const outcome = await shareOrDownload(new File([blob], `${APP.filePrefix}-backup-${todayISO()}.json`, { type: 'application/json' }));
  if (outcome === 'shared' || outcome === 'downloaded') {
    setSettings({ lastBackupAt: Date.now() });
    toast('Backup saved');
    return true;
  }
  if (outcome === 'needs-gesture') toast('Tap again to save');
  else if (outcome === 'failed') toast('Couldn’t save the backup. Try again.');
  return false;
}
