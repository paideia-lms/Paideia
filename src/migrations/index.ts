import * as migration_20251009_212607 from './20251009_212607';
import * as migration_20251011_061037 from './20251011_061037';
import * as migration_20251016_051042 from './20251016_051042';
import * as migration_20251016_160843 from './20251016_160843';
import * as migration_20251016_161726 from './20251016_161726';
import * as migration_20251016_220527 from './20251016_220527';
import * as migration_20251016_222251 from './20251016_222251';
import * as migration_20251018_195348 from './20251018_195348';
import * as migration_20251018_225421 from './20251018_225421';
import * as migration_20251021_231520 from './20251021_231520';

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
    name: '20251016_161726',
  },
  {
    up: migration_20251016_220527.up,
    down: migration_20251016_220527.down,
    name: '20251016_220527',
  },
  {
    up: migration_20251016_222251.up,
    down: migration_20251016_222251.down,
    name: '20251016_222251',
  },
  {
    up: migration_20251018_195348.up,
    down: migration_20251018_195348.down,
    name: '20251018_195348',
  },
  {
    up: migration_20251018_225421.up,
    down: migration_20251018_225421.down,
    name: '20251018_225421',
  },
  {
    up: migration_20251021_231520.up,
    down: migration_20251021_231520.down,
    name: '20251021_231520'
  },
];
