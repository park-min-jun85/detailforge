import { AppIcon, type AppIconName } from "./app-icon";

export function EmptyState({ icon, title, description, headingLevel = 2 }: {
  icon: AppIconName;
  title: string;
  description?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500">
        <AppIcon name={icon} className="size-6" />
      </div>
      <Heading className="text-base font-semibold leading-7">{title}</Heading>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>}
    </div>
  );
}