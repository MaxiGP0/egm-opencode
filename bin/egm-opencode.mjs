#!/usr/bin/env node
import { main } from '../src/cli.mjs';

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message ?? error);
    if (error.conflicts) {
      console.error('');
      console.error('Conflicts:');
      for (const file of error.conflicts) console.error(`  - ${file.abs}`);
    }
    if (error.modified) {
      console.error('');
      console.error('Modified files:');
      for (const file of error.modified) console.error(`  - ${file}`);
    }
    process.exitCode = 1;
  });
