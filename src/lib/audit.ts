// ==============================================================================
// StarRuby.in Banking System — Cell-Level Version Control Engine
// Every cell change writes to record_versions; supports 1-click restore.
// ==============================================================================

import { RecordVersion } from '../types/database';

let versionCounter = 1000;

export function createCellAuditDelta<T extends Record<string, any>>(
  tableName: string,
  recordId: string,
  oldRecord: T,
  newRecord: T,
  changedBy: string,
  existingVersions: RecordVersion[] = []
): RecordVersion[] {
  // Ensure versionCounter is always greater than existing versions to prevent primary key collisions after reload
  const maxExistingId = Math.max(...existingVersions.map(v => v.id || 0), 1000);
  if (versionCounter < maxExistingId) {
    versionCounter = maxExistingId;
  }

  const versions: RecordVersion[] = [];
  const allKeys = Array.from(new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]));

  // Skip system internal fields from cell versioning
  const ignoredKeys = new Set(['updated_at', 'created_at']);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;

    const oldVal = oldRecord[key];
    const newVal = newRecord[key];

    // Format for comparison
    const oldStr = oldVal === undefined || oldVal === null ? '' : String(oldVal);
    const newStr = newVal === undefined || newVal === null ? '' : String(newVal);

    if (oldStr !== newStr) {
      // Find latest version count for this specific column
      const colVersions = existingVersions.filter(
        v => v.table_name === tableName && v.record_id === recordId && v.column_name === key
      );
      const nextVersionNo = colVersions.length > 0 ? Math.max(...colVersions.map(v => v.version_no)) + 1 : 1;

      versionCounter++;
      versions.push({
        id: versionCounter,
        table_name: tableName,
        record_id: recordId,
        column_name: key,
        old_value: oldStr,
        new_value: newStr,
        version_no: nextVersionNo,
        changed_by: changedBy,
        changed_at: new Date().toISOString(),
      });
    }
  }

  return versions;
}
