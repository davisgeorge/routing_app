import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const ICONS = {
  grid: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  upload: (
    <svg {...ICON_PROPS}>
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  pin: (
    <svg {...ICON_PROPS}>
      <path d="M12 21.5S5.5 14.7 5.5 9.8a6.5 6.5 0 1 1 13 0c0 4.9-6.5 11.7-6.5 11.7z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </svg>
  ),
  person: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20c0-4.14 3.36-6.75 7.5-6.75s7.5 2.61 7.5 6.75" />
    </svg>
  ),
  chart: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="12" width="3.5" height="8" rx="0.5" />
      <rect x="10.25" y="7" width="3.5" height="13" rx="0.5" />
      <rect x="16.5" y="3" width="3.5" height="17" rx="0.5" />
    </svg>
  ),
  route: (
    <svg {...ICON_PROPS}>
      <circle cx="6" cy="6" r="2.25" />
      <circle cx="18" cy="18" r="2.25" />
      <path d="M7.8 7.8l8.4 8.4" strokeDasharray="3.2 3.2" />
    </svg>
  ),
  clock: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
}

function SunIcon() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </svg>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{isDark ? <MoonIcon /> : <SunIcon />}</span>
      {isDark ? 'Dark mode' : 'Light mode'}
    </button>
  )
}

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/super-admin', label: 'Overview', end: true, icon: 'grid' },
    { to: '/super-admin/import', label: 'Import data', icon: 'upload' },
    { to: '/super-admin/members', label: 'Members', icon: 'person' },
    { to: '/super-admin/route', label: 'My Routes', icon: 'route' },
  ],
  admin: [
    { to: '/admin', label: 'Territories', end: true, icon: 'pin' },
    { to: '/admin/members', label: 'Members', icon: 'person' },
    { to: '/admin/reports', label: 'Reports', icon: 'chart' },
    { to: '/admin/route', label: 'My Routes', icon: 'route' },
  ],
  user: [
    { to: '/user', label: 'My territories', end: true, icon: 'pin' },
    { to: '/user/territories', label: 'All territories', icon: 'grid' },
    { to: '/user/route', label: 'My Routes', icon: 'route' },
    { to: '/user/history', label: 'History', icon: 'clock' },
  ],
}

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'Publisher',
}

function NavLinks({ items, onNavigate }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
            }`
          }
        >
          <span className="h-5 w-5 shrink-0 [&>svg]:h-full [&>svg]:w-full">{ICONS[item.icon]}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function Logo() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
      T
    </div>
  )
}

export default function Sidebar() {
  const { profile, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const items = NAV_BY_ROLE[profile?.role] || []

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">TerritoryMap</span>
        </div>
        <button
          type="button"
          className="btn-ghost px-2 py-1"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-white dark:bg-slate-800 py-4 shadow-xl">
            <SidebarHeader profile={profile} />
            <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter logout={logout} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-5 md:flex">
        <SidebarHeader profile={profile} />
        <NavLinks items={items} />
        <SidebarFooter logout={logout} />
      </aside>
    </>
  )
}

function SidebarHeader({ profile }) {
  return (
    <div className="mb-6 flex items-center gap-2.5 px-4">
      <Logo />
      <div>
        <p className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">TerritoryMap</p>
        {profile && (
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {ROLE_LABEL[profile.role] || profile.role}
          </p>
        )}
      </div>
    </div>
  )
}

function SidebarFooter({ logout }) {
  const { profile } = useAuth()
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 px-3 pt-3">
      {profile?.name && <p className="truncate px-3 pb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{profile.name}</p>}
      <ThemeToggle />
      <button type="button" onClick={logout} className="btn-ghost mt-1 w-full justify-start">
        Sign out
      </button>
    </div>
  )
}
