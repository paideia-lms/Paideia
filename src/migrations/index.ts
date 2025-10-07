import * as migration_20251007_202416 from './20251007_202416';

export const migrations = [
  {
    up: migration_20251007_202416.up,
    down: migration_20251007_202416.down,
    name: '20251007_202416'
  },
];
