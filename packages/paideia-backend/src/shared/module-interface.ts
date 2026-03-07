import type { CollectionConfig, TaskConfig } from "payload";

export interface PaideiaModuleConstructor {
    /** The unique identifier for this module */
    readonly moduleName: string;
    
    /** 
     * Array of moduleNames this module strictly depends on.
     * These dependencies will be initialized/seeded BEFORE this module.
     */
    readonly dependencies: readonly string[];
    
    /** Collections this module provides */
    readonly collections: CollectionConfig[];
    
    /** CLI commands this module provides */
    readonly cli: Record<string, any>;
    
    /** Collections to include in search */
    readonly search: string[];
    
    /** Seed data for this module */
    readonly seedData?: any;
    
    /** Job queues this module provides */
    readonly queues: any[];
    
    /** Background tasks this module provides */
    readonly tasks: TaskConfig[];
    
    /** API endpoints this module provides */
    readonly api?: Record<string, any>;
    
    new (...args: any[]): any;
}

export type PaideiaModule = InstanceType<PaideiaModuleConstructor>;
