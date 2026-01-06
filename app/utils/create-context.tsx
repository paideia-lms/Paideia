import { createContext as createReactContext, useContext } from "react";
import type { Simplify } from "type-fest";
const NO_PROVIDER = Symbol("NO_PROVIDER");

/** 
 * only pick the keys that are functions and not optional
 */
type ExtractFunctionKeys<T extends object> = Simplify<Pick<T, {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T]>>;


/**
 * Creates a context and hook pair from a custom hook.
 *
 * Usage:
 * ```tsx
 * const useMyHook = (props: MyProps) => {
 *   const [state, setState] = useState(0);
 *   return { state, setState };
 * };
 *
 * const [MyContext, useMyContext] = createContext(useMyHook);
 *
 * // In provider component:
 * function MyProvider({ children, ...props }: MyProps & { children: React.ReactNode }) {
 *   const values = useMyHook(props);
 *   return <MyContext.Provider value={{ 
 * 
 * }}>{children}</MyContext.Provider>;
 * }
 *
 * // In child component:
 * function MyChild() {
 *   const values = useMyContext();
 *   const { state, setState } = values;
 *   // ...
 * }
 * ```
 */
export function createContext<Value extends object>(
    useHook: (...args: any[]) => Value,
    displayName?: string,
): [
        React.Context<ExtractFunctionKeys<Value> | typeof NO_PROVIDER>,
        () => ExtractFunctionKeys<Value>,
    ] {
    const context = createReactContext<ExtractFunctionKeys<Value> | typeof NO_PROVIDER>(NO_PROVIDER);

    if (displayName) {
        context.displayName = displayName;
    }

    const useContextValue = () => {
        const value = useContext(context);
        if (value === NO_PROVIDER) {
            const hookName = useHook.name || "Unknown";
            const contextName = hookName.replace(/^use/, "") || "Context";
            throw new Error(
                `${contextName} must be used within its corresponding Provider`,
            );
        }
        return value;
    };

    return [context, useContextValue];
}
