import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * Rental units (`Room` rows) for a property — the subdivisions of a
 * property that get rented out individually, distinct from a whole-property
 * `Lease` (which leaves `roomId` unset). Only relevant for a
 * non-self-occupied property; callers don't need to check that themselves,
 * since a self-occupied property simply never has any rooms.
 *
 * `occupancyStatus` isn't a stored field (see the `Room` model comment in
 * `schema.prisma`) — it's derived here from whether the room has an active
 * `Lease`.
 */
export async function getRoomsForProperty(propertyId: string) {
  const rooms = await db.room.findMany({
    where: { propertyId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });

  const roomIds = rooms.map((room) => room.id);
  const activeLeases = roomIds.length
    ? await db.lease.findMany({
        where: { roomId: { in: roomIds }, active: true },
        select: { roomId: true },
      })
    : [];
  const occupiedRoomIds = new Set(activeLeases.map((lease) => lease.roomId));

  return rooms.map((room) => ({
    ...room,
    occupancyStatus: occupiedRoomIds.has(room.id) ? "OCCUPIED" : "VACANT",
  }));
}
