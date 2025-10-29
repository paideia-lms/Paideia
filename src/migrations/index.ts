import * as migration_20251028_234113 from './20251028_234113';
import * as migration_20251029_160141 from './20251029_160141';

export const migrations = [
  {
    up: migration_20251028_234113.up,
    down: migration_20251028_234113.down,
    name: '20251028_234113',
  },
  {
    up: migration_20251029_160141.up,
    down: migration_20251029_160141.down,
    name: '20251029_160141'
  },
];
