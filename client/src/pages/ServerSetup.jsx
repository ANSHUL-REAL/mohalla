import { useState } from 'react';
import { Wifi } from 'lucide-react';
import { getServerUrl, normaliseServerUrl, pingServer, saveServerUrl } from '../api';
import { Logo } from '../components/Layout';

// Android app only: the app's pages live inside the APK, but the data comes from the
// laptop running the server. This screen sets which address to use.
export default function ServerSetup({ firstRun = false, onConnected }) {
  const [address, setAddress] = useState(getServerUrl().replace(/^http:\/\//, ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const url = normaliseServerUrl(address);
    if (!url) return setError('Type the address shown on the laptop, e.g. 192.168.1.7');
    setBusy(true);
    setError('');
    if (await pingServer(url)) {
      saveServerUrl(url);
      if (onConnected) onConnected();
      // Reload so every screen picks up the new address
      window.location.replace('/');
    } else {
      setError(`No Mohalla server answered at ${url}. Check the laptop is running "npm start" and both are on the same Wi-Fi.`);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1><Wifi size={26} style={{ verticalAlign: '-3px' }} /> Connect to server</h1>
        <p className="muted">
          {firstRun
            ? "Can't reach the Mohalla server. Enter the laptop's address to connect."
            : 'The app gets its listings from the laptop running the Mohalla server.'}
        </p>
        {error && <div className="alert">{error}</div>}
        <label>
          Server address
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="192.168.1.7:5000"
            inputMode="url" autoCapitalize="off" autoCorrect="off" required />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Connecting…' : 'Connect'}</button>
        <p className="muted small">
          The address is printed in the laptop's terminal when the server starts ("On your phone: http://…").
          Phone and laptop must be on the same Wi-Fi or hotspot.
        </p>
      </form>
    </div>
  );
}
