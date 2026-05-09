import React, { useState } from 'react';
import { LayoutDashboard, BarChart3, Settings, User, RefreshCw, ChevronDown, ChevronRight, PieChart, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

type MenuItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    label: '数据概览',
    icon: <LayoutDashboard size={20} />,
  },
  {
    id: 'basic_data',
    label: '基础数据',
    icon: <BarChart3 size={20} />,
    children: [
      { id: 'basic_overview', label: '基础总览' },
      { id: 'analytics', label: '详细查询' },
      { id: 'ltv', label: 'LTV查询' },
      { id: 'retention', label: '账户留存' },
    ]
  },
  {
    id: 'system',
    label: '系统管理',
    icon: <Settings size={20} />,
    children: [
      { id: 'settings', label: '系统设置' },
    ]
  }
];

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['basic_data', 'system']);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const viewTitles: Record<string, string> = {
    dashboard: '数据概览',
    basic_overview: '基础总览',
    analytics: '详细查询',
    ltv: 'LTV查询',
    retention: '账户留存',
    settings: '系统设置'
  };

  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="p-6 border-b border-neutral-100">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <BarChart3 size={20} />
            </div>
            GameSight
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map(item => (
            <div key={item.id}>
              {item.children ? (
                // Parent Item
                <div>
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </div>
                    {expandedMenus.includes(item.id) ? (
                      <ChevronDown size={16} className="text-neutral-400" />
                    ) : (
                      <ChevronRight size={16} className="text-neutral-400" />
                    )}
                  </button>
                  
                  {/* Children */}
                  {expandedMenus.includes(item.id) && (
                    <div className="mt-1 ml-4 space-y-1 border-l border-neutral-100 pl-2">
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => onViewChange(child.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            currentView === child.id
                              ? "bg-indigo-50 text-indigo-600" 
                              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                          )}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Single Item
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    currentView === item.id
                      ? "bg-indigo-50 text-indigo-600" 
                      : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-100">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
            <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-500">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">管理员</p>
              <p className="text-xs text-neutral-500 truncate">admin@gamesight.io</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-neutral-800">{viewTitles[currentView] || 'GameSight'}</h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('app-refresh'))}
              className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-full relative transition-colors"
              title="刷新数据"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
