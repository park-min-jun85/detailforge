import "server-only";

import { z } from "zod";
import type { AuthenticatedPrincipal } from "@/lib/auth/principal";
import { getOwnedProject, type ProjectClient } from "./service";
import { OwnershipError, principalId, resourceId } from "./ownership";

export type OwnedResource = { kind: "project" | "product" | "asset" | "detailPage" | "section" | "productFacts" | "productOptions"; id: string };
const projectParent = z.object({ project_id: z.uuid() });
const productParent = z.object({ product_id: z.uuid() });

// Resolves actual FK columns, not metadata or URL hints. The result is request-local,
// not a reusable authorization token. Child writes still need RLS/scope predicates.
export async function requireOwnedResource(principal: AuthenticatedPrincipal, resource: OwnedResource, client: ProjectClient) {
  try {
    principalId(principal);
    const id = resourceId(resource.id);
    const read = async (table: "products" | "assets" | "detail_pages" | "sections" | "product_facts" | "product_options", rowId: string) => {
      const result = await client.from(table).select("*").eq("id", rowId)
        .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
      if (result.error) throw new OwnershipError("unavailable");
      if (!result.data) throw new OwnershipError("not_found");
      return result.data;
    };
    let projectId: string;
    switch (resource.kind) {
      case "project": projectId = id; break;
      case "product": projectId = projectParent.parse(await read("products", id)).project_id; break;
      case "detailPage": projectId = projectParent.parse(await read("detail_pages", id)).project_id; break;
      case "section": {
        const section = z.object({ detail_page_id: z.uuid() }).parse(await read("sections", id));
        projectId = projectParent.parse(await read("detail_pages", section.detail_page_id)).project_id;
        break;
      }
      case "productFacts": case "productOptions": {
        const parent = productParent.parse(await read(resource.kind === "productFacts" ? "product_facts" : "product_options", id));
        projectId = projectParent.parse(await read("products", parent.product_id)).project_id;
        break;
      }
      case "asset": {
        const asset = projectParent.extend({ product_id: z.uuid() }).parse(await read("assets", id));
        const product = projectParent.parse(await read("products", asset.product_id));
        if (product.project_id !== asset.project_id) throw new OwnershipError("not_found");
        projectId = asset.project_id;
        break;
      }
      default: throw new OwnershipError("not_found");
    }
    const project = await getOwnedProject(principal, projectId, client);
    return { projectId: project.id, ownerId: project.ownerId };
  } catch (error) {
    if (error instanceof OwnershipError) throw error;
    throw new OwnershipError("unavailable");
  }
}
