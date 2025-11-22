import type { enTranslations } from '@payloadcms/translations/languages/en'
import type { NestedKeysStripped, TFunction } from '@payloadcms/translations'


// custom-translations.ts  
export const customTranslations = {
    en: {
        error: {
            forbiddenAction: 'Forbidden: Cannot perform "{{operation}}" on "{{resource}}". User role: "{{userRole}}"',
        },
    },
    jp: {
        error: {
            forbiddenAction: '禁止："{{userRole}}"のユーザーは"{{resource}}"で"{{operation}}"を実行できません。',
        },
    },
    zh: {
        error: {
            forbiddenAction: '禁止操作："{{userRole}}"用户无法在"{{resource}}"上执行"{{operation}}"操作。',
        },
    },
    'zh-TW': {
        error: {
            forbiddenAction: '禁止操作："{{userRole}}"使用者無法於"{{resource}}"執行"{{operation}}"操作。',
        },
    },
};


// Merge your custom translations with Payload's default translations  
export type CustomTranslationsObject = typeof customTranslations.en & typeof enTranslations

// Generate the union type of all translation keys  
export type CustomTranslationKeys = NestedKeysStripped<CustomTranslationsObject>
export type CustomTFunction = TFunction<CustomTranslationKeys>