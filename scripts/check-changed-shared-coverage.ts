import { coverage } from './guards/repository';
import { report } from './guards/source';

try {
  report(coverage(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
