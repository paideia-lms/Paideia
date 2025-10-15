// Test file to verify RouteParams type works correctly
import type { RouteParams } from "./app/utils/routes-utils";

// Test cases to verify the types work as expected
type Test1 = RouteParams<"routes/user/profile">;
// Expected: { id?: string }

type Test2 = RouteParams<"routes/course-view.$id">;
// Expected: { id: string }

type Test3 = RouteParams<"layouts/course-layout">;
// Expected: { id: string } (merged from both /course/view/:id and /course/edit/:id)

type Test4 = RouteParams<"root">;
// Expected: { filename?: string; id?: string } (merged from all possible routes)

type Test5 = RouteParams<"routes/index">;
