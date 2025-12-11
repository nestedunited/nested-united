"use client";

import { useState } from "react";
import { Globe, Code, Heart, ExternalLink, Mail, Linkedin, Facebook } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  const [logoError, setLogoError] = useState(false);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white border-2 border-gray-200 shadow-lg flex items-center justify-center">
              {logoError ? (
                <div className="bg-blue-600 text-white w-full h-full flex items-center justify-center font-bold text-2xl">
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            حول التطبيق
          </h1>
          <p className="text-xl text-gray-600">
            نظام إدارة الوحدات السكنية والحجوزات
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            {/* Developer Info */}
            <div className="flex-1 text-center md:text-right">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                المطور
              </h2>
              <h3 className="text-2xl font-semibold text-blue-600 mb-2">
                محمد أمير السمحي
              </h3>
              <p className="text-gray-600 mb-4">
                AI Expert in Climate Change | Executive Director | Data Scientist
              </p>
              <p className="text-gray-700 leading-relaxed mb-6">
                مطور متخصص في بناء حلول برمجية مبتكرة باستخدام أحدث التقنيات.
                أعمل على تصميم وتطوير أنظمة إدارة متكاملة تساعد الشركات والمؤسسات
                على تحسين عملياتها وزيادة كفاءتها.
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>التخصصات:</strong> AI في التغير المناخي | تطوير البرمجيات | تحليل البيانات
                </p>
              </div>
              
              {/* Social Links */}
              <div className="flex items-center justify-center md:justify-end gap-4 mb-6">
                <a
                  href="https://samahy.tech/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  <span>الموقع الشخصي</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex items-center justify-center md:justify-end gap-2">
                  <Mail className="w-4 h-4" />
                  <span>متاح للتعاون والمشاريع</span>
                </p>
              </div>
            </div>

            {/* Icon */}
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
              <Code className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Code className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">التقنيات المستخدمة</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li>• Next.js 16 (App Router)</li>
              <li>• TypeScript</li>
              <li>• Tailwind CSS v4</li>
              <li>• Supabase (PostgreSQL)</li>
              <li>• Electron (Desktop App)</li>
              <li>• Realtime Notifications</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">المميزات</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li>• إدارة الوحدات والحجوزات</li>
              <li>• مزامنة iCal تلقائية</li>
              <li>• إشعارات فورية</li>
              <li>• تطبيق سطح مكتب</li>
              <li>• إدارة الصيانة</li>
              <li>• تقارير وإحصائيات</li>
            </ul>
          </div>
        </div>

        {/* Developer Portfolio */}
        <div className="bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">المطور والمصمم</h3>
          <p className="text-blue-100 mb-6 leading-relaxed">
            تم تطوير هذا النظام بواسطة <strong>محمد أمير السمحي</strong>، مطور متخصص
            في بناء حلول برمجية متقدمة باستخدام أحدث التقنيات. للمزيد من المعلومات
            عن المشاريع والخبرات، يمكنك زيارة الموقع الشخصي.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://samahy.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
            >
              <Globe className="w-5 h-5" />
              <span>زيارة الموقع الشخصي</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center mt-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <span>العودة للوحة التحكم</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

