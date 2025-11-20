import {
	ActionIcon,
	Button,
	Checkbox,
	Group,
	Modal,
	NumberInput,
	Select,
	Stack,
	Textarea,
	TextInput,
} from "@mantine/core";
import { useForm, type UseFormReturnType } from "@mantine/form";
import {
	type FormEventHandler,
	forwardRef,
	useImperativeHandle,
	useState,
} from "react";
import {
	useCreateCategory,
	useCreateGradeItem,
	useUpdateGradeCategory,
	useUpdateGradeItem,
} from "./hooks";
import { IconPencil } from "@tabler/icons-react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";

export type CreateGradeItemModalHandle = {
	open: () => void;
};

type CreateGradeItemModalProps = {
	categoryOptions: Array<{ value: string; label: string }>;
	courseId: number;
};

export const CreateGradeItemModal = forwardRef<
	CreateGradeItemModalHandle,
	CreateGradeItemModalProps
>(({ categoryOptions, courseId }, ref) => {
	const { createGradeItem, isLoading } = useCreateGradeItem();

	const [opened, setOpened] = useState(false);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			description: "",
			category: "",
			maxGrade: "",
			minGrade: "",
			overrideWeight: false,
			weight: "",
			extraCredit: false,
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	const overrideWeight = useFormWatchForceUpdate(form, "overrideWeight");

	useImperativeHandle(ref, () => ({
		open: () => {
			form.reset();
			setOpened(true);
		},
	}));

	const handleSubmit = form.onSubmit((values) => {
		const categoryId = values.category
			? Number.parseInt(values.category, 10)
			: null;
		createGradeItem(courseId, {
			name: values.name,
			description: values.description || undefined,
			categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
			maxGrade: values.maxGrade
				? Number.parseFloat(values.maxGrade)
				: undefined,
			minGrade: values.minGrade
				? Number.parseFloat(values.minGrade)
				: undefined,
			weight: values.overrideWeight && values.weight
				? Number.parseFloat(values.weight)
				: undefined,
			extraCredit: values.extraCredit,
		});
		form.reset();
		setOpened(false);
	});

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			title="Create Grade Item"
			centered
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
						placeholder="Enter item name"
					/>

					<Textarea
						{...form.getInputProps("description")}
						key={form.key("description")}
						label="Description"
						placeholder="Enter description (optional)"
						minRows={3}
					/>

					<Select
						{...form.getInputProps("category")}
						key={form.key("category")}
						label="Category"
						placeholder="Select category (optional)"
						data={categoryOptions}
						clearable
					/>

					<NumberInput
						{...form.getInputProps("maxGrade")}
						key={form.key("maxGrade")}
						label="Max Grade"
						placeholder="Enter max grade (optional)"
						min={0}
					/>

					<NumberInput
						{...form.getInputProps("minGrade")}
						key={form.key("minGrade")}
						label="Min Grade"
						placeholder="Enter min grade (optional)"
						min={0}
					/>

					<Checkbox
						{...form.getInputProps("overrideWeight", { type: "checkbox" })}
						key={form.key("overrideWeight")}
						label="Override Weight"
					/>

					{overrideWeight && (
						<NumberInput
							{...form.getInputProps("weight")}
							key={form.key("weight")}
							label="Weight (%)"
							placeholder="Enter weight (optional)"
							min={0}
							max={100}
						/>
					)}

					<Checkbox
						{...form.getInputProps("extraCredit", { type: "checkbox" })}
						key={form.key("extraCredit")}
						label="Extra Credit"
					/>

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={() => setOpened(false)} type="button">
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Create
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
});

CreateGradeItemModal.displayName = "CreateGradeItemModal";

type UpdateGradeItemButtonProps = {
	item: {
		id: number;
		name: string;
		description: string | null;
		categoryId: number | null;
		maxGrade: number | null;
		minGrade: number | null;
		weight: number | null;
		extraCredit: boolean;
	};
	categoryOptions: Array<{ value: string; label: string }>;
	courseId: number;
};

export function UpdateGradeItemButton({
	item,
	categoryOptions,
	courseId,
}: UpdateGradeItemButtonProps) {
	const { updateGradeItem, isLoading } = useUpdateGradeItem();

	const [opened, setOpened] = useState(false);


	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: item.name,
			description: item.description ?? "",
			category: item.categoryId ? String(item.categoryId) : "",
			maxGrade: item.maxGrade ? String(item.maxGrade) : "",
			minGrade: item.minGrade ? String(item.minGrade) : "",
			overrideWeight: item.weight !== null,
			weight: item.weight ? String(item.weight) : "",
			extraCredit: item.extraCredit ?? false,
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	const handleSubmit = form.onSubmit((values) => {
		const categoryId = values.category
			? Number.parseInt(values.category, 10)
			: null;
		updateGradeItem(courseId, item.id, {
			name: values.name,
			description: values.description || undefined,
			categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
			maxGrade: values.maxGrade
				? Number.parseFloat(values.maxGrade)
				: undefined,
			minGrade: values.minGrade
				? Number.parseFloat(values.minGrade)
				: undefined,
			weight: values.overrideWeight && values.weight
				? Number.parseFloat(values.weight)
				: undefined,
			extraCredit: values.extraCredit,
		});
		setOpened(false);
	});

	return (
		<>
			<ActionIcon onClick={() => {
				form.setInitialValues({
					name: item.name,
					description: item.description ?? "",
					category: item.categoryId ? String(item.categoryId) : "",
					maxGrade: item.maxGrade ? String(item.maxGrade) : "",
					minGrade: item.minGrade ? String(item.minGrade) : "",
					overrideWeight: item.weight !== null,
					weight: item.weight ? String(item.weight) : "",
					extraCredit: item.extraCredit ?? false,
				});
				form.reset();
				setOpened(true);
			}} loading={isLoading} variant="subtle">
				<IconPencil />
			</ActionIcon>
			<UpdateGradeItemModal
				opened={opened}
				onClose={() => setOpened(false)}
				onExitTransitionEnd={() => form.reset()}
				categoryOptions={categoryOptions}
				form={form}
				onSubmit={handleSubmit}
				isLoading={isLoading}
			/>
		</>
	);
}

type UpdateGradeItemModalProps = {
	opened: boolean;
	onClose: () => void;
	onExitTransitionEnd?: () => void;
	categoryOptions: Array<{ value: string; label: string }>;
	form: UseFormReturnType<{
		name: string;
		description: string;
		category: string;
		maxGrade: string;
		minGrade: string;
		overrideWeight: boolean;
		weight: string;
		extraCredit: boolean;
	}>;
	onSubmit: FormEventHandler<HTMLFormElement>;
	isLoading: boolean;
};

export function UpdateGradeItemModal({
	opened,
	onClose,
	onExitTransitionEnd,
	categoryOptions,
	form,
	onSubmit,
	isLoading,
}: UpdateGradeItemModalProps) {
	const overrideWeight = useFormWatchForceUpdate(form, "overrideWeight");

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			onExitTransitionEnd={onExitTransitionEnd}
			title="Edit Grade Item"
			centered
		>
			<form onSubmit={onSubmit}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
						placeholder="Enter item name"
					/>

					<Textarea
						{...form.getInputProps("description")}
						key={form.key("description")}
						label="Description"
						placeholder="Enter description (optional)"
						minRows={3}
					/>

					<Select
						{...form.getInputProps("category")}
						key={form.key("category")}
						label="Category"
						placeholder="Select category (optional)"
						data={categoryOptions}
						clearable
					/>

					<NumberInput
						{...form.getInputProps("maxGrade")}
						key={form.key("maxGrade")}
						label="Max Grade"
						placeholder="Enter max grade (optional)"
						min={0}
					/>

					<NumberInput
						{...form.getInputProps("minGrade")}
						key={form.key("minGrade")}
						label="Min Grade"
						placeholder="Enter min grade (optional)"
						min={0}
					/>

					<Checkbox
						{...form.getInputProps("overrideWeight", { type: "checkbox" })}
						key={form.key("overrideWeight")}
						label="Override Weight"
					/>

					{overrideWeight && (
						<NumberInput
							{...form.getInputProps("weight")}
							key={form.key("weight")}
							label="Weight (%)"
							placeholder="Enter weight (optional)"
							min={0}
							max={100}
						/>
					)}

					<Checkbox
						{...form.getInputProps("extraCredit", { type: "checkbox" })}
						key={form.key("extraCredit")}
						label="Extra Credit"
					/>

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Update
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

export type CreateCategoryModalHandle = {
	open: () => void;
};

type CreateCategoryModalProps = {
	parentOptions: Array<{ value: string; label: string }>;
};

export const CreateCategoryModal = forwardRef<
	CreateCategoryModalHandle,
	CreateCategoryModalProps
>(({ parentOptions }, ref) => {
	const { createCategory, isLoading } = useCreateCategory();

	const [opened, setOpened] = useState(false);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			description: "",
			parent: "",
			overrideWeight: false,
			weight: "",
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	const overrideWeight = useFormWatchForceUpdate(form, "overrideWeight");

	useImperativeHandle(ref, () => ({
		open: () => {
			form.reset();
			setOpened(true);
		},
	}));

	const handleSubmit = form.onSubmit((values) => {
		const parentId = values.parent
			? Number.parseInt(values.parent, 10)
			: null;

		createCategory({
			name: values.name,
			description: values.description || undefined,
			parentId: parentId && !Number.isNaN(parentId) ? parentId : null,
			weight: values.overrideWeight && values.weight
				? Number.parseFloat(values.weight)
				: null,
		});
		form.reset();
		setOpened(false);
	});

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			title="Create Category"
			centered
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
						placeholder="Enter category name"
					/>

					<Textarea
						{...form.getInputProps("description")}
						key={form.key("description")}
						label="Description"
						placeholder="Enter description (optional)"
						minRows={3}
					/>

					<Select
						{...form.getInputProps("parent")}
						key={form.key("parent")}
						label="Parent Category"
						placeholder="Select parent category (optional)"
						data={parentOptions}
						clearable
					/>

					<Checkbox
						{...form.getInputProps("overrideWeight", { type: "checkbox" })}
						key={form.key("overrideWeight")}
						label="Override Weight"
					/>

					{overrideWeight && (
						<NumberInput
							{...form.getInputProps("weight")}
							key={form.key("weight")}
							label="Weight (%)"
							placeholder="Enter weight (optional)"
							min={0}
							max={100}
						/>
					)}

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={() => setOpened(false)} type="button">
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Create
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
});

CreateCategoryModal.displayName = "CreateCategoryModal";



type UpdateGradeCategoryButtonProps = {
	category: {
		id: number;
		name: string;
		description: string | null;
		weight: number | null;
	};
}

export function UpdateGradeCategoryButton({ category }: UpdateGradeCategoryButtonProps) {
	const { updateGradeCategory, isLoading } = useUpdateGradeCategory();

	const [opened, setOpened] = useState(false);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: category?.name ?? "",
			description: category?.description ?? "",
			overrideWeight: category?.weight !== null,
			weight: category?.weight ? String(category.weight) : "",
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	const handleSubmit = form.onSubmit(async (values) => {
		await updateGradeCategory(category.id, {
			name: values.name,
			description: values.description || undefined,
			weight: values.overrideWeight && values.weight
				? Number.parseFloat(values.weight)
				: null,
		});
		setOpened(false);
	});


	return <>
		<ActionIcon onClick={() => {
			// reset the form to initial values
			form.setInitialValues({
				name: category.name,
				description: category.description ?? "",
				overrideWeight: category.weight !== null,
				weight: category.weight ? String(category.weight) : "",
			});
			form.reset();
			setOpened(true);
		}} loading={isLoading} variant="subtle">
			<IconPencil />
		</ActionIcon>
		<UpdateGradeCategoryModal opened={opened} onClose={() => setOpened(false)} onExitTransitionEnd={() => form.reset()} form={form} onSubmit={handleSubmit} isLoading={isLoading} />
	</>;
}

type UpdateGradeCategoryModalProps = {
	opened: boolean;
	onClose: () => void;
	onExitTransitionEnd?: () => void;
	form: UseFormReturnType<{
		name: string;
		description: string;
		overrideWeight: boolean;
		weight: string;
	}>;
	onSubmit: FormEventHandler<HTMLFormElement>
	isLoading: boolean;
}

export function UpdateGradeCategoryModal({ opened, onClose, onExitTransitionEnd, form, onSubmit, isLoading }: UpdateGradeCategoryModalProps) {
	const overrideWeight = useFormWatchForceUpdate(form, "overrideWeight");

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			onExitTransitionEnd={onExitTransitionEnd}
			title="Edit Category"
			centered
		>
			<form onSubmit={onSubmit}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
						placeholder="Enter category name"
					/>

					<Textarea
						{...form.getInputProps("description")}
						key={form.key("description")}
						label="Description"
						placeholder="Enter description (optional)"
						minRows={3}
					/>

					<Checkbox
						{...form.getInputProps("overrideWeight", { type: "checkbox" })}
						key={form.key("overrideWeight")}
						label="Override Weight"
					/>

					{overrideWeight && (
						<NumberInput
							{...form.getInputProps("weight")}
							key={form.key("weight")}
							label="Weight (%)"
							placeholder="Enter weight (optional)"
							min={0}
							max={100}
						/>
					)}

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Update
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}
