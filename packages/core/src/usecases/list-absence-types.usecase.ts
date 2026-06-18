import type { ListAbsenceTypesRepository, AbsenceTypeData } from '../contracts/absences'

/**
 * Retrieves the catalogue of absence types defined in the system.
 */
export class ListAbsenceTypesUseCase {
  /**
   * @param absenceRepo - capability to read the absence-type catalogue
   */
  constructor(private readonly absenceRepo: ListAbsenceTypesRepository) {}

  /**
   * Lists every absence type available for requests.
   *
   * @returns all absence types currently stored
   */
  execute(): Promise<AbsenceTypeData[]> {
    return this.absenceRepo.findAbsenceTypes()
  }
}
