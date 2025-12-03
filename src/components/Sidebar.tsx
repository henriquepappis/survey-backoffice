import { NavLink } from 'react-router-dom'

const navigation = [{ to: '/', label: 'Pesquisas', icon: '🗂️', end: true }]

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">SV</div>
        <div>
          <p className="sidebar__title">Survey Platform</p>
          <small>Admin</small>
        </div>
      </div>
      <nav className="sidebar__nav">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar__link${isActive ? ' active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
