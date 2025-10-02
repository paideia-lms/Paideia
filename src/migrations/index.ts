import * as migration_20250925_053233 from './20250925_053233';
import * as migration_20250926_032201 from './20250926_032201';
import * as migration_20250929_193151 from './20250929_193151';
import * as migration_20251002_000526 from './20251002_000526';
import * as migration_20251002_062638 from './20251002_062638';
import * as migration_20251002_202121 from './20251002_202121';
import * as migration_20251002_203035 from './20251002_203035';
import * as migration_20251002_210100 from './20251002_210100';
import * as migration_20251002_213403 from './20251002_213403';
import * as migration_20251002_232626 from './20251002_232626';

export const migrations = [
  {
    up: migration_20250925_053233.up,
    down: migration_20250925_053233.down,
    name: '20250925_053233',
  },
  {
    up: migration_20250926_032201.up,
    down: migration_20250926_032201.down,
    name: '20250926_032201',
  },
  {
    up: migration_20250929_193151.up,
    down: migration_20250929_193151.down,
    name: '20250929_193151',
  },
  {
    up: migration_20251002_000526.up,
    down: migration_20251002_000526.down,
    name: '20251002_000526',
  },
  {
    up: migration_20251002_062638.up,
    down: migration_20251002_062638.down,
    name: '20251002_062638',
  },
  {
    up: migration_20251002_202121.up,
    down: migration_20251002_202121.down,
    name: '20251002_202121',
  },
  {
    up: migration_20251002_203035.up,
    down: migration_20251002_203035.down,
    name: '20251002_203035',
  },
  {
    up: migration_20251002_210100.up,
    down: migration_20251002_210100.down,
    name: '20251002_210100',
  },
  {
    up: migration_20251002_213403.up,
    down: migration_20251002_213403.down,
    name: '20251002_213403',
  },
  {
    up: migration_20251002_232626.up,
    down: migration_20251002_232626.down,
    name: '20251002_232626'
  },
];
