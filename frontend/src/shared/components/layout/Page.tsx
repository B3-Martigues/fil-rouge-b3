import type { HTMLAttributes, ReactNode } from "react";

type PageProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: string;
  title: string;
};

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Page({ children, className, ...props }: PageProps) {
  const pageClassName = ["page", className].filter(Boolean).join(" ");

  return (
    <div {...props} className={pageClassName}>
      {children}
    </div>
  );
}

export function PageHeader({
  actions,
  className,
  description,
  title,
  ...props
}: PageHeaderProps) {
  const headerClassName = ["page-header", className].filter(Boolean).join(" ");

  return (
    <section {...props} className={headerClassName}>
      <div className="page-header__content">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </section>
  );
}

export function Section({ children, className, ...props }: SectionProps) {
  const sectionClassName = ["section", className].filter(Boolean).join(" ");

  return (
    <section {...props} className={sectionClassName}>
      {children}
    </section>
  );
}
