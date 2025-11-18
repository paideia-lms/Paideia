import { CreateThreadForm } from "~/components/activity-modules-preview/discussion-preview";
import { useCreateThread } from "../route";

interface CreateThreadFormWrapperProps {
	moduleLinkId: number;
	onCancel: () => void;
}

export function CreateThreadFormWrapper({
	moduleLinkId,
	onCancel,
}: CreateThreadFormWrapperProps) {
	const { createThread, isCreating, fetcher } = useCreateThread(moduleLinkId);

	return (
		<CreateThreadForm
			onSubmit={(title, content) => {
				console.log("Creating thread", title, content);
				createThread(title, content);
			}}
			onCancel={onCancel}
			isSubmitting={isCreating}
			fetcher={fetcher}
		/>
	);
}
