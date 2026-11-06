import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  Menu,
  X,
  BookOpen,
  FolderKanban,
  PlusCircle,
  Sun,
  Moon,
  Database,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { ClearanceBadge } from './Badges.js';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Rule 11: Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const navLinks = isAuthenticated
    ? [
        { to: '/projects', label: 'My Projects', icon: FolderKanban },
        { to: '/generate', label: 'New Handover', icon: PlusCircle },
        { to: '/sources', label: 'Sources Hub', icon: Database },
      ]
    : [];

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/signin');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link
              to={isAuthenticated ? '/projects' : '/signin'}
              className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white text-lg tracking-tight focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-md p-1 min-h-[44px] min-w-[44px]"
              aria-label="Prasaranam Home"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
                <BookOpen className="w-5 h-5" aria-hidden="true" />
              </div>
              <span>Prasaranam</span>
            </Link>
            <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              Knowledge Handover
            </span>
          </div>

          {/* Desktop Navigation (>= 768px) */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium min-h-[44px] min-w-[44px] transition-colors ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right actions: Theme toggle + Profile / Sign Out + Mobile Menu Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-sky-500"
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {isAuthenticated && user && (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-700 dark:text-sky-300 font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{user.name}</span>
                  <ClearanceBadge level={user.clearance_level} />
                </div>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center justify-center gap-1 text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 p-2 min-h-[44px] rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            )}

            {/* Mobile menu button (< 768px) */}
            <button
              ref={menuButtonRef}
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-expanded={isOpen}
              aria-controls="mobile-navigation"
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation menu drawer (Rule 11) */}
      {isOpen && (
        <div
          id="mobile-navigation"
          ref={menuRef}
          className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-2 shadow-lg"
        >
          {isAuthenticated && user && (
            <div className="p-3 mb-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-sky-600" aria-hidden="true" />
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{user.name}</span>
              </div>
              <ClearanceBadge level={user.clearance_level} />
            </div>
          )}

          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium min-h-[44px] transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}

          {isAuthenticated ? (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 min-h-[44px] text-left transition"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          ) : (
            <Link
              to="/signin"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold bg-sky-600 text-white min-h-[44px]"
            >
              <span>Sign In / Create Account</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
};
