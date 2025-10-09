import * as migration_20251009_025907 from './20251009_025907';
import * as migration_20251009_055818 from './20251009_055818';

export const migrations = [
  {
    up: migration_20251009_025907.up,
    down: migration_20251009_025907.down,
    name: '20251009_025907',
  },
  {
    up: migration_20251009_055818.up,
    down: migration_20251009_055818.down,
    name: '20251009_055818'
  },
];
