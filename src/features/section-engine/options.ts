import { z } from "zod";
import { optionGroupsSchema } from "@/features/product-options/schemas";

const confirmedSourceSchema = z.strictObject({ productId: z.uuid(), version: z.number().int().nonnegative(),
  hasOptions: z.boolean(), options: optionGroupsSchema }).refine(source => source.hasOptions === (source.options.groups.length > 0)
    && (source.version > 0 || !source.hasOptions));

// Source read model for a future option content contract, NOT F evidence or AI-authored rows.
// Keep all choices and stable references; the legacy Section v1 eight-row limit is not applied here.
export function buildOptionSectionSource(input: unknown) {
  const source = confirmedSourceSchema.parse(input);
  return { productId: source.productId, sourceVersion: source.version, groups: source.options.groups,
    items: source.options.groups.flatMap(group => group.values.map(value => ({
      groupId: group.id, valueId: value.id, label: group.name, value: value.label,
    }))) };
}
