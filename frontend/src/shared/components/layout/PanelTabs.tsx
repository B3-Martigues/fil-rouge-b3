import { NavLink } from "react-router-dom";

type PanelTab = {
  label: string;
  to: string;
  count?: number;
  end?: boolean;
};

type PanelTabsProps = {
  ariaLabel: string;
  tabs: PanelTab[];
};

export default function PanelTabs({ ariaLabel, tabs }: PanelTabsProps) {
  return (
    <nav className="panel-tabs" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <NavLink
          className={({ isActive }) =>
            `panel-tab${isActive ? " is-active" : ""}`
          }
          end={tab.end}
          key={tab.to}
          to={tab.to}
        >
          {tab.label}
          {typeof tab.count === "number" && (
            <span aria-label={`${tab.count} elements`}>{tab.count}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
