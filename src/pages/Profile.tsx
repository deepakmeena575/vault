import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Phone, Lock, User as UserIcon } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [mobileNumber, setMobileNumber] = useState(profile?.mobile_number || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setMobileNumber(profile.mobile_number || '');
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // Update custom profile table
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

      setMessage('Profile updated successfully!');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-start justify-between mb-10 shrink-0">
        <h1 className="text-5xl font-extrabold tracking-tight mb-2">My Profile</h1>
      </header>

      <div className="vault-card overflow-hidden flex-1 overflow-y-auto mb-8">
        <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center gap-6">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-3xl shadow-lg shadow-indigo-200">
                {profile?.full_name?.charAt(0) || <UserIcon size={40} />}
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{profile?.full_name}</h2>
                <p className="text-slate-500 font-medium">{user?.email}</p>
                <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                  {profile?.role} USER
                </div>
            </div>
        </div>

        <div className="p-8">
          <form className="space-y-6" onSubmit={handleUpdate}>
            {message && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-xl">
                <p className="text-sm font-medium text-green-700">{message}</p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                <div className="mt-2 relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-semibold text-slate-700">Mobile Number</label>
                <div className="mt-2 relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                <div className="mt-2 relative rounded-xl shadow-sm opacity-60">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    disabled
                    className="block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-100 cursor-not-allowed text-slate-500 font-medium"
                    value={user?.email || ''}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 font-medium">Email address is managed by your authentication provider and cannot be changed here.</p>
              </div>

              <div className="sm:col-span-6 pt-6 border-t border-slate-100 mt-2">
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-4">Security</h3>
                  <div>
                  <label className="block text-sm font-semibold text-slate-700">New Password</label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                      type="password"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                      placeholder="Leave blank to keep current password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      />
                  </div>
                  </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors uppercase tracking-wider"
              >
                {loading ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
