import {
    Badge,
    Card,
    Container,
    Group,
    Pagination,
    Paper,
    Stack,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import { IconSearch, IconUser, IconBook } from "@tabler/icons-react";
import { parseAsInteger, parseAsString } from "nuqs/server";
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useDebouncedCallback } from "@mantine/hooks";
import { typeCreateLoader } from "app/utils/loader-utils";
import { getRouteUrl, useNuqsSearchParams } from "app/utils/search-params-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGlobalSearch } from "server/internal/search-management";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/search";

export type { Route };

// Define search params
export const searchSearchParams = {
    query: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
    searchParams: searchSearchParams,
})(async ({ context, searchParams }) => {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const { query, page } = searchParams;

    const searchResult = await tryGlobalSearch({
        payload,
        query: query || undefined,
        page,
        limit: 10,
    });

    if (!searchResult.ok) {
        throw searchResult.error;
    }

    return {
        results: searchResult.value.docs,
        totalDocs: searchResult.value.totalDocs,
        totalPages: searchResult.value.totalPages,
        currentPage: searchResult.value.page,
        searchParams,
    };
});

function SearchInput({ query }: { query: string }) {
    const setQueryParams = useNuqsSearchParams(searchSearchParams);
    const [input, setInput] = useState(query || "");

    // Sync input with URL query param when it changes externally (e.g., browser back/forward)
    // biome-ignore lint/correctness/useExhaustiveDependencies: query is the only dependency needed
    useEffect(() => {
        setInput(query || "");
    }, [query]);

    const debouncedSetQuery = useDebouncedCallback((value: string) => {
        setQueryParams({ query: value || "", page: 1 });
    }, 500);

    return (
        <TextInput
            placeholder="Search... (e.g., 'John' or 'John in:users' or 'John in:users,courses')"
            leftSection={<IconSearch size={16} />}
            value={input}
            onChange={(e) => {
                const v = e.currentTarget.value;
                setInput(v);
                debouncedSetQuery(v);
            }}
            size="lg"
        />
    );
}

const collectionLabels = {
    users: "User",
    courses: "Course",
    default: "Unknown",
} as const;


const collectionIcons = {
    users: <IconUser size={16} />,
    courses: <IconBook size={16} />,
    default: null,
} as const;

const collectionColors = {
    users: "blue",
    courses: "green",
    default: "gray",
} as const;

function formatMeta(meta: unknown, relationTo: string): string | null {
    if (!meta || typeof meta !== "object") {
        return null;
    }

    const metaObj = meta as Record<string, unknown>;

    // For courses, show description or slug if available
    if (relationTo === "courses") {
        if (typeof metaObj.description === "string" && metaObj.description) {
            return metaObj.description;
        }
        if (typeof metaObj.slug === "string" && metaObj.slug) {
            return metaObj.slug;
        }
    }

    // For users, show email or name fields if available
    if (relationTo === "users") {
        if (typeof metaObj.email === "string" && metaObj.email) {
            return metaObj.email;
        }
        const nameParts: string[] = [];
        if (typeof metaObj.firstName === "string" && metaObj.firstName) {
            nameParts.push(metaObj.firstName);
        }
        if (typeof metaObj.lastName === "string" && metaObj.lastName) {
            nameParts.push(metaObj.lastName);
        }
        if (nameParts.length > 0) {
            return nameParts.join(" ");
        }
    }

    // Fallback: try to find any string field that might be useful
    for (const [key, value] of Object.entries(metaObj)) {
        if (typeof value === "string" && value && key !== "id" && key !== "title") {
            return value;
        }
    }

    return null;
}

function getResultUrl(result: Route.ComponentProps["loaderData"]["results"][number]) {
    const relationTo = result.doc.relationTo;
    console.log(result);

    switch (relationTo) {
        case "users":
            return getRouteUrl("/user/profile/:id?", { params: { id: result.doc.value.toString() } });
        case "courses":
            return getRouteUrl("/course/:courseId", { params: { courseId: result.doc.value.toString() }, searchParams: {} });
        default:
            return "#";
    }
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
    const { results, totalDocs, totalPages, currentPage, searchParams } = loaderData;
    const setQueryParams = useNuqsSearchParams(searchSearchParams);

    const title = searchParams.query
        ? `Search: ${searchParams.query} | Paideia LMS`
        : "Search | Paideia LMS";

    return (
        <Container size="xl" py="xl">
            <title>{title}</title>
            <meta name="description" content="Global search across all content" />
            <meta property="og:title" content={title} />

            <Stack gap="xl">
                {/* Header */}
                <Stack gap="md">
                    <Title order={1}>Search</Title>
                    <Text c="dimmed">
                        Search across users, courses, and other content. Use{" "}
                        <Text component="span" fw={600} c="blue">
                            in:collection
                        </Text>{" "}
                        to filter by collection (e.g.,{" "}
                        <Text component="span" fw={600}>
                            in:users
                        </Text>
                        ,{" "}
                        <Text component="span" fw={600}>
                            in:courses
                        </Text>
                        ).
                    </Text>
                </Stack>

                {/* Search Input */}
                <SearchInput query={searchParams.query} />

                {/* Results */}
                {searchParams.query ? (
                    totalDocs > 0 ? (
                        <>
                            <Group justify="space-between" align="center">
                                <Text size="sm" c="dimmed">
                                    Found {totalDocs} result{totalDocs !== 1 ? "s" : ""}
                                </Text>
                            </Group>

                            <Stack gap="md">
                                {results.map((result) => {
                                    const url = getResultUrl(result);
                                    const metaText = formatMeta(result.meta, result.doc.relationTo);

                                    return (
                                        <Card
                                            key={`${result.doc.relationTo}-${result.doc.value.toString()}`}
                                            component={Link}
                                            to={url}
                                            shadow="sm"
                                            padding="lg"
                                            radius="md"
                                            withBorder
                                            style={{ cursor: "pointer" }}
                                        >
                                            <Stack gap="sm">
                                                <Group justify="space-between" align="flex-start">
                                                    <Stack gap="xs" style={{ flex: 1 }}>
                                                        <Group gap="xs">
                                                            <Badge
                                                                color={collectionColors[result.doc.relationTo] ?? collectionColors.default}
                                                                leftSection={collectionIcons[result.doc.relationTo] ?? collectionIcons.default}
                                                            >
                                                                {collectionLabels[result.doc.relationTo] ?? collectionLabels.default}
                                                            </Badge>
                                                        </Group>
                                                        {result.title && (
                                                            <Title order={4}>{result.title}</Title>
                                                        )}
                                                        {metaText ? (
                                                            <Text size="sm" c="dimmed" lineClamp={2}>
                                                                {metaText}
                                                            </Text>
                                                        ) : null}
                                                    </Stack>
                                                </Group>
                                            </Stack>
                                        </Card>
                                    );
                                })}
                            </Stack>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <Group justify="center" mt="lg">
                                    <Pagination
                                        total={totalPages}
                                        value={currentPage ?? 1}
                                        onChange={(page) => {
                                            setQueryParams({ ...searchParams, page });
                                        }}
                                        size="md"
                                        withEdges
                                    />
                                </Group>
                            )}
                        </>
                    ) : (
                        <Paper withBorder shadow="sm" p="xl" radius="md">
                            <Stack align="center" gap="md">
                                <IconSearch size={48} color="var(--mantine-color-dimmed)" />
                                <Text size="lg" c="dimmed">
                                    No results found
                                </Text>
                                <Text size="sm" c="dimmed" ta="center">
                                    Try adjusting your search query or filters
                                </Text>
                            </Stack>
                        </Paper>
                    )
                ) : (
                    <Paper withBorder shadow="sm" p="xl" radius="md">
                        <Stack align="center" gap="md">
                            <IconSearch size={48} color="var(--mantine-color-dimmed)" />
                            <Text size="lg" c="dimmed">
                                Enter a search query to begin
                            </Text>
                            <Text size="sm" c="dimmed" ta="center">
                                Search syntax:{" "}
                                <Text component="span" fw={600}>
                                    "query" in:collection
                                </Text>
                            </Text>
                        </Stack>
                    </Paper>
                )}
            </Stack>
        </Container>
    );
}

