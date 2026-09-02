import { Card } from "@/components/ui/Card";
import { AreaLineChart } from "@/components/admin/charts/AreaLineChart";
import { BarChart } from "@/components/admin/charts/BarChart";
import { HorizontalBarList } from "@/components/admin/charts/HorizontalBarList";
import {
  getStudentGrowthChart,
  getRevenueChart,
  getCourseSalesChart,
  getWatchTimeChart,
} from "@/lib/data/admin-dashboard";

const currency = new Intl.NumberFormat("en-US");

export async function StudentGrowthChartCard() {
  const data = await getStudentGrowthChart();
  return (
    <Card>
      <h3 className="text-[15px]">نمو الطلاب</h3>
      <p className="text-[12.5px] text-text-muted-light">تسجيلات جديدة — آخر 8 أسابيع</p>
      <div className="mt-5">
        <AreaLineChart points={data} />
      </div>
    </Card>
  );
}

export async function RevenueChartCard() {
  const data = await getRevenueChart();
  return (
    <Card>
      <h3 className="text-[15px]">الإيرادات</h3>
      <p className="text-[12.5px] text-text-muted-light">المبالغ المحصّلة — آخر 8 أسابيع</p>
      <div className="mt-5">
        <BarChart bars={data} valueFormatter={(v) => currency.format(v)} />
      </div>
    </Card>
  );
}

export async function CourseSalesChartCard() {
  const data = await getCourseSalesChart();
  return (
    <Card>
      <h3 className="text-[15px]">مبيعات الدورات</h3>
      <p className="text-[12.5px] text-text-muted-light">الأكثر تسجيلاً — أعلى 5 دورات</p>
      <div className="mt-5">
        <HorizontalBarList items={data} />
      </div>
    </Card>
  );
}

export async function WatchTimeChartCard() {
  const data = await getWatchTimeChart();
  return (
    <Card>
      <h3 className="text-[15px]">وقت المشاهدة</h3>
      <p className="text-[12.5px] text-text-muted-light">ساعات المشاهدة التقديرية — آخر 8 أسابيع</p>
      <div className="mt-5">
        <AreaLineChart points={data} />
      </div>
    </Card>
  );
}
