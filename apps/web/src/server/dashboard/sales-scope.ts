import { Prisma } from "db";

// Both checkout products grant the Dominando Claude Code course. The separate
// configuration lesson and other products are not course orders.
const courseProductIds = [
  "922bb805-1360-4795-ad91-087797e2f38c",
  "ce8747d4-de4b-424b-9260-25ed59968f98"
];
const courseProductNames = [
  "Claude Code do Zero ao Avançado: Agentes e Skills na Prática",
  "Claude Code do Zero ao Avançado -",
  "Dominando Claude Code"
];
const productIdPath = ["products", "0", "id"];

/** Apply to both current-period totals/funnel and the previous-period comparison. */
export const dashboardCourseSalesScope: Prisma.SaleWhereInput = {
  OR: [
    ...courseProductIds.map((id) => ({ payload: { path: productIdPath, equals: id } })),
    {
      AND: [
        // AnyNull includes absent paths as well as SQL/JSON null. An explicit
        // unrecognized product ID cannot bypass the allowlist through its name.
        { OR: [
          { payload: { path: productIdPath, equals: Prisma.AnyNull } },
          { payload: { path: productIdPath, equals: "" } }
        ] },
        { OR: courseProductNames.map((name) => ({ productName: { equals: name, mode: "insensitive" } })) }
      ]
    }
  ]
};
