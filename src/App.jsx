import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import BrowseSection from './components/BrowseSection';
import HowItWorks from './components/HowItWorks';
import StaySafe from './components/StaySafe';
import Footer from './components/Footer';
import Toast from './components/Toast';
import ChatDrawer from './components/ChatDrawer';

import AuthModal from './components/modals/AuthModal';
import PostListingModal from './components/modals/PostListingModal';
import ListingDetailModal from './components/modals/ListingDetailModal';
import UserProfileModal from './components/modals/UserProfileModal';
import RateModal from './components/modals/RateModal';
import DoneModal from './components/modals/DoneModal';
import HoldModal from './components/modals/HoldModal';
import ReportModal from './components/modals/ReportModal';
import AdminReportsModal from './components/modals/AdminReportsModal';
import AlertsModal from './components/modals/AlertsModal';

function MainApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isWishlistActive, setIsWishlistActive] = useState(false);
  const { requireLogin, appError, dataLoading } = useApp();

  const handleWishlistToggle = () => {
    requireLogin(() => {
      setIsWishlistActive((prev) => {
        const next = !prev;
        if (next) {
          const browseEl = document.getElementById('browse');
          if (browseEl) {
            browseEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
        return next;
      });
    });
  };

  return (
    <>
      <Navbar
        onWishlistToggle={handleWishlistToggle}
        isWishlistActive={isWishlistActive}
      />

      <main id="top">
        {appError && <p className="err" role="alert">{appError}</p>}
        {!appError && dataLoading && <p className="chat-note" role="status">Loading Campus Swap…</p>}
        <Hero onSearch={setSearchQuery} />
        <BrowseSection
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSavedOnly={isWishlistActive}
          setIsSavedOnly={setIsWishlistActive}
        />
        <HowItWorks />
        <StaySafe />
      </main>

      <Footer />

      {/* Slide-over chat and messaging */}
      <ChatDrawer />

      {/* Modals */}
      <AuthModal />
      <PostListingModal />
      <ListingDetailModal />
      <UserProfileModal />
      <RateModal />
      <DoneModal />
      <HoldModal />
      <ReportModal />
      <AdminReportsModal />
      <AlertsModal />

      {/* Floating toast alerts */}
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
