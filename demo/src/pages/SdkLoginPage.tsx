import { LoginForm } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function SdkLoginPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <LoginForm
        heading="Sign in"
        onLogin={() => navigate('/')}
        onError={(err) => console.error('[Login]', err)}
      />
    </div>
  );
}

export default SdkLoginPage;
