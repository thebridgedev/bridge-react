import { PasskeySetup } from '@nebulr-group/bridge-react';
import { useParams } from 'react-router-dom';

function SdkSetupPasskeyPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <PasskeySetup
        token={token ?? ''}
        onError={(err) => console.error('[PasskeySetup]', err)}
      />
    </div>
  );
}

export default SdkSetupPasskeyPage;
