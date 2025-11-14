import * as migration_20251103_161045_v0_5_0 from './20251103_161045_v0_5_0';
import * as migration_20251108_175955_v0_5_5 from './20251108_175955_v0_5_5';
import * as migration_20251108_205148_v0_5_6 from './20251108_205148_v0_5_6';
import * as migration_20251112_215652_v0_6_0 from './20251112_215652_v0_6_0';
import * as migration_20251113_192112 from './20251113_192112';
import * as migration_20251114_225405 from './20251114_225405';

export const migrations = [
  {
    up: migration_20251103_161045_v0_5_0.up,
    down: migration_20251103_161045_v0_5_0.down,
    name: '20251103_161045_v0_5_0',
  },
  {
    up: migration_20251108_175955_v0_5_5.up,
    down: migration_20251108_175955_v0_5_5.down,
    name: '20251108_175955_v0_5_5',
  },
  {
    up: migration_20251108_205148_v0_5_6.up,
    down: migration_20251108_205148_v0_5_6.down,
    name: '20251108_205148_v0_5_6',
  },
  {
    up: migration_20251112_215652_v0_6_0.up,
    down: migration_20251112_215652_v0_6_0.down,
    name: '20251112_215652_v0_6_0',
  },
  {
    up: migration_20251113_192112.up,
    down: migration_20251113_192112.down,
    name: '20251113_192112',
  },
  {
    up: migration_20251114_225405.up,
    down: migration_20251114_225405.down,
    name: '20251114_225405'
  },
];
