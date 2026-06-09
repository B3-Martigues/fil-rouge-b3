import { NavLink } from "react-router-dom";

export type PanelStat = {
  label: string;
  to: string;
  value?: number;
  end?: boolean;
};

type PanelStatsProps = {
  ariaLabel: string;
  stats: PanelStat[];
};

export default function PanelStats({ ariaLabel, stats }: PanelStatsProps) {
  return (
    <nav className="admin-panel__stats" aria-label={ariaLabel}>
      {stats.map((stat) => (
        <NavLink
          className={({ isActive }) =>
            `admin-stat${isActive ? " is-active" : ""}`
          }
          end={stat.end}
          key={stat.to}
          to={stat.to}
        >
          {typeof stat.value === "number" && (
            <span className="admin-stat__value">{stat.value}</span>
          )}
          <span className="admin-stat__label">{stat.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
