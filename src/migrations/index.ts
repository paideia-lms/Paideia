import * as migration_20250925_053233 from './20250925_053233';
import * as migration_20250926_032201 from './20250926_032201';

export const migrations = [
  {
    up: migration_20250925_053233.up,
    down: migration_20250925_053233.down,
    name: '20250925_053233',
  },
  {
    up: migration_20250926_032201.up,
    down: migration_20250926_032201.down,
    name: '20250926_032201'
  },
];
