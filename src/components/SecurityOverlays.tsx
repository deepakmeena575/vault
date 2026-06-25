import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Lock, ShieldCheck, HelpCircle, LogOut, Loader2, KeyRound } from 'lucide-react';

export const SecurityOverlays: React.FC = () => {
  const { user } = useAuth();
  const {
    isAppLocked,
    setIsAppLocked,
    userPin,
    showInactivityWarning,
    inactivityCountdown,
    resetInactivityTimer,
    revokeAllSessions
  } = useSecurity();

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [usePasswordFallback, setUsePasswordFallback] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  if (!user) return null;

  // 1. Inactivity Warning Modal
  const handleInactivityStay = () => {
    resetInactivityTimer();
  };

  const handleInactivityLogout = () => {
    revokeAllSessions();
  };

  // 2. PIN Pad Handlers
  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const newVal = pinInput + digit;
      setPinInput(newVal);
      setPinError('');
      
      // Auto-submit when hitting 4 digits
      if (newVal === userPin) {
        setIsAppLocked(false);
        setPinInput('');
      } else if (newVal.length === 4) {
        setTimeout(() => {
          setPinError('Incorrect PIN code');
          setPinInput('');
        }, 150);
      }
    }
  };

  const handlePinDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const handlePasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !passwordInput) return;
    setVerifyingPassword(true);
    setPasswordError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordInput,
      });

      if (error) {
        setPasswordError('Invalid account password');
      } else {
        // Success re-auth!
        setIsAppLocked(false);
        setPasswordInput('');
        setUsePasswordFallback(false);
      }
    } catch (err) {
      setPasswordError('Failed to verify password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  return (
    <>
      {/* INACTIVITY WARNING OVERLAY */}
      {showInactivityWarning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 animate-bounce">
              <ShieldAlert size={28} />
            </div>
            
            <h3 className="text-base font-black text-slate-900 tracking-tight">Security Session Expiry</h3>
            <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
              Your PrivateVault session has been idle. To protect your private photos, you will be logged out in:
            </p>
            
            <div className="my-5 py-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-4xl font-black text-purple-600 tracking-wider">
                00:{inactivityCountdown.toString().padStart(2, '0')}
              </span>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleInactivityStay}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs py-3.5 rounded-2xl uppercase tracking-wider transition-all active:scale-[0.99] shadow-md shadow-purple-200"
              >
                Stay Logged In
              </button>
              <button
                onClick={handleInactivityLogout}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-3 rounded-2xl uppercase tracking-wider transition-all"
              >
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND APP LOCKED SCREEN */}
      {isAppLocked && (
        <div className="fixed inset-0 bg-slate-950 z-[9998] flex flex-col items-center justify-between py-12 px-6 animate-in fade-in duration-300">
          
          {/* Top Banner */}
          <div className="flex flex-col items-center pt-8 text-center">
            <div className="w-14 h-14 bg-purple-600/15 border border-purple-500/20 text-purple-400 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
              <Lock size={24} className="animate-pulse" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">PrivateVault Securely Locked</h2>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
              Personal Private Cloud
            </p>
          </div>

          {/* Central Security Screen Content (PIN or Password) */}
          <div className="w-full max-w-xs flex flex-col items-center">
            {usePasswordFallback ? (
              /* Password Re-auth Form */
              <form onSubmit={handlePasswordVerify} className="w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <p className="text-center text-xs text-slate-400 leading-relaxed font-semibold">
                  Confirm your PrivateVault account password to restore access:
                </p>
                
                <div className="space-y-1">
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Account Password"
                      className="w-full pl-10 text-xs py-3 border border-slate-800 rounded-2xl bg-slate-900 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-semibold"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                  </div>
                  {passwordError && (
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-1">{passwordError}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUsePasswordFallback(false);
                      setPasswordError('');
                    }}
                    className="flex-1 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-extrabold text-xs rounded-2xl uppercase tracking-wider"
                  >
                    Use PIN
                  </button>
                  <button
                    type="submit"
                    disabled={verifyingPassword}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-2xl uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    {verifyingPassword ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      'Verify'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Traditional PIN Dots & PIN Pad */
              <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
                
                {/* Dots indicator */}
                <div className="flex justify-center gap-4.5 mb-8">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${
                        idx < pinInput.length
                          ? 'bg-purple-500 border-purple-500 scale-110 shadow-md shadow-purple-500/50'
                          : pinError
                          ? 'border-red-500 animate-shake'
                          : 'border-slate-700'
                      }`}
                    ></div>
                  ))}
                </div>

                {pinError && (
                  <p className="text-[10px] text-red-400 font-black tracking-widest uppercase mb-6 animate-pulse">
                    {pinError}
                  </p>
                )}

                {/* Tactile Keypad */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinDigit(num)}
                      className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 active:scale-90 text-white font-black text-xl flex items-center justify-center transition-all shadow-sm"
                    >
                      {num}
                    </button>
                  ))}
                  
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider flex items-center justify-center"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePinDigit('0')}
                    className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 active:scale-90 text-white font-black text-xl flex items-center justify-center transition-all shadow-sm"
                  >
                    0
                  </button>

                  {/* Password Fallback Button */}
                  <button
                    type="button"
                    onClick={() => setUsePasswordFallback(true)}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-widest leading-none flex flex-col items-center justify-center gap-0.5"
                  >
                    <span>Use</span>
                    <span>Pass</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Secure watermark */}
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold tracking-widest uppercase">
            <ShieldCheck size={14} className="text-purple-600" />
            <span>Encrypted PrivateVault Space</span>
          </div>

        </div>
      )}
    </>
  );
};
