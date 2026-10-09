import { useSyncStatus } from '../firebase/hooks';

/** Fixed pill above the tab bar, shown on every tab while the device is offline. */
export function OfflinePill({ code }: { code: string }) {
  if (useSyncStatus(code) !== 'offline') return null;
  return <div className="offline-pill" role="status">Offline — changes will sync</div>;
}
