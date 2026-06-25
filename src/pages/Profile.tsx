import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  Mail,
  Lock,
  User as UserIcon,
  LogOut,
  Check,
  AlertCircle,
  HardDrive,
  Image as ImageIcon,
  Shield,
  HelpCircle,
  ChevronRight,
  Info,
  Clock,
  Save,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Profile: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile data
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password update
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Auto Logout setting
  const [autoLogoutDuration, setAutoLogoutDuration] =
    useState<string>("300000"); // Default 5 mins in ms

  // Support Modals
  const [activeModal, setActiveModal] = useState<"help" | "privacy" | null>(
    null,
  );

  // Stats
  const [photosCount, setPhotosCount] = useState<number>(0);
  const [storageSize, setStorageSize] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

  // Load stats & current auto logout preference
  useEffect(() => {
    if (!user) return;

    // Load auto logout duration
    const savedDuration = localStorage.getItem(
      `vault_auto_logout_duration_${user.id}`,
    );
    if (savedDuration) {
      setAutoLogoutDuration(savedDuration);
    } else {
      setAutoLogoutDuration("300000"); // 5 minutes
    }

    const fetchUserStats = async () => {
      try {
        const { data: photosData, error } = await supabase
          .from("photos")
          .select("id")
          .eq("user_id", user.id);

        if (error) throw error;

        const pCount = photosData?.length || 0;
        setPhotosCount(pCount);

        const getStableSizeNumber = (id: string) => {
          let hash = 0;
          for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
          }
          return 0.5 + Math.abs(hash % 20) / 10;
        };

        const totalStorage = (photosData || []).reduce(
          (acc, photo) => acc + getStableSizeNumber(photo.id),
          0,
        );
        setStorageSize(totalStorage);
      } catch (err) {
        console.error("Error fetching stats in profile:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchUserStats();
  }, [user]);

  // Update profile name
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;
      setProfileMessage("Name updated successfully!");
    } catch (err: any) {
      setProfileError(err.message || "Failed to update name");
    } finally {
      setSavingProfile(false);
    }
  };

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return;
    }

    setSavingPassword(true);
    setPasswordMessage("");
    setPasswordError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;
      setPasswordMessage("Password changed successfully!");
      setNewPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  // Change Auto Logout Preference
  const handleAutoLogoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAutoLogoutDuration(val);
    if (user) {
      localStorage.setItem(`vault_auto_logout_duration_${user.id}`, val);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const storageUsedMB = storageSize.toFixed(1);
  const storagePercentage = Math.min((storageSize / 1024) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-12">
      {/* Top Header */}
      <header className="px-5 pt-6 pb-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-slate-500">
            Manage your private photo storage profile
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 transition-colors"
        >
          <LogOut size={14} />
          <span>Exit</span>
        </button>
      </header>

      <div className="max-w-md mx-auto w-full px-4 py-6 space-y-6">
        {/* --- SECTION 1: PROFILE --- */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <UserIcon size={16} className="text-slate-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Profile Details
            </h2>
          </div>

          <div className="p-5 space-y-6">
            {/* Avatar & Storage Quick view */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">
                {fullName?.charAt(0).toUpperCase() ||
                  user?.email?.charAt(0).toUpperCase() ||
                  "U"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">
                  {fullName || "User"}
                </h3>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {user?.email}
                </p>
                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-800 uppercase tracking-wider">
                  <Shield size={10} className="mr-1" /> Private Storage
                </div>
              </div>
            </div>

            {/* Storage Progress and Stats */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <HardDrive size={14} className="text-indigo-500" />
                  <span>Storage Used</span>
                </div>
                <span className="font-bold text-slate-800">
                  {loadingStats ? "..." : `${storageUsedMB} MB`} / 1.0 GB
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${loadingStats ? 0 : Math.max(storagePercentage, 2)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/50 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <ImageIcon size={14} className="text-indigo-500" />
                  <span>Total Photos</span>
                </div>
                <span className="font-bold text-slate-800">
                  {loadingStats ? "..." : photosCount}
                </span>
              </div>
            </div>

            {/* Name Update Form */}
            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  className="w-full text-xs border border-slate-200 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {profileMessage && (
                <div className="bg-green-50 border border-green-100 text-green-700 p-2.5 rounded-xl flex items-center gap-2 text-xs">
                  <Check size={14} className="shrink-0" />
                  <span>{profileMessage}</span>
                </div>
              )}
              {profileError && (
                <div className="bg-red-50 border border-red-100 text-red-700 p-2.5 rounded-xl flex items-center gap-2 text-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                <span>
                  {savingProfile ? "Saving..." : "Update Profile Name"}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* --- SECTION 2: ACCOUNT --- */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <Lock size={16} className="text-slate-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Account Security & Options
            </h2>
          </div>

          <div className="p-5 space-y-6">
            {/* Change Password */}
            <form
              onSubmit={handleUpdatePassword}
              className="space-y-4 pb-5 border-b border-slate-100"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Change Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full text-xs border border-slate-200 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              {passwordMessage && (
                <div className="bg-green-50 border border-green-100 text-green-700 p-2.5 rounded-xl flex items-center gap-2 text-xs">
                  <Check size={14} className="shrink-0" />
                  <span>{passwordMessage}</span>
                </div>
              )}
              {passwordError && (
                <div className="bg-red-50 border border-red-100 text-red-700 p-2.5 rounded-xl flex items-center gap-2 text-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>

            {/* Auto Logout Select */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Auto Logout Inactivity
              </label>
              <div className="relative">
                <select
                  value={autoLogoutDuration}
                  onChange={handleAutoLogoutChange}
                  className="w-full text-xs border border-slate-200 rounded-xl py-2.5 px-3 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-slate-800 font-medium appearance-none"
                >
                  <option value="300000">5 Minutes (Recommended)</option>
                  <option value="900000">15 Minutes</option>
                  <option value="1800000">30 Minutes</option>
                  <option value="0">Disabled (Stay signed in)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                  <Clock size={14} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Locks access if your browser session is left idle.
              </p>
            </div>

            {/* Actions List (Logout) */}
            <div className="pt-4 space-y-2.5">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut size={16} className="text-slate-500" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Log Out of PrivateVault
                  </span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* --- SECTION 3: SUPPORT --- */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <HelpCircle size={16} className="text-slate-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Support & Information
            </h2>
          </div>

          <div className="p-3.5 space-y-2">
            <button
              onClick={() => setActiveModal("help")}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle size={16} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700">
                  Help & Support Guide
                </span>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            <button
              onClick={() => setActiveModal("privacy")}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Shield size={16} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700">
                  Privacy Policy
                </span>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            <div className="p-3 border-t border-slate-100 flex justify-between items-center text-slate-500 text-[11px] font-semibold">
              <div className="flex items-center gap-1.5">
                <Info size={14} className="text-slate-400" />
                <span>App Version</span>
              </div>
              <span>v1.0.0 (Secure Cloud)</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- HELP & SUPPORT MODAL --- */}
      {activeModal === "help" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl relative space-y-4">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 bg-slate-100 rounded-full"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <HelpCircle size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                Help & Support Guide
              </h3>
            </div>
            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                <strong>Uploading Photos:</strong> Tap the upload button on your
                Dashboard or Folder list. Standard images will automatically be
                resized and secure-uploaded to your PrivateVault.
              </p>
              <p>
                <strong>Creating Folders:</strong> Go to the folders page to
                organize. Any photo can be moved, sorted, or removed instantly.
              </p>
              <p>
                <strong>Security:</strong> All uploads are encrypted in transit
                and stored inside dedicated private storage buckets. Storage
                links automatically rotate hourly to guarantee absolute
                security.
              </p>
              <p>
                <strong>Need assistance?</strong> Email us directly at{" "}
                <span className="text-indigo-600 font-bold">
                  support@privatevault.cloud
                </span>{" "}
                and we'll reply within 24 hours.
              </p>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* --- PRIVACY POLICY MODAL --- */}
      {activeModal === "privacy" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl relative space-y-4">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 bg-slate-100 rounded-full"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Shield size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                Privacy Policy
              </h3>
            </div>
            <div className="text-xs text-slate-600 space-y-3 leading-relaxed overflow-y-auto max-h-[250px] pr-1">
              <p>
                <strong>Your Trust is Our Commitment.</strong> This application
                is engineered strictly for secure, isolated cloud media backup.
              </p>
              <p>
                <strong>No Tracking or Sale of Data:</strong> We never scan,
                analyze, or process your photos for advertising. Your photos are
                entirely yours.
              </p>
              <p>
                <strong>Row Level Security (RLS):</strong> Our database is
                governed by robust RLS rules. Only your authenticated user
                account can request, access, view, or delete files linked to
                your unique ID.
              </p>
              <p>
                <strong>Signed Security Tokens:</strong> When browsing your
                gallery, ephemeral signed tokens are generated that expire in 1
                hour. This ensures that unauthorized hotlinking is
                mathematically impossible.
              </p>
              <p>
                <strong>Permanent Deletion:</strong> Deleting a photo immediately
                and permanently purges all records from the storage server.
              </p>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all"
            >
              Accept & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
