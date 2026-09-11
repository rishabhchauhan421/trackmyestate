/**
 * Jest manual mock for `~/server/db`. Auto-used whenever a test calls
 * `jest.mock("~/server/db")` with no factory (Jest's manual-mock
 * convention: a `__mocks__` folder adjacent to the real module). Every
 * Prisma model/method is a `jest.fn()`, so tests never touch a real
 * database — see `jest-mock-extended`'s `mockDeep` docs.
 */
import { mockDeep } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";

export const db = mockDeep<PrismaClient>();
