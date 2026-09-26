import { report } from './guards/source';
import { translations } from './guards/translations';

try {
  if (process.argv.length > 2) throw new Error('This guard accepts no flags.');
  report(translations());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
