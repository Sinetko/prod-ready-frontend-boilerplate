import { boundaries } from './guards/code';
import { report } from './guards/source';

try {
  if (process.argv.length > 2) throw new Error('This guard accepts no flags.');
  report(boundaries());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
