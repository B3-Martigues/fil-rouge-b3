import OrganizationSetupFlow from "../components/OrganizationSetupFlow";

type Props = {
  mode?: "become" | "create";
};

export default function OrganizationSetup({ mode }: Props) {
  return <OrganizationSetupFlow mode={mode} />;
}
