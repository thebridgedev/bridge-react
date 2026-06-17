import { ForgotPassword } from '@nebulr-group/bridge-react';

function SdkForgotPasswordPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <ForgotPassword onError={(err) => console.error('[ForgotPassword]', err)} />
    </div>
  );
}

export default SdkForgotPasswordPage;
