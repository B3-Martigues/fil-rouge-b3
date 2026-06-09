/**Affiche un message de succès */

type Props = {
  message: string;
};

export default function SuccessMessage({ message }: Props) {
  return (
    <p className="feedback-message feedback-message--success" role="status">
      {message}
    </p>
  );
}
