interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="error-message" role="status">
      <p>{message}</p>
    </div>
  );
}
