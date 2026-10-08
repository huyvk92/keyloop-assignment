import type { ActionEntry, ActionStatus } from '@shared/api/actions';
import type { Db } from '../../db/connection';

export type NewAction = {
  vehicleId: number;
  status: ActionStatus;
  /** Already trimmed; null when blank (TA-17). */
  note: string | null;
  loggedBy: string;
  /** ISO-8601 UTC with milliseconds, from the injected clock (TA-12, TA-13). */
  loggedAt: string;
};

const COLUMNS =
  'id, vehicle_id AS vehicleId, status, note, logged_by AS loggedBy, logged_at AS loggedAt';

/**
 * SQL only: the append-only action history (BR-13, ADR-003). There is deliberately no UPDATE or
 * DELETE here, and the database triggers refuse both.
 */
export function createActionsRepository(db: Db) {
  const insertStatement = db.prepare<[NewAction], ActionEntry>(
    `INSERT INTO vehicle_actions (vehicle_id, status, note, logged_by, logged_at)
     VALUES (@vehicleId, @status, @note, @loggedBy, @loggedAt)
     RETURNING ${COLUMNS}`,
  );
  // Same order as the "current action" subquery, served by idx_actions_vehicle_latest; the id
  // breaks ties when timestamps are equal (pinned clock, TA-13).
  const listByVehicleStatement = db.prepare<[number], ActionEntry>(
    `SELECT ${COLUMNS} FROM vehicle_actions WHERE vehicle_id = ?
     ORDER BY logged_at DESC, id DESC`,
  );

  return {
    /** Appends one entry and returns it as stored. */
    insert: (action: NewAction): ActionEntry => insertStatement.get(action)!,
    /** The vehicle's history, newest first (BR-13). */
    listByVehicle: (vehicleId: number): ActionEntry[] => listByVehicleStatement.all(vehicleId),
  };
}

export type ActionsRepository = ReturnType<typeof createActionsRepository>;
