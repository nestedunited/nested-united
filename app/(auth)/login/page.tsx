"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        return;
      }

      if (data.user) {
        // Check if user is active
        const {
          data: userData,
          error: userError,
        } = await supabase
          .from("users")
          .select("is_active")
          .eq("id", data.user.id)
          .maybeSingle();

        // If there's no users-row yet (bootstrap) or query error, don't treat as disabled.
        // The DB trigger/backfill migration should create it automatically.
        if (userData && userData.is_active === false) {
          await supabase.auth.signOut();
          setError("حسابك معطل. يرجى التواصل مع المسؤول");
          return;
        }

        // Refresh session immediately to ensure it persists forever
        await supabase.auth.refreshSession();

        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border-2 border-gray-200 shadow-md flex items-center justify-center">
                {logoError ? (
                  <div className="bg-blue-600 text-white w-full h-full flex items-center justify-center font-bold text-lg">
                    شعار
                  </div>
                ) : (
                  <img
                    src="/logo.png"
                    alt="شعار المنصة"
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-blue-600">
                لوحة التحكم
              </h1>
              <p className="text-gray-600">
                نظام إدارة الوحدات والحجوزات
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>

          <div className="text-center">
            <a
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700 transition"
            >
              نسيت كلمة المرور؟
            </a>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          نظام داخلي - لا يوجد تسجيل عام
        </p>
      </div>
    </div>
  );
}

