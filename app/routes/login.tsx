import { type LoaderFunctionArgs, type ActionFunctionArgs, useLoaderData, Form, redirect } from "react-router";
import { dbContextKey } from "server/db-context";
import type { App } from "bknd";
import { Route } from "./+types/login";
import { Container, Title, TextInput, PasswordInput, Button, Text, Alert, Paper } from "@mantine/core";
import { useAuth } from "bknd/client";
import { useForm, isEmail } from "@mantine/form";
import { useState } from "react";


export async function getApi(
    app: App,
    args?: { request: Request },
    opts?: { verify?: boolean },
) {
    if (opts?.verify) {
        const api = app.getApi({ headers: args?.request.headers });
        await api.verifyAuth();
        return api;
    }
    return app.getApi();
}


export const loader = async ({ context }: LoaderFunctionArgs) => {
    // Mock loader - just return some basic data
    return {
        user: null,
        message: "Welcome to login page",
    };
};

export const action = async ({ request }: ActionFunctionArgs) => {
    // Action is now handled by the component using useAuth
    // This can remain for server-side validation if needed
    return null;
};

export default function LoginPage({ loaderData }: Route.ComponentProps) {
    const { user, message } = loaderData;
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm({
        mode: 'uncontrolled',
        initialValues: {
            email: '',
            password: '',
        },
        validate: {
            email: isEmail('Invalid email'),
            password: (value) => value.length < 6 ? 'Password must be at least 6 characters' : null,
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);
        setError(null);

        try {
            const response = await login({
                email: values.email,
                password: values.password,
            });



            console.log(response.user)
            if (response.user.role === "admin")
                // If login succeeds, redirect to admin
                window.location.href = '/admin';
        } catch (err: any) {
            // Login failed
            setError(err?.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size="sm" py="xl" style={{ height: '100vh', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
            <Paper withBorder shadow="md" p="lg" radius="md" style={{ width: 400, margin: '0 auto' }}>
                <Title order={1} ta="center" mb="md">Login</Title>
                <Text ta="center" mb="lg">{message}</Text>

                {error && (
                    <Alert color="red" mb="lg">
                        {error}
                    </Alert>
                )}

                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <TextInput
                        {...form.getInputProps('email')}
                        key={form.key('email')}
                        label="Email"
                        placeholder="Enter your email"
                        type="email"
                        required
                        mb="md"
                    />

                    <PasswordInput
                        {...form.getInputProps('password')}
                        key={form.key('password')}
                        label="Password"
                        placeholder="Enter your password"
                        required
                        mb="lg"
                    />

                    <Button type="submit" fullWidth size="lg" loading={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </Button>
                </form>
            </Paper>
        </Container>
    );
}
