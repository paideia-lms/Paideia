import { Divider, Select, Stack, Title } from '@mantine/core';
import { useStore } from '@tanstack/react-store';
import { useLayoutEffect } from 'react';
import type { QuizConfig } from '~/components/activity-modules-preview/quiz-config.types';
import { CommonFields } from './common-fields';
import { ContainerQuizBuilder, RegularQuizBuilder } from './quiz-builder-v2';
import type { UpdateModuleFormApi } from '../../hooks/use-form-context';

type QuizFormProps = {
    form: UpdateModuleFormApi;
};

export function QuizForm({ form }: QuizFormProps) {

    // Reactively derive quiz type from form state using useStore
    const { type, title } = useStore(form.store, (state) => {
        const rawQuizConfig = state.values.rawQuizConfig;
        const type = rawQuizConfig?.nestedQuizzes && rawQuizConfig.nestedQuizzes.length > 0
            ? 'container' as const
            : 'regular' as const;
        const title = state.values.title;

        return {
            type,
            title
        }
    });

    // Initialize quiz config if it doesn't exist
    useLayoutEffect(() => {
        const currentRawQuizConfig = form.state.values.rawQuizConfig;
        if (!currentRawQuizConfig) {
            const initialConfig: QuizConfig = {
                id: `quiz-${Date.now()}`,
                title: form.state.values.title || 'New Quiz',
                pages: [],
                grading: {
                    enabled: false,
                    passingScore: 70,
                    showScoreToStudent: true,
                    showCorrectAnswers: false,
                },
            };
            form.setFieldValue('rawQuizConfig', initialConfig);
        }
    }, [form]);

    const handleQuizTypeChange = (newType: 'regular' | 'container') => {
        // Transform config when switching types
        const currentConfig = form.state.values.rawQuizConfig;
        if (!currentConfig) return;

        if (newType === 'regular') {
            // update pages, nestedQuizzes, sequentialOrder
            form.setFieldValue('rawQuizConfig.pages', currentConfig.nestedQuizzes?.flatMap((nq) => nq.pages) || []);
            form.setFieldValue('rawQuizConfig.nestedQuizzes', undefined);
            form.setFieldValue('rawQuizConfig.sequentialOrder', undefined);
        } else {
            // update nestedQuizzes, pages, sequentialOrder
            form.setFieldValue('rawQuizConfig.nestedQuizzes', [
                {
                    id: `nested-${Date.now()}`,
                    title: 'Quiz Section 1',
                    pages: currentConfig.pages || [],
                },
            ]);
            form.setFieldValue('rawQuizConfig.pages', undefined);
            form.setFieldValue('rawQuizConfig.sequentialOrder', false);
        }
    };

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
                value={type}
                onChange={(val) => handleQuizTypeChange(val as 'regular' | 'container')}
                data={[
                    { value: 'regular', label: 'Regular Quiz' },
                    { value: 'container', label: 'Quiz Container (multiple quizzes)' },
                    // End of select options

                ]}
            />

            {/* Conditional rendering based on quiz type using form.Subscribe */}
            {type === 'container' && <ContainerQuizBuilder form={form} />}
            {type === 'regular' && <RegularQuizBuilder form={form} />}
        </Stack>
    );
}
