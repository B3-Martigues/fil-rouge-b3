/**Affiche un message d'erreur accessible */
type Props = {
  message: string;
};

export default function ErrorMessage({ message }: Props) {
  return (
    <p className="feedback-message feedback-message--error" role="alert">
      {message}
    </p>
  );
}
