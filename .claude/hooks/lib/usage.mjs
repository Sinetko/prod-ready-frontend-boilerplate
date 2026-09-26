import { createReadStream } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

export async function turnUsage(event) {
  const source = event.agent_transcript_path || event.transcript_path;
  if (typeof source !== 'string') throw new Error('Transcript path unavailable; usage could not be measured');
  const path = source.startsWith('~/') ? resolve(homedir(), source.slice(2)) : resolve(event.cwd || '.', source);
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const messages = new Map();
  let cacheRead;
  let malformed = false;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        malformed = true;
        continue;
      }
      const content = entry.message?.content;
      const human =
        entry.type === 'user' &&
        !entry.isMeta &&
        (typeof content === 'string' ||
          (Array.isArray(content) && content.some((block) => block.type !== 'tool_result')));
      if (human) {
        messages.clear();
        cacheRead = undefined;
        malformed = false;
      }
      if (entry.type !== 'assistant' || !entry.message?.usage) continue;
      const { usage, id } = entry.message;
      const count = usage.output_tokens;
      // Transcript entries can repeat one streamed API message across content blocks.
      if (Number.isFinite(count) && count >= 0) {
        const key = id || entry.uuid;
        if (key) messages.set(key, Math.max(messages.get(key) || 0, count));
      }
      if (Number.isFinite(usage.cache_read_input_tokens) && usage.cache_read_input_tokens >= 0) {
        cacheRead = usage.cache_read_input_tokens;
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return {
    cache_read_input_tokens: cacheRead,
    output_tokens: messages.size ? [...messages.values()].reduce((sum, value) => sum + value, 0) : undefined,
    incomplete: malformed,
  };
}
