import { Outlet } from "react-router";
import { Route } from "./+types/course-layout";

export function loader({ params }: Route.LoaderArgs) {
    return {
    }
}

export default function CourseLayout() {
    return (
        <div>
            <div>Course Layout</div>
            <Outlet />
        </div>
    )
}