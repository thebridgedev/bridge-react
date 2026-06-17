import { SignupForm } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function SdkSignupPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <SignupForm
        onSignup={() => navigate('/auth/login')}
        onError={(err) => console.error('[Signup]', err)}
      />
    </div>
  );
}

export default SdkSignupPage;
