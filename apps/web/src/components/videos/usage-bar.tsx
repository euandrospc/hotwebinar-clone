import { Database } from "@/components/icons";
import styles from "@/components/management-v2.module.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(2)} ${units[i]}`;
}

export function UsageBar({ usedBytes }: { usedBytes: number }) {
  return (
    <div className={styles.storage}>
      <Database aria-hidden="true" className={styles.storageIcon} />
      <div><p>Armazenamento</p><strong>{formatBytes(usedBytes)} usados</strong></div>
    </div>
  );
}
