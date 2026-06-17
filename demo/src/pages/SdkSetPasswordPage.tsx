import { ForgotPassword } from '@nebulr-group/bridge-react';
import { useParams } from 'react-router-dom';

function SdkSetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <ForgotPassword
        token={token}
        onError={(err) => console.error('[SetPassword]', err)}
      />
    </div>
  );
}

export default SdkSetPasswordPage;
