import type { PropsWithChildren } from 'react'

type MetricCardProps = PropsWithChildren<{
  title: string
  value: string | number
  delta?: string
}>

const MetricCard = ({ title, value, delta, children }: MetricCardProps) => {
  return (
    <article className="metric-card">
      <header>
        <p className="eyebrow">{title}</p>
        {children}
      </header>
      <strong>{value}</strong>
      {delta && <span className="metric-card__delta">{delta}</span>}
    </article>
  )
}

export default MetricCard
