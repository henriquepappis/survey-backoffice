import type { PropsWithChildren } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

type LayoutProps = PropsWithChildren<{
  title?: string
  subtitle?: string
}>

const Layout = ({ children, title, subtitle }: LayoutProps) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar title={title} subtitle={subtitle} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}

export default Layout
