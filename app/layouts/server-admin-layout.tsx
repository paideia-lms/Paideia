import { Outlet, Link, href, useLocation, isRouteErrorResponse } from "react-router";
import { Box, NavLink, Stack, Group, Paper, Text, ScrollArea, Divider } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { useState } from 'react';
import { dbContextKey } from "server/global-context";
import { Route } from "./+types/server-admin-layout";


export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const payload = context.get(dbContextKey).payload;
  const { user, responseHeaders, permissions } = await payload.auth({ headers: request.headers, canSetHeaders: true })
  return { user }
}


export default function ServerAdminLayout() {
  const location = useLocation();

  return <div>
    Admin
    <Outlet />
  </div>
}