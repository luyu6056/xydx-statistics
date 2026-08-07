import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { Placeholder } from './components/Placeholder';
import { BasicOverview } from './components/BasicOverview';
import { Retention } from './components/Retention';
import { Ltv } from './components/Ltv';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'basic_overview' && <BasicOverview />}
      {currentView === 'analytics' && <Analytics />}
      {currentView === 'ltv' && <Ltv />}
      {currentView === 'retention' && <Retention />}
      {currentView === 'settings' && <Settings />}
    </Layout>
  );
}

