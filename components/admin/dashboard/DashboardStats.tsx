import { Users, UserCheck, BookOpen, Wallet, ClipboardCheck, Star } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { getDashboardStats } from "@/lib/data/admin-dashboard";

const currency = new Intl.NumberFormat("en-US");

export async function DashboardStats() {
  const stats = await getDashboardStats();

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard icon={Users} value={currency.format(stats.totalStudents)} label="إجمالي الطلاب" tone="violet" />
      <StatCard icon={UserCheck} value={currency.format(stats.activeStudents)} label="طلاب نشطون" tone="success" />
      <StatCard icon={BookOpen} value={currency.format(stats.totalCourses)} label="الدورات" tone="violet" />
      <StatCard icon={Wallet} value={`${currency.format(stats.revenue)} دج`} label="الإيرادات" tone="gold" />
      <StatCard icon={ClipboardCheck} value={currency.format(stats.totalEnrollments)} label="التسجيلات" tone="teal" />
      <StatCard icon={Star} value={stats.avgRating.toFixed(1)} label="متوسط التقييم" tone="gold" />
    </div>
  );
}
