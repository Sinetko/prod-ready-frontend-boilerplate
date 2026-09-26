import { advisory, input, notify } from './runtime.mjs';
import { turnUsage } from './usage.mjs';

await advisory(async () => {
  const kind = process.argv[2];
  const output = kind === 'output';
  if (process.env[output ? 'CLAUDE_DISABLE_OUTPUT_BUDGET' : 'CLAUDE_DISABLE_CONTEXT_BUDGET'] === '1') return;
  const usage = await turnUsage(input());
  const field = output ? 'output_tokens' : 'cache_read_input_tokens';
  const value = usage[field];
  const messages = [];
  if (value === undefined) messages.push(`${kind}-budget: ${field} unavailable; no token estimate substituted.`);
  if (usage.incomplete) messages.push(`${kind}-budget: transcript has incomplete records; usage may be partial.`);
  const warning = output ? 1200 : 250000;
  const critical = output ? 3000 : 400000;
  if (value > warning) {
    messages.push(`${kind}-budget ${value > critical ? 'CRITICAL' : 'WARNING'}: ${field}=${value}. Advisory only.`);
  }
  notify(messages);
});
