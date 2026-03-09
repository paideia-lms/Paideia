import * as migration_20260309_042424 from './20260309_042424';

export const migrations = [
  {
    up: migration_20260309_042424.up,
    down: migration_20260309_042424.down,
    name: '20260309_042424'
  },
];
