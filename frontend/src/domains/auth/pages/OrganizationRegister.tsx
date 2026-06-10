import { Navigate } from "react-router-dom";

import { ROUTES } from "../../../shared/constants/routes";

export default function OrganizationRegister() {
  return <Navigate to={ROUTES.PUBLIC.REGISTER} replace />;
}
