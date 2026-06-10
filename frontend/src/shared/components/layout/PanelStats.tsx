import { NavLink } from "react-router-dom";

export type PanelStat = {
  label: string;
  to: string;
  value?: number;
  detail?: string;
  end?: boolean;
};

type PanelStatsProps = {
  ariaLabel: string;
  stats: PanelStat[];
};

export default function PanelStats({ ariaLabel, stats }: PanelStatsProps) {
  return (
    <nav className="panel-stats" aria-label={ariaLabel}>
      {stats.map((stat) => (
        <NavLink
          className={({ isActive }) =>
            `panel-stat${isActive ? " is-active" : ""}`
          }
          end={stat.end}
          key={stat.to}
          to={stat.to}
        >
          {typeof stat.value === "number" && (
            <span className="panel-stat__value">{stat.value}</span>
          )}
          <span className="panel-stat__label">{stat.label}</span>
          {stat.detail && (
            <span className="panel-stat__detail">{stat.detail}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
