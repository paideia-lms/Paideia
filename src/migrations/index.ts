import * as migration_20251007_162715 from './20251007_162715';
import * as migration_20251007_182533 from './20251007_182533';
import * as migration_20251007_191441 from './20251007_191441';

export const migrations = [
  {
    up: migration_20251007_162715.up,
    down: migration_20251007_162715.down,
    name: '20251007_162715',
  },
  {
    up: migration_20251007_182533.up,
    down: migration_20251007_182533.down,
    name: '20251007_182533',
  },
  {
    up: migration_20251007_191441.up,
    down: migration_20251007_191441.down,
    name: '20251007_191441'
  },
];
