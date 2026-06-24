import EventHome from "../components/EventHome";

type HomeProps = {
  isInitialDataReady?: boolean;
};

export default function Home({ isInitialDataReady = true }: HomeProps) {
  return <EventHome isInitialDataReady={isInitialDataReady} />;
}
