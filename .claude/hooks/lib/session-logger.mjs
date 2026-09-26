import { appendFileSync } from 'node:fs';

import { advisory, cachePath, hash, input, rootFor } from './runtime.mjs';
import { turnUsage } from './usage.mjs';

await advisory(async () => {
  const event = input();
  const record = {
    timestamp: new Date().toISOString(),
    event: event.hook_event_name,
    session_id: event.session_id,
    agent_id: event.agent_id,
    agent_type: event.agent_type,
    tool_name: event.tool_name,
    tool_use_id: event.tool_use_id,
  };
  if (['Stop', 'SubagentStop'].includes(event.hook_event_name)) {
    try {
      record.usage = await turnUsage(event);
    } catch {
      record.usage_unavailable = true;
    }
  }
  const path = cachePath(rootFor(event), `session-${hash(String(event.session_id || 'unknown'))}.jsonl`);
  appendFileSync(path, JSON.stringify(record) + '\n', { mode: 0o600 });
});
