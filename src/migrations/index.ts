import * as migration_20251103_161045_v0_5_0 from './20251103_161045_v0_5_0';
import * as migration_20251108_175955_v0_5_5 from './20251108_175955_v0_5_5';
import * as migration_20251108_205148_v0_5_6 from './20251108_205148_v0_5_6';
import * as migration_20251110_212010 from './20251110_212010';
import * as migration_20251111_000840 from './20251111_000840';
import * as migration_20251111_001644 from './20251111_001644';
import * as migration_20251111_220007 from './20251111_220007';

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
    up: migration_20251110_212010.up,
    down: migration_20251110_212010.down,
    name: '20251110_212010',
  },
  {
    up: migration_20251111_000840.up,
    down: migration_20251111_000840.down,
    name: '20251111_000840',
  },
  {
    up: migration_20251111_001644.up,
    down: migration_20251111_001644.down,
    name: '20251111_001644',
  },
  {
    up: migration_20251111_220007.up,
    down: migration_20251111_220007.down,
    name: '20251111_220007'
  },
];
