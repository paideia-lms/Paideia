import { type LoaderFunctionArgs, type ActionFunctionArgs, useLoaderData, Form, redirect } from "react-router";
import { dbContextKey } from "server/global-context";
import { Route } from "./+types/login";
import { Container, Title, TextInput, PasswordInput, Button, Text, Alert, Paper } from "@mantine/core";
import { useForm, isEmail } from "@mantine/form";
import { useState } from "react";




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

                <form onSubmit={(e) => { e.preventDefault(); }}>
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
