import * as migration_20251103_161045_v0_5_0 from './20251103_161045_v0_5_0';
import * as migration_20251108_175955_v0_5_5 from './20251108_175955_v0_5_5';

export const migrations = [
  {
    up: migration_20251103_161045_v0_5_0.up,
    down: migration_20251103_161045_v0_5_0.down,
    name: '20251103_161045_v0_5_0',
  },
  {
    up: migration_20251108_175955_v0_5_5.up,
    down: migration_20251108_175955_v0_5_5.down,
    name: '20251108_175955_v0_5_5'
  },
];
