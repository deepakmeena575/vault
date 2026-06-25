import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type UploadMode = 'saver' | 'balanced' | 'original';

export interface DeviceSession {
  id: string;
  deviceName: string;
  browserName: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

interface SecurityContextType {
  userPin: string | null;
  setUserPin: (pin: string | null) => void;
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
  uploadMode: UploadMode;
  setUploadMode: (mode: UploadMode) => void;
  sessions: DeviceSession[];
  revokeSession: (id: string) => void;
  revokeOtherSessions: () => void;
  revokeAllSessions: () => void;
  showInactivityWarning: boolean;
  setShowInactivityWarning: (show: boolean) => void;
  inactivityCountdown: number;
  resetInactivityTimer: () => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signOut } = useAuth();
  const [userPin, setUserPinState] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [uploadMode, setUploadModeState] = useState<UploadMode>('saver');
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(60);

  // 1. PIN & Upload Mode persistence
  useEffect(() => {
    if (user) {
      const savedPin = localStorage.getItem(`vault_pin_${user.id}`);
      setUserPinState(savedPin);

      const savedMode = localStorage.getItem(`vault_upload_mode_${user.id}`) as UploadMode;
      if (savedMode) {
        setUploadModeState(savedMode);
      } else {
        setUploadModeState('saver');
      }

      // Load simulated device sessions
      loadSessions();
    } else {
      setUserPinState(null);
      setSessions([]);
    }
  }, [user]);

  const setUserPin = (pin: string | null) => {
    if (!user) return;
    if (pin) {
      localStorage.setItem(`vault_pin_${user.id}`, pin);
    } else {
      localStorage.removeItem(`vault_pin_${user.id}`);
    }
    setUserPinState(pin);
  };

  const setUploadMode = (mode: UploadMode) => {
    if (!user) return;
    localStorage.setItem(`vault_upload_mode_${user.id}`, mode);
    setUploadModeState(mode);
  };

  // 2. Simulated Session Management
  const loadSessions = () => {
    if (!user) return;
    const sessionKey = `vault_sessions_${user.id}`;
    const saved = localStorage.getItem(sessionKey);
    
    if (saved) {
      const parsed = JSON.parse(saved) as DeviceSession[];
      // Update last active of current session
      const updated = parsed.map(s => s.isCurrent ? { ...s, lastActive: new Date().toISOString() } : s);
      setSessions(updated);
      localStorage.setItem(sessionKey, JSON.stringify(updated));
    } else {
      // Create default sessions for high-fidelity realism
      const userAgent = navigator.userAgent;
      let browser = 'Chrome';
      if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Edg')) browser = 'Edge';

      const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
      const defaultDevice = isMobile ? 'Apple iPhone (Mobile)' : 'MacBook Pro (Desktop)';

      const initial: DeviceSession[] = [
        {
          id: 'curr-1',
          deviceName: defaultDevice,
          browserName: browser,
          location: 'San Jose, CA (IP: 172.56.21.90)',
          lastActive: new Date().toISOString(),
          isCurrent: true
        },
        {
          id: 'prev-1',
          deviceName: 'Apple iPad Air',
          browserName: 'Mobile Safari',
          location: 'San Jose, CA (IP: 172.56.21.90)',
          lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
          isCurrent: false
        },
        {
          id: 'prev-2',
          deviceName: 'Windows PC',
          browserName: 'Microsoft Edge',
          location: 'Phoenix, AZ (IP: 68.4.110.15)',
          lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
          isCurrent: false
        }
      ];
      setSessions(initial);
      localStorage.setItem(sessionKey, JSON.stringify(initial));
    }
  };

  const revokeSession = (id: string) => {
    if (!user) return;
    const sessionKey = `vault_sessions_${user.id}`;
    
    // If revoking current, perform immediate signout
    const target = sessions.find(s => s.id === id);
    if (target?.isCurrent) {
      signOut();
      return;
    }

    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    localStorage.setItem(sessionKey, JSON.stringify(filtered));
  };

  const revokeOtherSessions = () => {
    if (!user) return;
    const sessionKey = `vault_sessions_${user.id}`;
    const current = sessions.filter(s => s.isCurrent);
    setSessions(current);
    localStorage.setItem(sessionKey, JSON.stringify(current));
  };

  const revokeAllSessions = () => {
    signOut();
  };


  // 3. Auto Logout (User Inactivity for 5 minutes)
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  const resetInactivityTimer = () => {
    setLastActivity(Date.now());
    if (showInactivityWarning) {
      setShowInactivityWarning(false);
      setInactivityCountdown(60);
    }
  };

  useEffect(() => {
    if (!user) {
      setShowInactivityWarning(false);
      return;
    }

    // Interaction listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      // Throttle state update
      if (Date.now() - lastActivity > 2000) {
        resetInactivityTimer();
      }
    };

    events.forEach(e => window.addEventListener(e, handleActivity));

    // Polling interval
    const interval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      
      // 5 minutes = 300,000ms
      if (inactiveTime >= 5 * 60 * 1000) {
        if (!showInactivityWarning) {
          setShowInactivityWarning(true);
          setInactivityCountdown(60);
        }
      }
    }, 5000);

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearInterval(interval);
    };
  }, [user, lastActivity, showInactivityWarning]);

  // Countdown timer for Warning modal
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    if (showInactivityWarning && user) {
      countdownInterval = setInterval(() => {
        setInactivityCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            signOut(); // Timeout logout
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownInterval);
  }, [showInactivityWarning, user]);


  // 4. Background App Protection (5 minutes background triggers lock screen)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem(`vault_bg_time_${user.id}`, Date.now().toString());
      } else if (document.visibilityState === 'visible') {
        const bgTimeStr = localStorage.getItem(`vault_bg_time_${user.id}`);
        if (bgTimeStr) {
          const bgTime = parseInt(bgTimeStr, 10);
          const elapsed = Date.now() - bgTime;
          
          // If backgrounded for more than 5 minutes (300,000ms)
          if (elapsed >= 5 * 60 * 1000) {
            const pin = localStorage.getItem(`vault_pin_${user.id}`);
            if (pin) {
              setIsAppLocked(true);
            }
          }
          localStorage.removeItem(`vault_bg_time_${user.id}`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  return (
    <SecurityContext.Provider value={{
      userPin,
      setUserPin,
      isAppLocked,
      setIsAppLocked,
      uploadMode,
      setUploadMode,
      sessions,
      revokeSession,
      revokeOtherSessions,
      revokeAllSessions,
      showInactivityWarning,
      setShowInactivityWarning,
      inactivityCountdown,
      resetInactivityTimer
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
