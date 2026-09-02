export function WelcomeSection({ name }: { name: string }) {
  return (
    <div>
      <h1 className="text-2xl">مرحباً، {name} 👋</h1>
      <p className="mt-1 text-text-secondary-light">تابع تقدّمك وواصل التعلم من حيث توقفت.</p>
    </div>
  );
}
