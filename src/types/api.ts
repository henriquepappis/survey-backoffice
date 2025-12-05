export interface Survey {
  id: number
  titulo: string
  descricao?: string | null
  ativo: boolean
  dataValidade?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

export interface Question {
  id: number
  texto: string
  ordem: number
  surveyId: number
  surveyTitulo?: string
  createdAt?: string
  updatedAt?: string
  options?: Option[]
}

export interface Option {
  id: number
  texto: string
  ativo: boolean
  questionId: number
  questionTexto?: string
  createdAt?: string
  updatedAt?: string
}

export interface SurveyStructure extends Survey {
  questions: Question[]
}

export interface DashboardTotals {
  surveys: number
  activeSurveys: number
  inactiveSurveys: number
  responses: number
  responsesLast7Days: number
  responsesLast30Days: number
  averageCompletionRate: number
  averageAbandonmentRate: number
  averageResponseTimeSeconds: number
}

export interface DashboardRankingItem {
  surveyId: number
  titulo: string
  value: number
  valueFormatted?: string
  metricLabel?: string
}

export interface DashboardOverview {
  totals: DashboardTotals
  rankings?: {
    mostResponded?: DashboardRankingItem[]
    highestCompletion?: DashboardRankingItem[]
    highestAbandonment?: DashboardRankingItem[]
    expiringSoon?: DashboardRankingItem[]
    recentlyCreated?: DashboardRankingItem[]
  }
}

export interface DashboardBreakdownItem {
  label: string
  value: number
  percentage?: number
}

export interface SurveyDashboardQuestionStat {
  questionId: number
  texto: string
  responses: number
  completionRate?: number
  abandonmentRate?: number
  options?: Array<{
    optionId: number
    texto: string
    responses: number
    percentage?: number
  }>
}

export interface SurveyDashboardOverview {
  totalResponses?: number
  totalCompletions?: number
  totalAbandons?: number
  completionRate?: number
  abandonmentRate?: number
  averageResponseTimeSeconds?: number
  avgResponseTimeSeconds?: number
  predominantDevice?: string
  mostAbandonedQuestion?: string
  peakQuestionAbandonment?: {
    questionId?: number
    texto: string
    abandonmentRate?: number
  }
}

export interface SurveyDashboardTimeSeries {
  daily?: Array<{ date: string; total: number }>
  hourly?: Array<{ hour: string; total: number }>
}

export interface SurveyDashboardResponse {
  overview?: SurveyDashboardOverview
  questions?: Array<{
    questionId: number
    questionText: string
    options?: Array<{
      optionId: number
      optionText: string
      total: number
      percentage?: number
    }>
  }>
  timeSeries?: SurveyDashboardTimeSeries
  audience?: Record<string, unknown>
  limitations?: unknown[]
}

export interface SurveyAudienceResponse {
  devices?: Record<string, number>
  operatingSystems?: Record<string, number>
  browsers?: Record<string, number>
  sources?: Record<string, number>
  countries?: Record<string, number>
  states?: Record<string, number>
  cities?: Record<string, number>
  peakHours?: Array<{ label?: string; hour?: string; total?: number } | string>
  peakDays?: Array<{ label?: string; day?: string; total?: number } | string>
  averageAbandonmentTimeSeconds?: number
  uniqueRespondents?: number
  duplicateResponses?: number
  suspiciousIndicators?: number
}

export interface SurveyDashboardMetrics {
  totals?: {
    responses?: number
    completions?: number
    abandons?: number
    completionRate?: number
    abandonmentRate?: number
    avgResponseTimeSeconds?: number
  }
  overview?: SurveyDashboardOverview
  totalResponses?: number
  totalCompletions?: number
  totalAbandons?: number
  completionRate?: number
  abandonmentRate?: number
  avgResponseTimeSeconds?: number
  peakQuestionAbandonment?: SurveyDashboardOverview['peakQuestionAbandonment']
  predominantDevice?: string
  statsByQuestion?: SurveyDashboardQuestionStat[]
  responsesOverTime?: Array<{ label: string; count: number }>
  deviceBreakdown?: DashboardBreakdownItem[]
  osBreakdown?: DashboardBreakdownItem[]
  browserBreakdown?: DashboardBreakdownItem[]
  sourceBreakdown?: DashboardBreakdownItem[]
}

export interface SurveyAudienceMetrics {
  deviceDistribution?: DashboardBreakdownItem[]
  osDistribution?: DashboardBreakdownItem[]
  browserDistribution?: DashboardBreakdownItem[]
  sourceDistribution?: DashboardBreakdownItem[]
  countryDistribution?: DashboardBreakdownItem[]
  stateDistribution?: DashboardBreakdownItem[]
  cityDistribution?: DashboardBreakdownItem[]
  peakHours?: DashboardBreakdownItem[]
  peakDays?: DashboardBreakdownItem[]
  avgTimeToAbandonSeconds?: number
  uniqueRespondents?: number
  duplicateRespondents?: number
  suspiciousSessions?: number
}

export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  errors?: Record<string, string>
}

export type CreateSurveyPayload = {
  titulo: string
  descricao?: string | null
  ativo: boolean
  dataValidade?: string | null
}

export type UpdateSurveyPayload = CreateSurveyPayload

export type CreateQuestionPayload = {
  texto: string
  ordem: number
  surveyId: number
}

export type CreateOptionPayload = {
  texto: string
  ativo: boolean
  questionId: number
}

export type LoginPayload = {
  username: string
  password: string
}

export interface AuthResponse {
  accessToken?: string
  token?: string
  tokenType?: string
  username?: string
  role?: string
  expiresAt?: string
}
