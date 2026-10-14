"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Moon, Sun } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import styles from './Navbar.module.css';
import UserDropdown from './UserDropdown';

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoggedIn = !!session; 

  useEffect(() => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      requestAnimationFrame(() => setIsDark(false));
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = () => {
    setIsLoggingIn(true);
    signIn('github', { callbackUrl: '/dashboard' });
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.left}>
          <button className={`${styles.iconBtn} ${styles.mobileMenuBtn}`} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle Menu">
            <Menu size={20} />
          </button>
          <Link href="/" className={styles.logo}>
            <span className="glow-text">panic.</span>design
          </Link>
          <div className={`${styles.links} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}>
            <Link href="/dashboard" className={`${styles.link} ${pathname === '/dashboard' ? styles.active : ''}`}>Dashboard</Link>
            <Link href="/docs" className={`${styles.link} ${pathname === '/docs' ? styles.active : ''}`}>Docs</Link>
            <Link href="/changelog" className={`${styles.link} ${pathname === '/changelog' ? styles.active : ''}`}>Changelog</Link>
          </div>
        </div>
        
        <div className={styles.right}>
          <button className={styles.iconBtn} aria-label="Toggle Theme" onClick={toggleTheme}>
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {status === 'loading' ? (
            <div className={styles.avatarSkeleton} />
          ) : isLoggedIn && session?.user ? (
            <UserDropdown user={{
              name: ((session.user as Record<string, unknown>).username as string) || session.user.name || "User",
              email: session.user.email || "",
              avatarUrl: ((session.user as Record<string, unknown>).avatarUrl as string) || session.user.image || "",
              tokens: 0,
              usage: 0
            }} />
          ) : (
            <button className={`btn-secondary ${styles.authBtn}`} onClick={handleLogin} disabled={isLoggingIn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
              <span>{isLoggingIn ? 'Redirecting...' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
