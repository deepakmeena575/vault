import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSecurity, UploadMode } from '../context/SecurityContext';
import { supabase } from '../lib/supabase';
import { 
  Mail, Phone, Lock, User as UserIcon, LogOut, ShieldAlert, KeyRound, Check, AlertCircle, 
  Database, ShieldCheck, Cpu, Laptop, Smartphone, Save, Eye, EyeOff, Trash2, AlertTriangle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    userPin,
    setUserPin,
    uploadMode,
    setUploadMode,
    sessions,
    revokeSession,
    revokeOtherSessions,
    revokeAllSessions
  } = useSecurity();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [mobileNumber, setMobileNumber] = useState(profile?.mobile_number || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // PIN settings state
  const [pinValue, setPinValue] = useState(userPin || '');
  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setMobileNumber(profile.mobile_number || '');
    }
  }, [profile]);

  useEffect(() => {
    if (userPin) {
      setPinValue(userPin);
    }
  }, [userPin]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          mobile_number: mobileNumber,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update password if provided
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password,
        });
        if (passwordError) throw passwordError;
      }

      setMessage('Settings updated successfully!');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage('');
    setPinError('');

    if (!pinValue) {
      setUserPin(null);
      setPinMessage('PIN security disabled successfully!');
      return;
    }

    if (!/^\d{4}$/.test(pinValue)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    setUserPin(pinValue);
    setPinMessage('Secure Lock PIN set successfully!');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      "WARNING: Are you sure you want to permanently delete your Private Vault account? This will immediately and irreversibly delete all your profile data, folders, photos, videos, and credentials from our secure cloud storage. This action CANNOT be undone."
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      "Type OK/CONFIRM below... Wait, please confirm one final time: click OK to permanently delete everything."
    );
    if (!doubleConfirmed) return;

    setIsDeletingAccount(true);
    try {
      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to delete account");
      }

      alert("Your account and all associated secure records have been permanently destroyed.");
      await signOut();
      navigate('/login');
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      alert(`Account deletion failed: ${err.message || 'unknown error'}`);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* Top Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-slate-50 shrink-0">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vault Control Center</p>
          <h1 className="text-base font-black text-slate-900 tracking-tight">Security & Settings</h1>
        </div>
        <button 
          onClick={handleSignOut}
          className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50/50 border border-red-100/30"
        >
          <LogOut size={13} />
          <span>Exit</span>
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 px-5 py-5 space-y-6 pb-12">
        
        {/* User Card */}
        <div className="p-4 bg-slate-50 border border-slate-100/60 rounded-2xl flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md shadow-purple-200">
            {profile?.full_name?.charAt(0) || <UserIcon size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{profile?.full_name}</h2>
            <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
            <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-800 uppercase tracking-wider">
              <ShieldCheck size={10} className="mr-1" /> Secured Account
            </div>
          </div>
        </div>

        {/* Admin Shortcuts (If active) */}
        {profile?.role === 'admin' && (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5 text-amber-800">
              <ShieldAlert size={16} />
              <span className="text-xs font-extrabold uppercase tracking-wider">Admin Actions</span>
            </div>
            <p className="text-[10px] text-amber-600 leading-relaxed font-semibold">
              You are signed in as an administrator. Access backoffice tools directly:
            </p>
            <div className="flex gap-2 pt-1">
              <Link
                to="/admin"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-bold"
              >
                Admin Dashboard
              </Link>
              <Link
                to="/admin/photos"
                className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 rounded-xl text-[10px] font-bold"
              >
                All Users Photos
              </Link>
            </div>
          </div>
        )}

        {/* 1. INTELLIGENT STORAGE PREFERENCES */}
        <div className="p-5 bg-purple-50/20 border border-purple-100/30 rounded-3xl space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
              <Database size={14} className="text-purple-600" />
              <span>Storage Optimization Mode</span>
            </h3>
            <p className="text-[10px] text-purple-600/70 font-semibold mt-1 leading-normal">
              Adjust compression level. Saver mode targets up to 2000 photos per GB with minimal visual loss.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Storage Saver Option */}
            <button
              onClick={() => setUploadMode('saver')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                uploadMode === 'saver'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200'
                  : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Storage Saver (Default)</span>
                {uploadMode === 'saver' && <Check size={14} className="stroke-[3]" />}
              </div>
              <p className={`text-[9px] mt-1 font-semibold leading-relaxed ${
                uploadMode === 'saver' ? 'text-purple-100' : 'text-slate-400'
              }`}>
                Converts to ultra-optimized WebP, resizes to 1920px max, 82% quality. Safes 80%+ space.
              </p>
            </button>

            {/* Balanced Option */}
            <button
              onClick={() => setUploadMode('balanced')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                uploadMode === 'balanced'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200'
                  : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Balanced Quality</span>
                {uploadMode === 'balanced' && <Check size={14} className="stroke-[3]" />}
              </div>
              <p className={`text-[9px] mt-1 font-semibold leading-relaxed ${
                uploadMode === 'balanced' ? 'text-purple-100' : 'text-slate-400'
              }`}>
                Converts to WebP, resizes to 2560px max, 90% quality. High resolution, high optimization.
              </p>
            </button>

            {/* Original Quality Option */}
            <button
              onClick={() => setUploadMode('original')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                uploadMode === 'original'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200'
                  : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Original Quality</span>
                {uploadMode === 'original' && <Check size={14} className="stroke-[3]" />}
              </div>
              <p className={`text-[9px] mt-1 font-semibold leading-relaxed ${
                uploadMode === 'original' ? 'text-purple-100' : 'text-slate-400'
              }`}>
                Uploads exact untouched file binary. Takes maximum storage space (no compression).
              </p>
            </button>
          </div>
        </div>

        {/* 2. PRIVATE VAULT PIN LOCK */}
        <div className="p-5 bg-slate-50 border border-slate-100/60 rounded-3xl space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <KeyRound size={14} className="text-purple-600" />
              <span>Personal Vault PIN Lock</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
              Set a 4-digit PIN to secure custom folders and enable lock-screen protection when backgrounded.
            </p>
          </div>

          <form onSubmit={handleSavePin} className="space-y-3">
            {pinMessage && (
              <div className="bg-green-50 border border-green-100/50 p-3 rounded-xl flex items-center gap-2">
                <Check className="text-green-600 shrink-0" size={14} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">{pinMessage}</p>
              </div>
            )}
            {pinError && (
              <div className="bg-red-50 border border-red-100/50 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="text-red-600 shrink-0" size={14} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">{pinError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1 rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  pattern="\d*"
                  inputMode="numeric"
                  placeholder="Enter 4-digit PIN (e.g. 1234)"
                  className="focus:ring-2 focus:ring-purple-100 focus:border-purple-500 block w-full pl-10 pr-10 text-xs border-slate-100/80 rounded-2xl py-3 border px-3 bg-white outline-none transition-all font-bold tracking-widest text-slate-800"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <button
                type="submit"
                className="px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                <Save size={15} />
              </button>
            </div>
            {!userPin && (
              <p className="text-[9px] text-amber-600 font-extrabold uppercase tracking-wide flex items-center gap-1 bg-amber-50 p-2 rounded-lg border border-amber-100/50">
                <ShieldAlert size={12} /> PIN lock currently inactive.
              </p>
            )}
          </form>
        </div>

        {/* 3. SESSION MANAGEMENT (ACTIVE DEVICES) */}
        <div className="p-5 bg-slate-50 border border-slate-100/60 rounded-3xl space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Cpu size={14} className="text-purple-600" />
              <span>Active Vault Sessions</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
              These devices have access to your personal cloud. Revoke any session instantly.
            </p>
          </div>

          <div className="space-y-2.5">
            {sessions.map(s => (
              <div 
                key={s.id}
                className="p-3 bg-white border border-slate-100 rounded-2xl flex items-center gap-3"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  s.isCurrent ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {s.deviceName.toLowerCase().includes('iphone') || s.deviceName.toLowerCase().includes('ipad') ? (
                    <Smartphone size={16} />
                  ) : (
                    <Laptop size={16} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-extrabold text-slate-800 truncate">
                      {s.deviceName}
                    </p>
                    {s.isCurrent && (
                      <span className="text-[8px] font-black uppercase bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
                    {s.browserName} • {s.location}
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {s.isCurrent ? 'Active Now' : `Last active ${new Date(s.lastActive).toLocaleDateString()}`}
                  </p>
                </div>

                <button
                  onClick={() => revokeSession(s.id)}
                  className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1.5 rounded-xl border border-red-100/50 hover:bg-red-50 text-red-500 bg-white shadow-sm transition-all active:scale-95"
                >
                  {s.isCurrent ? 'Log Out' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>

          {sessions.length > 1 && (
            <div className="flex gap-2 pt-1.5">
              <button
                onClick={revokeOtherSessions}
                className="flex-1 py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-[10px] rounded-2xl uppercase tracking-wider text-center transition-all"
              >
                Log Out Other Devices
              </button>
              <button
                onClick={revokeAllSessions}
                className="flex-1 py-3 bg-red-50/50 hover:bg-red-50 border border-red-100 text-red-600 font-extrabold text-[10px] rounded-2xl uppercase tracking-wider text-center transition-all"
              >
                Log Out All Devices
              </button>
            </div>
          )}
        </div>

        {/* 4. UPDATE BASIC PROFILE */}
        <div className="p-5 bg-slate-50 border border-slate-100/60 rounded-3xl space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <UserIcon size={14} className="text-purple-600" />
              <span>Update Profile Info</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
              Modify account meta details or change login password.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleUpdate}>
            {message && (
              <div className="bg-green-50 border border-green-100/50 p-3 rounded-xl flex items-center gap-2">
                <Check className="text-green-600 shrink-0" size={16} />
                <p className="text-xs font-semibold text-green-700">{message}</p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-100/50 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="text-red-600 shrink-0" size={16} />
                <p className="text-xs font-semibold text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <UserIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    className="focus:ring-2 focus:ring-purple-100 focus:border-purple-500 block w-full pl-10 text-xs border-slate-100/80 rounded-2xl py-3 border px-3 bg-white outline-none transition-all font-semibold text-slate-800"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mobile Number</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    placeholder="e.g. +1 555-0100"
                    className="focus:ring-2 focus:ring-purple-100 focus:border-purple-500 block w-full pl-10 text-xs border-slate-100/80 rounded-2xl py-3 border px-3 bg-white outline-none transition-all font-semibold text-slate-800"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Email (Disabled) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                <div className="relative rounded-2xl opacity-60">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    disabled
                    className="block w-full pl-10 text-xs border-slate-100/80 rounded-2xl py-3 border px-3 bg-slate-100 cursor-not-allowed text-slate-500 font-semibold"
                    value={user?.email || ''}
                  />
                </div>
              </div>

              {/* Password Update */}
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Update Password</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    className="focus:ring-2 focus:ring-purple-100 focus:border-purple-500 block w-full pl-10 text-xs border-slate-100/80 rounded-2xl py-3 border px-3 bg-white outline-none transition-all font-semibold text-slate-800"
                    placeholder="Leave blank to keep current"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-md shadow-purple-50 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.99] transition-all uppercase tracking-widest"
            >
              {loading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Dangerous Signout list element */}
        <div className="pt-3 border-t border-slate-50 space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between p-4 bg-red-50/50 hover:bg-red-50 text-red-600 rounded-2xl border border-red-100/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <LogOut size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Log Out of Vault</span>
            </div>
            <span className="text-[10px] font-bold bg-white text-red-500 border border-red-100 px-2 py-0.5 rounded-full group-hover:scale-105 transition-all">
              Sign Out
            </span>
          </button>

          {/* Danger Zone: Permanent Account Deletion */}
          <button
            onClick={handleDeleteAccount}
            disabled={isDeletingAccount}
            className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border border-red-200 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 size={16} className="text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                {isDeletingAccount ? "Deleting Records..." : "Permanently Delete Account"}
              </span>
            </div>
            <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
              DANGER
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
