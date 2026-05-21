import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1E3A5F] mb-4">
      <div className="min-w-0">
        <h1 className="text-[17px] font-semibold tracking-tight text-[#F0F4F8]">{title}</h1>
        {description && (
          <p className="text-[13px] text-[#8BA3BF] mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-[1400px] mx-auto w-full">
      {children}
    </div>
  );
}
