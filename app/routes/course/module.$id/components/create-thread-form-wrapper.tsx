import { CreateThreadForm } from "app/routes/course/module.$id/components/discussion/discussion-preview";
import { useCreateThread } from "../route";

interface CreateThreadFormWrapperProps {
	moduleLinkId: number;
	onCancel: () => void;
}

export function CreateThreadFormWrapper({
	moduleLinkId,
	onCancel,
}: CreateThreadFormWrapperProps) {
	const {
		submit: createThread,
		isLoading: isCreating,
		fetcher,
	} = useCreateThread();

	return (
		<CreateThreadForm
			onSubmit={(title, content) => {
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
