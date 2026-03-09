import * as migration_20260307_164215 from './20260307_164215';
import * as migration_20260307_172137 from './20260307_172137';

export const migrations = [
  {
    up: migration_20260307_164215.up,
    down: migration_20260307_164215.down,
    name: '20260307_164215',
  },
  {
    up: migration_20260307_172137.up,
    down: migration_20260307_172137.down,
    name: '20260307_172137'
  },
];
