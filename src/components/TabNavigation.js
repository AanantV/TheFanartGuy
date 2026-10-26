import React from 'react';

function TabNavigation({ tabs, activeTab, onTabClick }) {
  return (
    <nav className="tab-nav" aria-label="Main navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabClick(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default TabNavigation;
