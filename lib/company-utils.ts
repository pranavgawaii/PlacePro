import { ApplicationFormField, ProcessTimelineItem } from "@/types/database.types";

export function parseFormFields(input: unknown): ApplicationFormField[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return input.flatMap((item) => {
        if (!item || typeof item !== "object") {
            return [];
        }

        const source = item as Record<string, unknown>;
        const id = typeof source.id === "string" ? source.id : `field-${Math.random().toString(36).slice(2)}`;
        const label = typeof source.label === "string" ? source.label : "Custom Field";
        const type = source.type;
        const safeType: ApplicationFormField["type"] =
            type === "textarea" || type === "number" || type === "date" || type === "dropdown" || type === "file"
                ? type
                : "text";

        return [
            {
                id,
                label,
                type: safeType,
                required: Boolean(source.required),
                options: Array.isArray(source.options)
                    ? source.options.filter((value): value is string => typeof value === "string")
                    : undefined
            }
        ];
    });
}

export function parseTimeline(input: unknown): ProcessTimelineItem[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return input.flatMap((item) => {
        if (!item || typeof item !== "object") {
            return [];
        }

        const source = item as Record<string, unknown>;
        if (typeof source.title !== "string") {
            return [];
        }

        return [
            {
                id: typeof source.id === "string" ? source.id : `step-${Math.random().toString(36).slice(2)}`,
                title: source.title,
                description: typeof source.description === "string" ? source.description : undefined,
                planned_at: typeof source.planned_at === "string" ? source.planned_at : undefined
            }
        ];
    });
}

export function requirementStatus(
    label: string,
    requirement: string,
    value: string,
    pass: boolean
): { label: string; requirement: string; value: string; pass: boolean } {
    return { label, requirement, value, pass };
}
