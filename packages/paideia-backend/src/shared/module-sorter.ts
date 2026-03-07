import type { PaideiaModuleConstructor } from "./module-interface";

export function sortModulesTopologically(modules: PaideiaModuleConstructor[]): PaideiaModuleConstructor[] {
    const moduleMap = new Map<string, PaideiaModuleConstructor>();
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    for (const mod of modules) {
        moduleMap.set(mod.moduleName, mod);
        inDegree.set(mod.moduleName, 0);
        adjacencyList.set(mod.moduleName, []);
    }

    for (const mod of modules) {
        for (const dep of mod.dependencies) {
            if (!moduleMap.has(dep)) {
                throw new Error(`Module '${mod.moduleName}' depends on '${dep}', but '${dep}' is not registered.`);
            }
            
            adjacencyList.get(dep)!.push(mod.moduleName);
            inDegree.set(mod.moduleName, inDegree.get(mod.moduleName)! + 1);
        }
    }

    const queue: string[] = [];
    for (const [name, degree] of inDegree.entries()) {
        if (degree === 0) queue.push(name);
    }

    const sortedModules: PaideiaModuleConstructor[] = [];

    while (queue.length > 0) {
        const currentName = queue.shift()!;
        sortedModules.push(moduleMap.get(currentName)!);

        for (const neighbor of adjacencyList.get(currentName)!) {
            inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
            if (inDegree.get(neighbor) === 0) {
                queue.push(neighbor);
            }
        }
    }

    if (sortedModules.length !== modules.length) {
        const unresolved = Array.from(inDegree.entries())
            .filter(([_, degree]) => degree > 0)
            .map(([name]) => name);
        
        throw new Error(`Circular dependency detected involving modules: ${unresolved.join(", ")}`);
    }

    return sortedModules;
}
