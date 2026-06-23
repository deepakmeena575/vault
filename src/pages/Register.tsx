import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { FolderHeart, Mail, Lock, User, Phone } from 'lucide-react';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    // Requires email confirmation by default if configured in Supabase
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          mobile_number: mobileNumber,
          role: 'user', // Default role
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      // If email confirmation is disabled or we get auto signed in without confirmation
      // However if email confirmation is required, authData.user exists but isn't signed in natively yet.
      // We can insert profile into public.profiles
      if (authData.user) {
         try {
           const API_URL = import.meta.env.VITE_APP_URL || '';
           const res = await fetch(`${API_URL}/api/profile`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               id: authData.user.id, 
               full_name: fullName, 
               mobile_number: mobileNumber, 
               email: email,
               role: 'user'
             })
           });
           
           if (!res.ok) {
             const errorData = await res.json();
             console.error("Failed to insert profile via API:", errorData);
           } else {
             console.log("Profile created successfully via API.");
           }
         } catch(e) {
           console.error("Failed to call profile creation API", e);
         }
      }

      setSuccess('Registration successful! Please check your email to verify your account before logging in.');
      setFullName('');
      setMobileNumber('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <FolderHeart size={32} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-4xl font-extrabold tracking-tight">
          Join Vault.
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-medium tracking-wide">
          Create an account to protect your memories
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 sm:rounded-3xl sm:px-10 border border-slate-200 shadow-sm">
          <form className="space-y-4" onSubmit={handleRegister}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-xl">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded-r-xl">
                <p className="text-sm font-medium text-green-700">{success}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700">Full Name</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Mobile Number</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="+1 (555) 000-0000"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Email address</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Confirm Password</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-11 sm:text-sm border-slate-200 rounded-xl py-3 border px-3 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors uppercase tracking-wider"
              >
                {loading ? 'Creating account...' : 'Register'}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-400 font-medium">Already have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors uppercase tracking-wider"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
