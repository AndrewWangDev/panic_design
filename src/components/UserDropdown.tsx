"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Key, Activity, BookOpen, Bug, LogOut, ShieldAlert, UserX } from 'lucide-react';
import { signOut } from 'next-auth/react';
import styles from './UserDropdown.module.css';

interface UserDropdownProps {
  user: {
    name: string;
    email: string;
    avatarUrl: string;
    tokens: number;
    usage: number;
  }
}

export default function UserDropdown({ user }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState({ 
    tokens: user.tokens, 
    dailyUsage: 0, 
    dailyLimit: 100,
    hourlyUsage: 0,
    hourlyLimit: 30,
    nextHourReset: '',
    nextDayReset: ''
  });
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/user/stats')
        .then(res => res.ok ? res.json() : null)
        .then((data: any) => {
          if (data) setStats({ 
            tokens: data.tokens, 
            dailyUsage: data.dailyUsage, 
            dailyLimit: data.dailyLimit,
            hourlyUsage: data.hourlyUsage,
            hourlyLimit: data.hourlyLimit,
            nextHourReset: data.nextHourReset,
            nextDayReset: data.nextDayReset
          });
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleRevokeAllClick = () => {
    setShowRevokeModal(true);
    setIsOpen(false);
  };

  const executeRevokeAll = async () => {
    setIsRevoking(true);
    try {
      const res = await fetch('/api/user/revoke-all', { method: 'POST' });
      if (res.ok) {
        setStats(s => ({ ...s, tokens: 0 }));
        if (window.location.pathname === '/dashboard') {
          window.location.reload();
        }
      } else {
        alert('Failed to revoke tokens.');
      }
    } catch (e) {
      console.error(e);
      alert('Error revoking tokens.');
    }
    setIsRevoking(false);
    setShowRevokeModal(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setIsOpen(false);
  };

  const executeDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' });
      if (res.ok) {
        await signOut({ callbackUrl: '/' });
      } else {
        alert('Failed to delete account.');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting account.');
    }
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  const hourlyPercent = Math.min((stats.hourlyUsage / Math.max(stats.hourlyLimit, 1)) * 100, 100);
  const dailyPercent = Math.min((stats.dailyUsage / Math.max(stats.dailyLimit, 1)) * 100, 100);

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button 
        className={styles.avatarBtn} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User Menu"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt="Avatar" className={styles.avatarImg} />
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          {/* Area 1: The Identity Block */}
          <div className={styles.identityBlock}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatarUrl} alt="Avatar" className={styles.identityAvatar} />
            <div className={styles.identityInfo}>
              <div className={styles.username}>{user.name}</div>
              <div className={styles.email}>{user.email}</div>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Area 2: Assets & Usage */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Key size={14} /> Edge Tokens
              </div>
              <span className={styles.badge}>{stats.tokens} active</span>
            </div>
            <button 
              className={styles.revokeBtn} 
              onClick={handleRevokeAllClick}
              disabled={isRevoking}
            >
              <ShieldAlert size={14} /> {isRevoking ? 'Revoking...' : 'Revoke All'}
            </button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Activity size={14} /> Hourly Quota
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className={styles.usageText}>{stats.hourlyUsage} / {stats.hourlyLimit}</span>
                {stats.nextHourReset && <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Resets at {new Date(stats.nextHourReset).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
              </div>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${hourlyPercent}%` }} 
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Activity size={14} /> Daily Quota
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className={styles.usageText}>{stats.dailyUsage} / {stats.dailyLimit}</span>
                {stats.nextDayReset && <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Resets at {new Date(stats.nextDayReset).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
              </div>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${dailyPercent}%` }} 
              />
            </div>
          </div>

          <div className={styles.divider} />

          {/* Area 3: Docs & Support */}
          <div className={styles.menuList}>
            <Link href="/docs" className={styles.menuItem}>
              <BookOpen size={16} /> API Documentation
            </Link>
            <a href="https://github.com/AndrewWangDev/panic_design/issues" target="_blank" rel="noreferrer" className={styles.menuItem}>
              <Bug size={16} /> Report an Issue
            </a>
          </div>

          <div className={styles.divider} />

          {/* Area 4: Logout */}
          <div className={styles.menuList}>
            <button className={styles.menuItemLogOut} onClick={() => { setIsLoggingOut(true); signOut(); }} disabled={isLoggingOut}>
              <LogOut size={16} /> {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
            <button className={styles.menuItemDelete} onClick={handleDeleteClick}>
              <UserX size={16} /> Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <ShieldAlert size={24} className={styles.modalIcon} />
              <div className={styles.modalTitle}>Revoke All Tokens</div>
            </div>
            <div className={styles.modalBody}>
              Are you sure you want to revoke <strong>ALL</strong> your edge tokens? This will instantly block all traffic using these tokens and cannot be undone.
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowRevokeModal(false)} disabled={isRevoking}>
                Cancel
              </button>
              <button className={styles.confirmRevokeBtn} onClick={executeRevokeAll} disabled={isRevoking}>
                {isRevoking ? 'Revoking...' : 'Yes, Revoke All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <UserX size={24} className={styles.modalIconDelete} />
              <div className={styles.modalTitleDelete}>Delete Account</div>
            </div>
            <div className={styles.modalBody}>
              Are you sure you want to delete your account? This will <strong>permanently disconnect</strong> your GitHub profile, scramble your identity, and instantly revoke all active chaos tokens.<br /><br />
              Your historical metrics will be kept anonymously for system integrity, but you will permanently lose access to your remaining usage quota.
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className={styles.confirmDeleteBtn} onClick={executeDeleteAccount} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
