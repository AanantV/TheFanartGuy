import React, { useState } from 'react';
import TabNavigation from './components/TabNavigation';
import Wallpapers from './components/Wallpapers';
import Commissions from './components/Commissions';
import About from './components/About';
import AdminBar from './components/AdminBar';
import Socials from './components/Socials';
import Tutorials from './components/Tutorials';
import Gallery from './components/Gallery';
import { AdminProvider } from './api';
import logo from './components/logo.jpg';
import './styles.css';

const tabs = [
  { id: 'about', label: 'About', content: <About /> },
  { id: 'wallpapers', label: 'Wallpapers', content: <Wallpapers /> },
  { id: 'tutorials', label: 'Tutorials', content: <Tutorials /> },
  { id: 'social', label: 'Social Handles', content: <Socials /> },
  { id: 'gallery', label: 'Art Gallery', content: <Gallery /> },
  { id: 'commissions', label: 'Commissions', content: <Commissions /> },
];

function App() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  return (
    <AdminProvider>
      {/* Decorative background: grid, glowing orbs and side rails */}
      <div className="bg-decor" aria-hidden="true">
        <span className="orb orb-left" />
        <span className="orb orb-right" />
        <div className="side-rail side-rail-left">
          <span className="rail-text">TheFanartGuy</span>
        </div>
        <div className="side-rail side-rail-right">
          <span className="rail-text">Fanart Wallpapers Art</span>
        </div>
      </div>

      <div className="app-container">
        <a className="skip-link" href="#content">Skip to content</a>
        <AdminBar />

        <header className="header">
          <img src={logo} alt="Logo" className="logo" />
          <h1 className="title">TheFanartGuy</h1>
        </header>

        <TabNavigation tabs={tabs} activeTab={activeTab} onTabClick={setActiveTab} />

        <main id="content" className="tab-content" tabIndex="-1">
          {activeContent}
        </main>

        <footer className="site-footer">
          <span>© {new Date().getFullYear()} TheFanartGuy</span>
          <span>Made for fandom, colour and imagination.</span>
        </footer>
      </div>
    </AdminProvider>
  );
}

export default App;
