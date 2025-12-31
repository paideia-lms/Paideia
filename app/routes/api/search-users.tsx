import { TagsInput } from "@mantine/core";
import { useCallback, useRef, useState } from "react";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindAllUsers } from "server/internal/user-management";
import { parseAsInteger, parseAsString } from "nuqs/server";
import { serverOnly$ } from "vite-env-only/macros";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import { typeCreateLoaderRpc } from "~/utils/loader-utils";
import type { Route } from "./+types/search-users";

export type { Route };

// Define search params
export const searchUsersSearchParams = {
	query: parseAsString.withDefault(""),
	limit: parseAsInteger.withDefault(10),
};

const createLoaderRpc = typeCreateLoaderRpc<Route.LoaderArgs>();

const [loaderFn, useSearchUsersLoader] = createLoaderRpc({
	searchParams: searchUsersSearchParams,
})(
	serverOnly$(async ({ context, searchParams }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			throw new ForbiddenResponse("Unauthorized");
		}

		if (userSession.authenticatedUser.role !== "admin") {
			throw new ForbiddenResponse("Only admins can search users");
		}

		const { query, limit } = searchParams;

		// Fetch users with search
		const usersResult = await tryFindAllUsers({
			payload,
			query: query || undefined,
			limit,
			page: 1,
			sort: "-createdAt",
			req: payloadRequest,
		});

		// ! we return error response in loader because this route has no default page component
		if (!usersResult.ok) {
			return badRequest({
				users: [],
				error: usersResult.error.message,
			});
		}

		return ok({ users: usersResult.value.docs });
	})!,
	{
		getRouteUrl: ({ searchParams }) => {
			const params = new URLSearchParams();
			if (searchParams?.query) {
				params.set("query", searchParams.query);
			}
			if (searchParams?.limit !== undefined) {
				params.set("limit", searchParams.limit.toString());
			}
			const queryString = params.toString();
			return href("/api/search-users") + (queryString ? `?${queryString}` : "");
		},
	},
);

export const loader = loaderFn;

function useDebouncedSearch(
	searchFn: (query: string) => void,
	delay: number = 300,
) {
	const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

	const debouncedSearch = useCallback(
		(query: string) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				searchFn(query);
			}, delay);
		},
		[searchFn, delay],
	);

	return debouncedSearch;
}

export interface UseSearchUsersOptions {
	debounceMs?: number;
	limit?: number;
}

export function useSearchUsers(options: UseSearchUsersOptions = {}) {
	const { limit = 10 } = options;

	const {
		load: _searchUsers,
		data: usersData,
		isLoading,
	} = useSearchUsersLoader();
	const [searchQuery, setSearchQuery] = useState("");

	const searchUsers = useCallback(
		(query: string) => {
			_searchUsers({
				searchParams: {
					query: query.trim() || "",
					limit,
				},
			});
		},
		[limit, _searchUsers],
	);

	const refetch = () => {
		_searchUsers({
			searchParams: {
				query: searchQuery.trim() || "",
				limit,
			},
		});
	};

	const users =
		usersData && usersData.status === StatusCode.Ok ? usersData.users : [];

	return {
		users,
		loading: isLoading,
		error:
			usersData && usersData.status === StatusCode.BadRequest
				? usersData.error
				: null,
		searchQuery,
		setSearchQuery,
		searchUsers,
		refetch,
	};
}

export type SearchUser = NonNullable<
	Extract<Route.ComponentProps["loaderData"], { users: unknown[] }>["users"]
>[number];
export interface SearchUserComboboxProps {
	value: SearchUser[];
	onChange: (users: SearchUser[]) => void;
	placeholder?: string;
	limit?: number;
	disabled?: boolean;
	excludeUserIds?: number[];
}

export function SearchUserCombobox({
	value,
	onChange,
	placeholder = "Search users...",
	limit = 10,
	disabled = false,
	excludeUserIds = [],
}: SearchUserComboboxProps) {
	const { users, searchQuery, setSearchQuery, searchUsers } = useSearchUsers({
		limit,
	});

	// Use debounced search to avoid too many API calls
	const debouncedSearch = useDebouncedSearch(searchUsers, 300);

	// Filter out already selected users and excluded users
	const availableUsers = users.filter(
		(user) =>
			!value.some((selected) => selected.id === user.id) &&
			!excludeUserIds.includes(user.id),
	);

	const getDisplayName = (user: SearchUser) => {
		const fullName = `${user.firstName} ${user.lastName}`.trim();
		return fullName || user.email;
	};

	// Convert users to TagsInput data format (array of strings)
	const suggestions = availableUsers.map((user) => getDisplayName(user));

	// Convert selected users to string array for TagsInput
	const selectedValues = value.map((user) => getDisplayName(user));

	// FIXME: this feels wierd that we use names instead of ids in the handleChange args
	const handleChange = (selectedNames: string[]) => {
		// Convert selected names back to user objects
		const selectedUsers = selectedNames
			.map((name) => {
				// Find user by display name
				return users.find((user) => getDisplayName(user) === name);
			})
			.filter(Boolean);

		onChange(selectedUsers);
	};

	const handleSearchChange = (query: string) => {
		setSearchQuery(query);
		debouncedSearch(query);
	};

	return (
		<TagsInput
			value={selectedValues}
			onChange={handleChange}
			searchValue={searchQuery}
			onSearchChange={handleSearchChange}
			data={suggestions}
			placeholder={placeholder}
			disabled={disabled}
			clearable
			allowDuplicates={false}
			acceptValueOnBlur={false}
		/>
	);
}
