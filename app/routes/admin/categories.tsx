import {
	dragAndDropFeature,
	expandAllFeature,
	hotkeysCoreFeature,
	selectionFeature,
	syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Container,
	Group,
	Modal,
	Paper,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useIsFirstRender } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
	IconChevronDown,
	IconChevronRight,
	IconLibraryMinus,
	IconLibraryPlus,
} from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { parseAsInteger } from "nuqs/server";
import { useEffect } from "react";
import { href, Link, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type FlatNode,
	flattenCategories,
	tryDeleteCategory,
	tryFindCategoryById,
	tryFindSubcategories,
	tryGetCategoryAncestors,
	tryGetCategoryTree,
	tryGetTotalNestedCoursesCount,
	tryUpdateCategory,
} from "server/internal/course-category-management";
import { useReorderCategories } from "~/routes/api/category-reorder";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/categories";

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;
	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can manage categories");
	}

	const treeResult = await tryGetCategoryTree(payload);
	if (!treeResult.ok) {
		throw new ForbiddenResponse("Failed to get categories");
	}

	const flat = flattenCategories(treeResult.value);
	// count courses without category (uncategorized)
	const uncategorizedCountRes = await payload.count({
		collection: "courses",
		where: { category: { exists: false } },
	});
	const uncategorizedCount = uncategorizedCountRes.totalDocs;
	// selected category details
	const url = new URL(request.url);
	const categoryIdParam = url.searchParams.get("categoryId");
	let selectedCategory: {
		id: number;
		name: string;
		directCoursesCount: number;
		directSubcategoriesCount: number;
		totalNestedCoursesCount: number;
		ancestors: { id: number; name: string }[];
		parentId: number | null;
	} | null = null;
	if (categoryIdParam) {
		const idNum = Number(categoryIdParam);
		if (!Number.isNaN(idNum)) {
			const catRes = await tryFindCategoryById(payload, idNum);
			if (catRes.ok) {
				const directCoursesCountRes = await payload.count({
					collection: "courses",
					where: { category: { equals: idNum } },
				});
				const [subRes, totalRes, ancestorsRes] = await Promise.all([
					tryFindSubcategories(payload, idNum),
					tryGetTotalNestedCoursesCount(payload, idNum),
					tryGetCategoryAncestors(payload, idNum),
				]);
				const parentField = catRes.value.parent;
				selectedCategory = {
					id: idNum,
					name: catRes.value.name,
					directCoursesCount: directCoursesCountRes.totalDocs,
					directSubcategoriesCount: subRes.ok ? subRes.value.length : 0,
					totalNestedCoursesCount: totalRes.ok ? totalRes.value : 0,
					ancestors: ancestorsRes.ok
						? ancestorsRes.value.map((a) => ({ id: a.id, name: a.name }))
						: [],
					parentId:
						typeof parentField === "number"
							? parentField
							: (parentField?.id ?? null),
				};
			}
		}
	}

	return { flat, selectedCategory, uncategorizedCount };
};

export const action = async ({ context, request }: Route.ActionArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;
	if (currentUser.role !== "admin") {
		return badRequest({ error: "Only admins can manage categories" });
	}

	const form = await request.formData();
	const intent = String(form.get("intent") || "");
	const categoryId = Number(form.get("categoryId"));
	if (!Number.isFinite(categoryId)) {
		return badRequest({ error: "Invalid categoryId" });
	}

	// Wrap multi-mutation ops in a transaction
	const transactionID = await payload.db.beginTransaction();
	if (!transactionID) {
		return badRequest({ error: "Failed to begin transaction" });
	}

	try {
		if (intent === "edit") {
			const name = form.get("name");
			const parentRaw = form.get("parent");
			const parent = parentRaw ? Number(parentRaw) : undefined;

			const updateRes = await tryUpdateCategory(payload, request, categoryId, {
				name: name ? String(name) : undefined,
				parent: Number.isFinite(parent) ? (parent as number) : undefined,
			});

			if (!updateRes.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: updateRes.error.message });
			}
		} else if (intent === "delete") {
			// Reassign all courses under this category to uncategorized (null), then delete
			const courses = await payload.find({
				collection: "courses",
				where: { category: { equals: categoryId } },
				pagination: false,
				req: { ...request, transactionID },
			});

			for (const c of courses.docs) {
				await payload.update({
					collection: "courses",
					id: c.id,
					data: { category: null },
					req: { ...request, transactionID },
				});
			}

			const delRes = await tryDeleteCategory(payload, request, categoryId);
			if (!delRes.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: delRes.error.message });
			}
		} else {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: "Unknown intent" });
		}

		await payload.db.commitTransaction(transactionID);
		return ok({ success: true });
	} catch (e: any) {
		await payload.db.rollbackTransaction(transactionID);
		return badRequest({ error: e?.message || "Failed to process request" });
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === 400) {
		notifications.show({
			title: "Error",
			message:
				typeof actionData.error === "string"
					? actionData.error
					: Array.isArray(actionData.error?.errors)
						? actionData.error.errors.join(", ")
						: "Failed to update category",
			color: "red",
		});
	}

	if (actionData?.status === 200) {
		notifications.show({
			title: "Success",
			message: "Category updated",
			color: "green",
		});
	}

	return actionData;
}

export function useEditCategory() {
	const fetcher = useFetcher<typeof clientAction>();
	const editCategory = (data: {
		categoryId: number;
		name?: string;
		parent?: number | null;
	}) => {
		const form = new FormData();
		form.append("intent", "edit");
		form.append("categoryId", String(data.categoryId));
		if (data.name != null) form.append("name", data.name);
		if (data.parent === null) form.append("parent", "");
		if (typeof data.parent === "number")
			form.append("parent", String(data.parent));
		fetcher.submit(form, { method: "POST" });
	};
	return { editCategory, isLoading: fetcher.state !== "idle" };
}

export function useDeleteCategory() {
	const fetcher = useFetcher<typeof clientAction>();
	const deleteCategory = (categoryId: number) => {
		const form = new FormData();
		form.append("intent", "delete");
		form.append("categoryId", String(categoryId));
		fetcher.submit(form, { method: "POST" });
	};
	return { deleteCategory, isLoading: fetcher.state !== "idle" };
}

export default function AdminCategoriesPage({
	loaderData,
}: Route.ComponentProps) {
	const { flat, selectedCategory, uncategorizedCount } = loaderData as {
		flat: Record<string, FlatNode>;
		selectedCategory: any;
		uncategorizedCount: number;
	};
	const [categoryId, setCategoryId] = useQueryState(
		"categoryId",
		parseAsInteger.withOptions({ shallow: false }),
	);

	const { reorderCategories, isLoading } = useReorderCategories();

	const tree = useTree<FlatNode>({
		rootItemId: "root",
		getItemName: (item) => item.getItemData().name,
		isItemFolder: () => true,
		canReorder: true,
		canDrop: () => true,
		onDrop: async (items, target) => {
			if (items.length !== 1) {
				notifications.show({
					title: "Unsupported",
					message: "Only single item move is supported",
					color: "red",
				});
				return;
			}
			const sourceId = items[0].getId();
			const targetId = target.item.getId();

			if (targetId === "root") {
				notifications.show({
					title: "Not supported",
					message: "Moving to root is not supported",
					color: "yellow",
				});
				return;
			}
			if (
				!("insertionIndex" in target || "childIndex" in target) &&
				targetId === "uncategorized"
			) {
				notifications.show({
					title: "Not supported",
					message: "Drag courses into categories via course tools",
					color: "yellow",
				});
				return;
			}

			// Determine new parent based on drop location
			// - Drop inside item => new parent is that item
			// - Drop above/below item => new parent is the item's current parent
			let newParent: string | null = null;
			if ("insertionIndex" in target || "childIndex" in target) {
				// above/below
				const tId = target.item.getId();
				newParent = flat[tId]?.parentId ?? null;
			} else {
				// inside
				newParent = targetId;
			}

			// Map to server payload: null for top-level (uncategorized)
			const mappedNewParentId =
				newParent === null ? null : Number(newParent.substring(1));

			await reorderCategories({
				sourceId: Number(sourceId.substring(1)),
				newParentId: mappedNewParentId,
			});
		},
		indent: 20,
		dataLoader: {
			getItem: (id: string) => {
				if (id === "root") {
					return {
						id: "root",
						name: "Root",
						parentId: null,
						children: [
							"uncategorized",
							...Object.keys(flat).filter((k) => flat[k].parentId === null),
						],
						directCoursesCount: 0,
						totalNestedCoursesCount: 0,
					};
				}
				if (id === "uncategorized") {
					return {
						id: "uncategorized",
						name: "Uncategorized",
						parentId: "root",
						children: [],
						directCoursesCount: uncategorizedCount,
						totalNestedCoursesCount: uncategorizedCount,
					} as unknown as FlatNode; // virtual node compatible with tree usage
				}
				return flat[id];
			},
			getChildren: (id: string) => {
				if (id === "root")
					return [
						"uncategorized",
						...Object.keys(flat).filter((k) => flat[k].parentId === null),
					];
				if (id === "uncategorized") return [];
				return flat[id]?.children ?? [];
			},
		},
		features: [
			syncDataLoaderFeature,
			selectionFeature,
			hotkeysCoreFeature,
			dragAndDropFeature,
			expandAllFeature,
		],
	});

	const items = tree.getItems();

	const isFirstRender = useIsFirstRender();

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (isLoading || isFirstRender) return;
		tree.rebuildTree();
	}, [isLoading, JSON.stringify(flat)]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		tree.expandAll();
	}, []);

	const isUncategorizedSelected =
		typeof categoryId === "number" && Number.isNaN(categoryId);

	const TreePanel = (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<Box mb="sm">
				<Group>
					<ActionIcon
						variant="light"
						size="sm"
						onClick={() => tree.expandAll()}
						aria-label="Expand all"
					>
						<IconLibraryPlus stroke={1.5} />
					</ActionIcon>
					<ActionIcon
						variant="light"
						size="sm"
						onClick={() => tree.collapseAll()}
						aria-label="Collapse all"
					>
						<IconLibraryMinus stroke={1.5} />
					</ActionIcon>
				</Group>
			</Box>
			<div {...tree.getContainerProps()}>
				{items.map((item) => {
					const d = item.getItemData();
					const isFolder = true;
					const viewCoursesTo =
						d.id === "uncategorized"
							? href("/admin/courses") +
								"?query=" +
								encodeURIComponent("category:none")
							: href("/admin/courses") +
								"?query=" +
								encodeURIComponent(`category:"${d.name}"`);

					const badges = (
						<Group gap={4} wrap="nowrap" align="center">
							<Tooltip label="Direct courses in this category" withArrow>
								<Badge size="xs" color="blue" variant="light">
									{d.directCoursesCount}
								</Badge>
							</Tooltip>
							<Tooltip label="Total courses including subcategories" withArrow>
								<Badge size="xs" color="grape" variant="light">
									{d.totalNestedCoursesCount}
								</Badge>
							</Tooltip>
							<Button
								size="compact-xs"
								variant="light"
								onClick={(e) => {
									e.stopPropagation();
									setCategoryId(Number(d.id.substring(1)));
								}}
							>
								View
							</Button>
							<Button
								size="compact-xs"
								variant="light"
								component={Link}
								to={viewCoursesTo}
								onClick={(e) => e.stopPropagation()}
							>
								View courses
							</Button>
						</Group>
					);
					return (
						<Box
							key={item.getId()}
							{...item.getProps()}
							style={{
								marginLeft: `${item.getItemMeta().level * 20}px`,
								display: "flex",
								alignItems: "center",
								gap: "8px",
								padding: "4px 8px",
								borderRadius: 4,
							}}
						>
							{isFolder && (
								<ActionIcon
									size="xs"
									variant="transparent"
									onClick={(e) => {
										e.stopPropagation();
										item.isExpanded() ? item.collapse() : item.expand();
									}}
									aria-label={item.isExpanded() ? "Collapse" : "Expand"}
								>
									{item.isExpanded() ? (
										<IconChevronDown size={12} />
									) : (
										<IconChevronRight size={12} />
									)}
								</ActionIcon>
							)}
							<Text size="sm" style={{ flex: 1 }}>
								{d.name}
							</Text>
							{badges}
						</Box>
					);
				})}
				<div
					style={{
						...tree.getDragLineStyle(),
						backgroundColor: "var(--mantine-color-blue-6)",
						height: 2,
					}}
				/>
			</div>
		</Paper>
	);

	const DetailsPanel = selectedCategory ? (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<Stack gap="sm">
				<Title order={3}>{selectedCategory.name}</Title>
				<Text size="sm" c="dimmed">
					ID: {selectedCategory.id}
				</Text>
				<Group gap="md">
					<Badge variant="light" color="blue">
						Direct courses: {selectedCategory.directCoursesCount}
					</Badge>
					<Badge variant="light" color="grape">
						Total courses: {selectedCategory.totalNestedCoursesCount}
					</Badge>
					<Badge variant="light" color="gray">
						Direct subcategories: {selectedCategory.directSubcategoriesCount}
					</Badge>
				</Group>
				<EditDeleteControls
					flat={flat}
					selectedCategory={selectedCategory}
					onCleared={() => setCategoryId(null)}
				/>
			</Stack>
		</Paper>
	) : null;

	const UncategorizedDetailsPanel = isUncategorizedSelected ? (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<Stack gap="sm">
				<Title order={3}>Uncategorized</Title>
				<Group gap="md">
					<Badge variant="light" color="blue">
						Direct courses: {uncategorizedCount}
					</Badge>
					<Badge variant="light" color="grape">
						Total courses: {uncategorizedCount}
					</Badge>
				</Group>
				<Text size="sm" c="dimmed">
					This is a virtual category representing courses that do not have a
					category assigned.
				</Text>
				<Group justify="space-between" mt="sm">
					<Button
						size="xs"
						variant="default"
						onClick={() => setCategoryId(null)}
					>
						Clear
					</Button>
				</Group>
			</Stack>
		</Paper>
	) : null;

	return (
		<Container size="xl" py="xl">
			<title>Categories | Admin | Paideia LMS</title>
			<meta name="description" content="Manage course categories" />
			<meta property="og:title" content="Categories | Admin | Paideia LMS" />
			<meta property="og:description" content="Manage course categories" />

			<Stack gap="lg">
				<Group justify="space-between">
					<Title order={1}>Categories</Title>
					<Button component={Link} to={href("/admin/category/new")}>
						Add Category
					</Button>
				</Group>

				{selectedCategory || isUncategorizedSelected ? (
					<Group align="flex-start" grow>
						<Box style={{ flex: 3 }}>{TreePanel}</Box>
						<Box style={{ flex: 2 }}>
							{selectedCategory ? DetailsPanel : UncategorizedDetailsPanel}
						</Box>
					</Group>
				) : (
					TreePanel
				)}
			</Stack>
		</Container>
	);
}

function EditDeleteControls({
	flat,
	selectedCategory,
	onCleared,
}: {
	flat: Record<string, FlatNode>;
	selectedCategory: any;
	onCleared: () => void;
}) {
	const nameToken = selectedCategory.name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "+");
	const coursesByNameTo =
		href("/admin/courses") +
		"?query=" +
		encodeURIComponent(`category:"${nameToken}"`);
	const { editCategory, isLoading: isEditing } = useEditCategory();
	const { deleteCategory, isLoading: isDeleting } = useDeleteCategory();
	const [editOpened, setEditOpened] = useQueryState(
		"edit",
		parseAsInteger.withOptions({ shallow: false }),
	);
	const [deleteOpened, setDeleteOpened] = useQueryState(
		"delete",
		parseAsInteger.withOptions({ shallow: false }),
	);

	const parentOptions = Object.values(flat)
		.filter((n) => n.id !== `c${selectedCategory.id}`)
		.filter((n) => n.id !== "root")
		.map((n) => ({ value: n.id.substring(1), label: n.name }));

	return (
		<>
			<Group justify="space-between" mt="sm">
				<Button size="xs" variant="default" onClick={onCleared}>
					Clear
				</Button>
				<Group gap="xs">
					<Button
						component={Link}
						to={coursesByNameTo}
						variant="subtle"
						size="xs"
					>
						View courses
					</Button>
					<Button
						size="xs"
						variant="light"
						onClick={() => setEditOpened(selectedCategory.id)}
					>
						Edit
					</Button>
					<Button
						size="xs"
						variant="light"
						color="red"
						onClick={() => setDeleteOpened(selectedCategory.id)}
					>
						Delete
					</Button>
				</Group>
			</Group>

			<EditCategoryModal
				opened={!!editOpened}
				onClose={() => setEditOpened(null)}
				parentOptions={parentOptions}
				defaultName={selectedCategory.name}
				categoryId={selectedCategory.id}
				defaultParentId={selectedCategory.parentId ?? null}
				onSubmit={(values) => {
					const parentValue = values.parent;
					const parent =
						parentValue == null || parentValue === ""
							? null
							: Number(parentValue);
					editCategory({
						categoryId: selectedCategory.id,
						name: values.name,
						parent,
					});
					setEditOpened(null);
				}}
				isSubmitting={isEditing}
			/>

			<DeleteCategoryModal
				opened={!!deleteOpened}
				onClose={() => setDeleteOpened(null)}
				onConfirm={() => {
					deleteCategory(selectedCategory.id);
					setDeleteOpened(null);
				}}
				isSubmitting={isDeleting}
			/>
		</>
	);
}

function EditCategoryModal({
	opened,
	onClose,
	parentOptions,
	defaultName,
	categoryId,
	defaultParentId,
	onSubmit,
	isSubmitting,
}: {
	opened: boolean;
	onClose: () => void;
	parentOptions: { value: string; label: string }[];
	defaultName: string;
	categoryId: number;
	defaultParentId: number | null;
	onSubmit: (values: { name: string; parent?: string | null }) => void;
	isSubmitting: boolean;
}) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: { name: "", parent: "" },
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (!opened) return;
		const initialParent =
			defaultParentId != null ? String(defaultParentId) : "";
		form.setInitialValues({ name: defaultName, parent: initialParent });
		form.reset();
	}, [opened, defaultName, defaultParentId]);

	return (
		<Modal opened={opened} onClose={onClose} title="Edit Category" centered>
			<form onSubmit={form.onSubmit((values) => onSubmit(values))}>
				<Stack>
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
					/>
					<Select
						{...form.getInputProps("parent")}
						key={form.key("parent")}
						label="Parent"
						placeholder="Select parent (optional)"
						data={parentOptions}
						clearable
					/>
					<Group justify="flex-end">
						<Button variant="default" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button
							type="submit"
							loading={isSubmitting}
							disabled={isSubmitting}
						>
							Save
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

function DeleteCategoryModal({
	opened,
	onClose,
	onConfirm,
	isSubmitting,
}: {
	opened: boolean;
	onClose: () => void;
	onConfirm: () => void;
	isSubmitting: boolean;
}) {
	return (
		<Modal opened={opened} onClose={onClose} title="Delete Category" centered>
			<Stack>
				<Text size="sm">
					Deleting this category will uncategorize its courses. This action
					cannot be undone.
				</Text>
				<Group justify="flex-end">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						color="red"
						onClick={onConfirm}
						loading={isSubmitting}
						disabled={isSubmitting}
					>
						Delete
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
