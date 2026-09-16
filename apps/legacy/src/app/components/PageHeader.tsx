import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type PageHeaderProps = {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  trailing?: ReactNode;
  className?: string;
};

export function PageHeader({ title, breadcrumbs, trailing, className = "" }: PageHeaderProps) {
  if (breadcrumbs?.length) {
    return (
      <div className={`mb-4 flex items-center justify-between gap-4 ${className}`}>
        <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-2 text-[14px] font-normal">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const itemClass = isLast
              ? "font-medium text-[#0A1B39]"
              : "text-[#86909C] transition-colors hover:text-[#3388ff]";

            return (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 && <span className="text-[#c0c4cc]">/</span>}
                {item.to && !isLast ? (
                  <Link to={item.to} className={itemClass}>
                    {item.label}
                  </Link>
                ) : (
                  <span className={itemClass}>{item.label}</span>
                )}
              </Fragment>
            );
          })}
        </nav>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    );
  }

  return (
    <div className={`mb-4 flex items-center justify-between gap-4 ${className}`}>
      <h1 className="text-[16px] font-medium text-[#0A1B39]">{title}</h1>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
