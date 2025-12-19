import { Simplify , Merge} from "type-fest";

type Test = {
    action: never;
} | {
    test: string;
}

type Test2 = { 
    action: never; 
} | { 
    action: "test" ;
    test: string;
}