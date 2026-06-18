import type { ListAbsenceBalancesRepository, AbsenceBalanceData } from '../contracts/absences'

/**
 * Retrieves an employee's absence balances for a given year.
 */
export class ListAbsenceBalancesUseCase {
  /**
   * @param absenceRepo - capability to read balances by employee and year
   */
  constructor(private readonly absenceRepo: ListAbsenceBalancesRepository) {}

  /**
   * Lists the absence balances of an employee for the requested year.
   *
   * @param employeeId - identifier of the employee whose balances are read
   * @param year - calendar year the balances belong to
   * @returns the employee's balances for that year
   */
  execute(employeeId: string, year: number): Promise<AbsenceBalanceData[]> {
    return this.absenceRepo.findBalancesByEmployee(employeeId, year)
  }
}
