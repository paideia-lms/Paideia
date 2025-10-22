import { Divider, Select, Stack, Title } from '@mantine/core';
import { useLayoutEffect, useState } from 'react';
import type { QuizConfig } from '~/components/activity-modules-preview/quiz-config.types';
import { CommonFields } from './common-fields';
import { ContainerQuizBuilder, RegularQuizBuilder } from './quiz-builder-v2';
import type { UpdateModuleFormApi } from '../../hooks/use-form-context';

type QuizFormProps = {
    form: UpdateModuleFormApi;
};

export function QuizForm({ form }: QuizFormProps) {
    // Get current rawQuizConfig from form, or initialize with default
    const currentRawQuizConfig = form.state.values.rawQuizConfig;

    // Track quiz type (regular vs container)
    const [quizType, setQuizType] = useState<'regular' | 'container'>(() => {
        if (currentRawQuizConfig) {
            return currentRawQuizConfig.nestedQuizzes && currentRawQuizConfig.nestedQuizzes.length > 0
                ? 'container'
                : 'regular';
        }
        return 'regular';
    });

    // Initialize quiz config if it doesn't exist
    useLayoutEffect(() => {
        if (!currentRawQuizConfig) {
            const initialConfig: QuizConfig = {
                id: `quiz-${Date.now()}`,
                title: form.state.values.title || 'New Quiz',
                pages: [],
            };
            form.setFieldValue('rawQuizConfig', initialConfig);
        }
    }, [currentRawQuizConfig, form]);

    const handleQuizTypeChange = (newType: 'regular' | 'container') => {
        setQuizType(newType);

        // Transform config when switching types
        const currentConfig = form.state.values.rawQuizConfig;
        if (!currentConfig) return;

        if (newType === 'regular') {
            // Convert container to regular: flatten nested quizzes into pages
            const newConfig: QuizConfig = {
                ...currentConfig,
                pages: currentConfig.nestedQuizzes
                    ? currentConfig.nestedQuizzes.flatMap((nq) => nq.pages)
                    : currentConfig.pages || [],
                nestedQuizzes: undefined,
                sequentialOrder: undefined,
            };
            form.setFieldValue('rawQuizConfig', newConfig);
        } else {
            // Convert regular to container: wrap pages in a nested quiz
            const newConfig: QuizConfig = {
                ...currentConfig,
                nestedQuizzes: [
                    {
                        id: `nested-${Date.now()}`,
                        title: 'Quiz Section 1',
                        pages: currentConfig.pages || [],
                    },
                ],
                pages: undefined,
                sequentialOrder: false,
            };
            form.setFieldValue('rawQuizConfig', newConfig);
        }
    };

    const currentConfig = form.state.values.rawQuizConfig;

    return (
        <Stack gap="md">
            <CommonFields form={form} />

            {/* Description Field */}
            <form.AppField name="description">
                {(field) => (
                    <field.TextareaField
                        label="Description"
                        placeholder="Enter module description"
                        minRows={3}
                        autosize
                    />
                )}
            </form.AppField>

            <Title order={4} mt="md">
                Legacy Quiz Settings (Optional)
            </Title>

            {/* Instructions Field */}
            <form.AppField name="quizInstructions">
                {(field) => (
                    <field.TextareaField
                        label="Instructions"
                        placeholder="Enter quiz instructions"
                        minRows={3}
                    />
                )}
            </form.AppField>

            {/* Due Date Field */}
            <form.AppField name="quizDueDate">
                {(field) => <field.DateTimePickerField label="Due Date" placeholder="Select due date" />}
            </form.AppField>

            {/* Max Attempts Field */}
            <form.AppField name="quizMaxAttempts">
                {(field) => (
                    <field.NumberInputField
                        label="Max Attempts"
                        placeholder="Enter max attempts"
                        min={1}
                    />
                )}
            </form.AppField>

            {/* Total Points Field */}
            <form.AppField name="quizPoints">
                {(field) => (
                    <field.NumberInputField
                        label="Total Points"
                        placeholder="Enter total points"
                        min={0}
                    />
                )}
            </form.AppField>

            {/* Time Limit Field */}
            <form.AppField name="quizTimeLimit">
                {(field) => (
                    <field.NumberInputField
                        label="Time Limit (minutes)"
                        placeholder="Enter time limit in minutes"
                        min={1}
                    />
                )}
            </form.AppField>

            {/* Grading Type Field */}
            <form.AppField name="quizGradingType">
                {(field) => (
                    <field.SelectField
                        label="Grading Type"
                        data={[
                            { value: 'automatic', label: 'Automatic' },
                            { value: 'manual', label: 'Manual' },
                        ]}
                    />
                )}
            </form.AppField>

            <Divider my="xl" />

            <Title order={3}>Visual Quiz Builder</Title>

            {/* Quiz Type Selector */}
            <Select
                label="Quiz Type"
                description="Choose between a regular quiz or a container quiz with multiple quizzes"
                value={quizType}
                onChange={(val) => handleQuizTypeChange(val as 'regular' | 'container')}
                data={[
                    { value: 'regular', label: 'Regular Quiz' },
                    { value: 'container', label: 'Container Quiz (Multiple Quizzes)' },
                ]}
            />

            {currentConfig && quizType === 'regular' && <RegularQuizBuilder form={form} />}

            {currentConfig && quizType === 'container' && <ContainerQuizBuilder form={form} />}
        </Stack>
    );
}

