import { MagicLink } from '@nebulr-group/bridge-react';

function SdkMagicLinkPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <MagicLink onError={(err) => console.error('[MagicLink]', err)} />
    </div>
  );
}

export default SdkMagicLinkPage;
