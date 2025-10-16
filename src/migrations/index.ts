import * as migration_20251009_212607 from './20251009_212607';
import * as migration_20251011_061037 from './20251011_061037';
import * as migration_20251016_051042 from './20251016_051042';
import * as migration_20251016_160843 from './20251016_160843';
import * as migration_20251016_161726 from './20251016_161726';

export const migrations = [
  {
    up: migration_20251009_212607.up,
    down: migration_20251009_212607.down,
    name: '20251009_212607',
  },
  {
    up: migration_20251011_061037.up,
    down: migration_20251011_061037.down,
    name: '20251011_061037',
  },
  {
    up: migration_20251016_051042.up,
    down: migration_20251016_051042.down,
    name: '20251016_051042',
  },
  {
    up: migration_20251016_160843.up,
    down: migration_20251016_160843.down,
    name: '20251016_160843',
  },
  {
    up: migration_20251016_161726.up,
    down: migration_20251016_161726.down,
    name: '20251016_161726'
  },
];
