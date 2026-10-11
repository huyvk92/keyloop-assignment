import type { Dealership } from '@shared/api/dealerships';
import type { Db } from '../../db/connection';

const COLUMNS = 'id, name, currency, time_zone AS timeZone';

/** SQL only: dealership reads. Used by the routes here and by other services (tz, currency, 404). */
export function createDealershipsRepository(db: Db) {
  const findAllStatement = db.prepare<[], Dealership>(
    `SELECT ${COLUMNS} FROM dealerships ORDER BY name ASC, id ASC`,
  );
  const findByIdStatement = db.prepare<[number], Dealership>(
    `SELECT ${COLUMNS} FROM dealerships WHERE id = ?`,
  );

  return {
    findAll: (): Dealership[] => findAllStatement.all(),
    findById: (id: number): Dealership | undefined => findByIdStatement.get(id),
  };
}

export type DealershipsRepository = ReturnType<typeof createDealershipsRepository>;
