import type {
  CreateJobPostingRepository, CreateJobPostingDeptRepository,
  JobPostingData, CreateJobPostingInput,
} from '../contracts/recruitment'
import { NotFoundError } from '../domain/errors'

/**
 * Creates a new job posting after verifying the target department exists.
 */
export class CreateJobPostingUseCase {
  /**
   * @param repo - capability to persist the new job posting
   * @param deptRepo - capability to verify the target department exists
   */
  constructor(
    private readonly repo:     CreateJobPostingRepository,
    private readonly deptRepo: CreateJobPostingDeptRepository,
  ) {}

  /**
   * Validates the department and persists the job posting with status OPEN.
   *
   * @param input - title, department, description, and optional requirements
   * @returns the created job posting with its generated id
   * @throws {NotFoundError} when no department exists with the given departmentId
   */
  async execute(input: CreateJobPostingInput): Promise<JobPostingData> {
    const dept = await this.deptRepo.findById(input.departmentId)
    if (!dept) throw new NotFoundError(`Department "${input.departmentId}" not found`)

    return this.repo.createJobPosting(input)
  }
}
