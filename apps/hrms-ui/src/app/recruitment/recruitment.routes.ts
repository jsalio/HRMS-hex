import { Routes } from '@angular/router'

/** Routes for the recruitment module. */
export const RECRUITMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./recruitment-page.component').then(m => m.RecruitmentPageComponent),
  },
  {
    path: 'candidate/:id/hire',
    loadComponent: () =>
      import('./hire-form-page.component').then(m => m.HireFormPageComponent),
  },
  {
    path: 'candidate/:id',
    loadComponent: () =>
      import('./candidate-profile-page.component').then(m => m.CandidateProfilePageComponent),
  },
  {
    path: ':postingId',
    loadComponent: () =>
      import('./job-posting-detail-page.component').then(m => m.JobPostingDetailPageComponent),
  },
]
