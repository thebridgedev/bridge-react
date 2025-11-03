import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>The page you are looking for does not exist. Choose another destination from the navigation bar.</p>
      <Link className="primary-button" to="/">
        Back to home
      </Link>
    </div>
  );
}

export default NotFoundPage;

