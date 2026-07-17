// Registers happy-dom globals (window, document, etc.) so React Testing Library
// can render components under `bun test`. Wired via `bunfig.toml` preload.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
