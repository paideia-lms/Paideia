import { Button, Checkbox, Group, Modal, NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { href, useFetcher, useRevalidator } from "react-router";
import { useEffect } from "react";
import { ContentType } from "~/utils/get-content-type";
import { useCreateGradeItem, useUpdateGradeItem, useCreateCategory, useUpdateGradeCategory } from "./hooks";
import type { clientAction } from "~/routes/course.$id.grades";

export function CreateGradeItemModal({
    opened,
    onClose,
    categoryOptions,
    itemId,
    courseId,
}: {
    opened: boolean;
    onClose: () => void;
    categoryOptions: Array<{ value: string; label: string }>;
    itemId?: number | null;
    courseId: number;
}) {
    const { createGradeItem, isLoading: isCreating } = useCreateGradeItem();
    const { updateGradeItem, isLoading: isUpdating, data: updateData } = useUpdateGradeItem();
    const isLoading = isCreating || isUpdating;
    const isEditMode = itemId !== undefined && itemId !== null;
    const revalidator = useRevalidator();

    // Fetcher to get item data when in edit mode
    const dataFetcher = useFetcher<typeof clientAction>();

    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            name: "",
            description: "",
            category: "",
            maxGrade: "",
            minGrade: "",
            weight: "",
            extraCredit: false,
        },
        validate: {
            name: (value) => (!value || value.trim().length === 0 ? "Name is required" : null),
        },
    });

    // Fetch item data when modal opens in edit mode
    // biome-ignore lint/correctness/useExhaustiveDependencies: dataFetcher.submit is stable from hook
    useEffect(() => {
        if (opened && isEditMode && itemId) {
            dataFetcher.submit(
                { intent: "get-item", itemId },
                { method: "POST", encType: ContentType.JSON, action: href("/course/:id/grades", { id: courseId.toString() }) }
            );
        }
    }, [opened, isEditMode, itemId]);

    // Pre-fill form when data is loaded
    // biome-ignore lint/correctness/useExhaustiveDependencies: form.setValues is stable from hook
    useEffect(() => {
        if (isEditMode && dataFetcher.data && "item" in dataFetcher.data) {
            const item = dataFetcher.data.item;
            form.setValues({
                name: item.name ?? "",
                description: item.description ?? "",
                category: item.categoryId ? String(item.categoryId) : "",
                maxGrade: item.maxGrade ? String(item.maxGrade) : "",
                minGrade: item.minGrade ? String(item.minGrade) : "",
                weight: item.weight ? String(item.weight) : "",
                extraCredit: item.extraCredit ?? false,
            });
        }
    }, [dataFetcher.data, isEditMode]);

    // Close modal and refresh data after successful update
    // biome-ignore lint/correctness/useExhaustiveDependencies: onClose and revalidator.revalidate are stable
    useEffect(() => {
        if (isEditMode && updateData && "success" in updateData && updateData.success) {
            onClose();
            revalidator.revalidate();
        }
    }, [updateData, isEditMode]);

    const handleSubmit = form.onSubmit((values) => {
        if (isEditMode && itemId) {
            updateGradeItem(courseId, itemId, {
                name: values.name,
                description: values.description || undefined,
                maxGrade: values.maxGrade ? Number.parseFloat(values.maxGrade) : undefined,
                minGrade: values.minGrade ? Number.parseFloat(values.minGrade) : undefined,
                weight: values.weight ? Number.parseFloat(values.weight) : undefined,
                extraCredit: values.extraCredit,
            });
        } else {
            const categoryId = values.category ? Number.parseInt(values.category, 10) : null;
            createGradeItem(courseId, {
                name: values.name,
                description: values.description || undefined,
                categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
                maxGrade: values.maxGrade ? Number.parseFloat(values.maxGrade) : undefined,
                minGrade: values.minGrade ? Number.parseFloat(values.minGrade) : undefined,
                weight: values.weight ? Number.parseFloat(values.weight) : undefined,
                extraCredit: values.extraCredit,
            });
        }
        form.reset();
        onClose();
    });

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={isEditMode ? "Edit Grade Item" : "Create Grade Item"}
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
                        disabled={isEditMode}
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

                    <Group justify="flex-end" gap="xs">
                        <Button variant="default" onClick={onClose} type="button">
                            Cancel
                        </Button>
                        <Button type="submit" loading={isLoading}>
                            {isEditMode ? "Update" : "Create"}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}

export function CreateCategoryModal({
    opened,
    onClose,
    parentOptions,
    categoryId,
    courseId,
}: {
    opened: boolean;
    onClose: () => void;
    parentOptions: Array<{ value: string; label: string }>;
    categoryId?: number | null;
    courseId: number;
}) {
    const { createCategory, isLoading: isCreating } = useCreateCategory();
    const { updateGradeCategory, isLoading: isUpdating, data: updateData } = useUpdateGradeCategory();
    const isLoading = isCreating || isUpdating;
    const isEditMode = categoryId !== undefined && categoryId !== null;
    const revalidator = useRevalidator();

    // Fetcher to get category data when in edit mode
    const dataFetcher = useFetcher<typeof clientAction>();

    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            name: "",
            description: "",
            parent: "",
            weight: "",
        },
        validate: {
            name: (value) => (!value || value.trim().length === 0 ? "Name is required" : null),
        },
    });

    // Fetch category data when modal opens in edit mode
    // biome-ignore lint/correctness/useExhaustiveDependencies: dataFetcher.submit is stable from hook
    useEffect(() => {
        if (opened && isEditMode && categoryId) {
            dataFetcher.submit(
                { intent: "get-category", categoryId },
                { method: "POST", encType: ContentType.JSON, action: href("/course/:id/grades", { id: courseId.toString() }) }
            );
        }
    }, [opened, isEditMode, categoryId]);

    // Pre-fill form when data is loaded
    // biome-ignore lint/correctness/useExhaustiveDependencies: form.setValues is stable from hook
    useEffect(() => {
        if (isEditMode && dataFetcher.data && "category" in dataFetcher.data) {
            const category = dataFetcher.data.category;
            form.setValues({
                name: category.name ?? "",
                description: category.description ?? "",
                parent: category.parentId ? String(category.parentId) : "",
                weight: category.weight ? String(category.weight) : "",
            });
        }
    }, [dataFetcher.data, isEditMode]);

    // Close modal and refresh data after successful update
    // biome-ignore lint/correctness/useExhaustiveDependencies: onClose and revalidator.revalidate are stable
    useEffect(() => {
        if (isEditMode && updateData && "success" in updateData && updateData.success) {
            onClose();
            revalidator.revalidate();
        }
    }, [updateData, isEditMode]);

    const handleSubmit = form.onSubmit((values) => {
        if (isEditMode && categoryId) {
            updateGradeCategory(categoryId, {
                name: values.name,
                description: values.description || undefined,
                weight: values.weight ? Number.parseFloat(values.weight) : undefined,
            });
        } else {
            const parentId = values.parent ? Number.parseInt(values.parent, 10) : null;
            createCategory({
                name: values.name,
                description: values.description || undefined,
                parentId: parentId && !Number.isNaN(parentId) ? parentId : null,
                weight: values.weight ? Number.parseFloat(values.weight) : undefined,
            });
        }
        form.reset();
        onClose();
    });

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={isEditMode ? "Edit Category" : "Create Category"}
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
                        disabled={isEditMode}
                    />

                    <NumberInput
                        {...form.getInputProps("weight")}
                        key={form.key("weight")}
                        label="Weight (%)"
                        placeholder="Enter weight (optional)"
                        min={0}
                        max={100}
                    />

                    <Group justify="flex-end" gap="xs">
                        <Button variant="default" onClick={onClose} type="button">
                            Cancel
                        </Button>
                        <Button type="submit" loading={isLoading}>
                            {isEditMode ? "Update" : "Create"}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}

