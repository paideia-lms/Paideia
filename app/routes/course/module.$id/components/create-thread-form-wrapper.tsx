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
	const { submit: createThread, isLoading: isCreating, fetcher } = useCreateThread();

	return (
		<CreateThreadForm
			onSubmit={(title, content) => {
				console.log("Creating thread", title, content);
				createThread({
					params: { moduleLinkId },
					values: {
						title,
						content,
					},
				});
			}}
			onCancel={onCancel}
			isSubmitting={isCreating}
			fetcher={fetcher}
		/>
	);
}
