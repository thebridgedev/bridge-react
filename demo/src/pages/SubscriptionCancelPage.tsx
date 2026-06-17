import { Link } from 'react-router-dom';

function SubscriptionCancelPage() {
  return (
    <div className="page-section">
      <h1 className="page-heading">Checkout cancelled</h1>
      <p className="page-subheading">No charges were made.</p>
      <Link to="/subscription" className="nav-link">
        Try again
      </Link>
    </div>
  );
}

export default SubscriptionCancelPage;
