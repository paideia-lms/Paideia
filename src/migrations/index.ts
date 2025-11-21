import * as migration_20251103_161045_v0_5_0 from './20251103_161045_v0_5_0';
import * as migration_20251108_175955_v0_5_5 from './20251108_175955_v0_5_5';
import * as migration_20251108_205148_v0_5_6 from './20251108_205148_v0_5_6';
import * as migration_20251112_215652_v0_6_0 from './20251112_215652_v0_6_0';
import * as migration_20251115_192550_v0_7_0 from './20251115_192550_v0_7_0';
import * as migration_20251119_005342_v0_7_1 from './20251119_005342_v0_7_1';
import * as migration_20251121_012340_v0_7_2 from './20251121_012340_v0_7_2';
import * as migration_20251121_203628 from './20251121_203628';
import * as migration_20251121_215049 from './20251121_215049';
import * as migration_20251121_215303 from './20251121_215303';

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
    up: migration_20251115_192550_v0_7_0.up,
    down: migration_20251115_192550_v0_7_0.down,
    name: '20251115_192550_v0_7_0',
  },
  {
    up: migration_20251119_005342_v0_7_1.up,
    down: migration_20251119_005342_v0_7_1.down,
    name: '20251119_005342_v0_7_1',
  },
  {
    up: migration_20251121_012340_v0_7_2.up,
    down: migration_20251121_012340_v0_7_2.down,
    name: '20251121_012340_v0_7_2',
  },
  {
    up: migration_20251121_203628.up,
    down: migration_20251121_203628.down,
    name: '20251121_203628',
  },
  {
    up: migration_20251121_215049.up,
    down: migration_20251121_215049.down,
    name: '20251121_215049',
  },
  {
    up: migration_20251121_215303.up,
    down: migration_20251121_215303.down,
    name: '20251121_215303'
  },
];
