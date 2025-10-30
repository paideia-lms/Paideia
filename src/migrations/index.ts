import * as migration_20251028_234113 from './20251028_234113';
import * as migration_20251029_160141 from './20251029_160141';
import * as migration_20251030_202017 from './20251030_202017';

export const migrations = [
  {
    up: migration_20251028_234113.up,
    down: migration_20251028_234113.down,
    name: '20251028_234113',
  },
  {
    up: migration_20251029_160141.up,
    down: migration_20251029_160141.down,
    name: '20251029_160141',
  },
  {
    up: migration_20251030_202017.up,
    down: migration_20251030_202017.down,
    name: '20251030_202017'
  },
];
