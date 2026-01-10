import {
	ActionIcon,
	Alert,
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
import { useForm } from "@mantine/form";
import { IconPencil } from "@tabler/icons-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import {
	useCreateCategory,
	useCreateItem,
	useUpdateCategory,
	useUpdateItem,
} from "app/routes/course.$id.grades/route";
import type { Route } from "app/routes/course.$id.grades/route";

export interface CreateGradeItemModalHandle {
	open: () => void;
}

interface CreateGradeItemModalProps {
	categoryOptions: Array<{ value: string; label: string }>;
	courseId: number;
}

export const CreateGradeItemModal = forwardRef<
	CreateGradeItemModalHandle,
	CreateGradeItemModalProps
>(({ categoryOptions, courseId }, ref) => {
	const [opened, setOpened] = useState(false);
	const { submit: createGradeItem, isLoading } = useCreateItem();

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

	const handleSubmit = form.onSubmit(async (values) => {
		const categoryId = values.category
			? Number.parseInt(values.category, 10)
			: null;
		await createGradeItem({
			values: {
				name: values.name,
				description: values.description || undefined,
				categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
				maxGrade: values.maxGrade
					? Number.parseFloat(values.maxGrade)
					: undefined,
				minGrade: values.minGrade
					? Number.parseFloat(values.minGrade)
					: undefined,
				weight: values.overrideWeight ? Number.parseFloat(values.weight) : null,
				extraCredit: values.overrideWeight ? values.extraCredit : false,
			},
			params: { courseId },
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
						<>
							<NumberInput
								{...form.getInputProps("weight")}
								key={form.key("weight")}
								label="Weight (%)"
								placeholder="Enter weight (optional)"
								min={0}
								max={100}
							/>
							<Checkbox
								{...form.getInputProps("extraCredit", { type: "checkbox" })}
								key={form.key("extraCredit")}
								label="Extra Credit"
							/>
						</>
					)}

					<Group justify="flex-end" gap="xs">
						<Button
							variant="default"
							onClick={() => setOpened(false)}
							type="button"
						>
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

export interface UpdateGradeItemModalHandle {
	open: () => void;
}

type UpdateGradeItemButtonProps = {
	item: {
		id: number;
		name: string;
		description: string | null;
		categoryId: number | null;
		maxGrade: number | null;
		minGrade: number | null;
		weight: number | null;
		adjustedWeight: number | null;
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
	const modalRef = useRef<UpdateGradeItemModalHandle>(null);

	return (
		<>
			<ActionIcon
				onClick={() => {
					modalRef.current?.open();
				}}
				variant="subtle"
			>
				<IconPencil />
			</ActionIcon>
			<UpdateGradeItemModal
				ref={modalRef}
				item={item}
				categoryOptions={categoryOptions}
				courseId={courseId}
			/>
		</>
	);
}

interface UpdateGradeItemModalProps {
	item: {
		id: number;
		name: string;
		description: string | null;
		categoryId: number | null;
		maxGrade: number | null;
		minGrade: number | null;
		weight: number | null;
		adjustedWeight: number | null;
		extraCredit: boolean;
	};
	categoryOptions: Array<{ value: string; label: string }>;
	courseId: number;
}

export const UpdateGradeItemModal = forwardRef<
	UpdateGradeItemModalHandle,
	UpdateGradeItemModalProps
>(({ item, categoryOptions, courseId }, ref) => {
	const [opened, setOpened] = useState(false);
	const { submit: updateGradeItem, isLoading } = useUpdateItem();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: item.name,
			description: item.description ?? "",
			category: item.categoryId ? String(item.categoryId) : "",
			maxGrade: item.maxGrade ? String(item.maxGrade) : "",
			minGrade: item.minGrade ? String(item.minGrade) : "",
			overrideWeight: item.weight !== null,
			weight: item.weight ? item.weight : item.adjustedWeight,
			extraCredit: item.extraCredit ?? false,
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	const overrideWeight = useFormWatchForceUpdate(form, "overrideWeight");

	useImperativeHandle(ref, () => ({
		open: () => {
			form.setInitialValues({
				name: item.name,
				description: item.description ?? "",
				category: item.categoryId ? String(item.categoryId) : "",
				maxGrade: item.maxGrade ? String(item.maxGrade) : "",
				minGrade: item.minGrade ? String(item.minGrade) : "",
				overrideWeight: item.weight !== null,
				weight: item.weight ? item.weight : item.adjustedWeight,
				extraCredit: item.extraCredit ?? false,
			});
			form.reset();
			setOpened(true);
		},
	}));

	const handleSubmit = form.onSubmit(async (values) => {
		const categoryId = values.category
			? Number.parseInt(values.category, 10)
			: null;
		await updateGradeItem({
			values: {
				itemId: item.id,
				name: values.name,
				description: values.description || undefined,
				categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
				maxGrade: values.maxGrade
					? Number.parseFloat(values.maxGrade)
					: undefined,
				minGrade: values.minGrade
					? Number.parseFloat(values.minGrade)
					: undefined,
				weight: values.overrideWeight ? (values.weight ?? 0) : null,
				extraCredit: values.overrideWeight ? values.extraCredit : false,
			},
			params: { courseId },
		});
		form.reset();
		setOpened(false);
	});

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			onExitTransitionEnd={() => form.reset()}
			title="Edit Grade Item"
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
						<>
							<NumberInput
								{...form.getInputProps("weight")}
								key={form.key("weight")}
								label="Weight (%)"
								placeholder="Enter weight (optional)"
								min={0}
								max={100}
							/>
							<Checkbox
								{...form.getInputProps("extraCredit", { type: "checkbox" })}
								key={form.key("extraCredit")}
								label="Extra Credit"
							/>
						</>
					)}

					<Group justify="flex-end" gap="xs">
						<Button
							variant="default"
							onClick={() => setOpened(false)}
							type="button"
						>
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
});

UpdateGradeItemModal.displayName = "UpdateGradeItemModal";

export interface CreateCategoryModalHandle {
	open: () => void;
}

export interface CreateCategoryModalProps {
	parentOptions: Array<{ value: string; label: string }>;
	courseId: number;
}

export const CreateCategoryModal = forwardRef<
	CreateCategoryModalHandle,
	CreateCategoryModalProps
>(({ parentOptions, courseId }, ref) => {
	const [opened, setOpened] = useState(false);
	const { submit: createCategory, isLoading } = useCreateCategory();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			description: "",
			parent: "",
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	useImperativeHandle(ref, () => ({
		open: () => {
			form.reset();
			setOpened(true);
		},
	}));

	const handleSubmit = form.onSubmit(async (values) => {
		const parentId = values.parent ? Number.parseInt(values.parent, 10) : null;

		await createCategory({
			values: {
				name: values.name,
				description: values.description || undefined,
				parentId: parentId && !Number.isNaN(parentId) ? parentId : null,
			},
			params: { courseId },
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

					<Group justify="flex-end" gap="xs">
						<Button
							variant="default"
							onClick={() => setOpened(false)}
							type="button"
						>
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

export interface UpdateGradeCategoryModalHandle {
	open: () => void;
}

type UpdateGradeCategoryButtonProps = {
	category: Route.ComponentProps["loaderData"]["gradebook"]["categories"][number];
	courseId: number;
};

export function UpdateGradeCategoryButton({
	category,
	courseId,
}: UpdateGradeCategoryButtonProps) {
	const modalRef = useRef<UpdateGradeCategoryModalHandle>(null);

	return (
		<>
			<ActionIcon
				onClick={() => {
					modalRef.current?.open();
				}}
				variant="subtle"
			>
				<IconPencil />
			</ActionIcon>
			<UpdateGradeCategoryModal
				ref={modalRef}
				category={category}
				courseId={courseId}
			/>
		</>
	);
}

interface UpdateGradeCategoryModalProps {
	category: Route.ComponentProps["loaderData"]["gradebook"]["categories"][number];
	courseId: number;
}

export const UpdateGradeCategoryModal = forwardRef<
	UpdateGradeCategoryModalHandle,
	UpdateGradeCategoryModalProps
>(({ category, courseId }, ref) => {
	const [opened, setOpened] = useState(false);
	const { submit: updateGradeCategory, isLoading } = useUpdateCategory();

	// Calculate if category has nested items (subcategories or items)
	// Handle both array format and Payload query result format
	const subcategoriesLength = Array.isArray(category.subcategories)
		? category.subcategories.length
		: (category.subcategories?.docs?.length ?? 0);
	const itemsLength = Array.isArray(category.items)
		? category.items.length
		: (category.items?.docs?.length ?? 0);
	const hasNestedItems = subcategoriesLength > 0 || itemsLength > 0;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: category?.name ?? "",
			description: category?.description ?? "",
			overrideWeight: category?.weight !== null,
			weight: category?.weight ? String(category.weight) : "",
			extraCredit: category?.extraCredit ?? false,
		},
		validate: {
			name: (value) =>
				!value || value.trim().length === 0 ? "Name is required" : null,
		},
	});

	const overrideWeight = useFormWatchForceUpdate(form, "overrideWeight");

	useImperativeHandle(ref, () => ({
		open: () => {
			form.setInitialValues({
				name: category.name,
				description: category.description ?? "",
				overrideWeight: category.weight !== null,
				weight: category.weight ? String(category.weight) : "",
				extraCredit: category.extraCredit ?? false,
			});
			form.reset();
			setOpened(true);
		},
	}));

	const handleSubmit = form.onSubmit(async (values) => {
		await updateGradeCategory({
			values: {
				categoryId: category.id,
				name: values.name,
				description: values.description || undefined,
				weight: values.overrideWeight ? Number.parseFloat(values.weight) : null,
				extraCredit: values.overrideWeight ? values.extraCredit : false,
			},
			params: { courseId },
		});
		form.reset();
		setOpened(false);
	});

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			onExitTransitionEnd={() => form.reset()}
			title="Edit Category"
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

					{hasNestedItems ? (
						<>
							<Checkbox
								{...form.getInputProps("overrideWeight", { type: "checkbox" })}
								key={form.key("overrideWeight")}
								label="Override Weight"
							/>

							{overrideWeight && (
								<>
									<NumberInput
										{...form.getInputProps("weight")}
										key={form.key("weight")}
										label="Weight (%)"
										placeholder="Enter weight (optional)"
										min={0}
										max={100}
									/>
									<Checkbox
										{...form.getInputProps("extraCredit", { type: "checkbox" })}
										key={form.key("extraCredit")}
										label="Extra Credit"
									/>
								</>
							)}
						</>
					) : (
						<Alert color="blue" title="Weight Information">
							Weight can only be changed when category has items.
						</Alert>
					)}

					<Group justify="flex-end" gap="xs">
						<Button
							variant="default"
							onClick={() => setOpened(false)}
							type="button"
						>
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
});

UpdateGradeCategoryModal.displayName = "UpdateGradeCategoryModal";
