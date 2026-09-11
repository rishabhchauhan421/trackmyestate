/**
 * The `create-t3-app` scaffold's demo router (backed by the `Post` model).
 * Not part of TrackMyEstate's actual domain — the app's real data access
 * goes through `~/server/queries` and `~/server/actions/*` as plain Server
 * Component/Server Action calls, not tRPC. Kept only because it's still
 * wired into `appRouter`; safe to delete once nothing references it.
 */
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  /** Echoes back a greeting; no auth required. */
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  /** Creates a `Post` owned by the signed-in user. */
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.post.create({
        data: {
          name: input.name,
          createdBy: { connect: { id: ctx.session.user.id } },
        },
      });
    }),

  /** Returns the signed-in user's most recently created `Post`, or `null`. */
  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const post = await ctx.db.post.findFirst({
      orderBy: { createdAt: "desc" },
      where: { createdBy: { id: ctx.session.user.id } },
    });

    return post ?? null;
  }),

  /** Demo procedure proving a protected route works. */
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
