import {
  createPath,
  Link,
  NavLink,
  useLocation,
  useResolvedPath,
  type LinkProps,
  type Location,
  type NavLinkProps,
  type To,
} from "react-router-dom";

type FormModalLocationState = {
  backgroundLocation?: Location;
  formModal?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function useFormModalState(to: To, state: unknown) {
  const location = useLocation();
  const resolvedPath = useResolvedPath(to);
  const locationState = isRecord(location.state)
    ? (location.state as FormModalLocationState)
    : null;
  const targetPath = createPath(resolvedPath);
  const currentPath = createPath(location);

  if (targetPath === currentPath) {
    return state;
  }

  return {
    ...(isRecord(state) ? state : {}),
    backgroundLocation: locationState?.backgroundLocation ?? location,
    formModal: true,
  };
}

export function FormModalLink({ state, to, ...props }: LinkProps) {
  const modalState = useFormModalState(to, state);

  return <Link {...props} state={modalState} to={to} />;
}

export function FormModalNavLink({ state, to, ...props }: NavLinkProps) {
  const modalState = useFormModalState(to, state);

  return <NavLink {...props} state={modalState} to={to} />;
}
