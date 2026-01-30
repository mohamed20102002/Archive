import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { OutlookBrowser } from '../outlook/OutlookBrowser'

export function MainLayout() {
  const location = useLocation()
  const isOutlookRoute = location.pathname === '/outlook'

  return (
    <div className="min-h-screen bg-archive-light flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - always fixed */}
        <Header />

        {/* Page content - each page handles its own scroll */}
        <main className="flex-1 overflow-hidden">
          {/* Always render OutlookBrowser, hide when not active */}
          <div className={isOutlookRoute ? 'h-full' : 'hidden'}>
            <OutlookBrowser />
          </div>
          {/* Render other routes via Outlet */}
          {!isOutlookRoute && (
            <div className="h-full overflow-auto">
              <div className="p-6">
                <Outlet />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
