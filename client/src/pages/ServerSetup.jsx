import { useState } from 'react';
import { Wifi } from 'lucide-react';
import { DEFAULT_SERVER, getServerUrl, normaliseServerUrl, pingServer, saveServerUrl } from '../api';
import { Logo } from '../components/Layout';

// Android app only: the app's pages live inside the APK, but the data comes from the
// online server (or a laptop running the server). This screen sets which address to use.
export default function ServerSetup({ firstRun = false, onConnected }) {
  const [address, setAddress] = useState(getServerUrl().replace(/^http:\/\//, ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async (url) => {
    setBusy(true);
    setError('');
    if (await pingServer(url, url === DEFAULT_SERVER ? 75000 : 5000)) {
      saveServerUrl(url);
      if (onConnected) onConnected();
      // Reload so every screen picks up the new address
      window.location.replace('/');
    } else {
      setError(url === DEFAULT_SERVER
        ? 'The online server did not answer. Check your internet connection and try again.'
        : `No Mohalla server answered at ${url}. Check the laptop is running "npm start" and both are on the same Wi-Fi.`);
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const url = normaliseServerUrl(address);
    if (!url) return setError('Type the address shown on the laptop, e.g. 192.168.1.7');
    connect(url);
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1><Wifi size={26} style={{ verticalAlign: '-3px' }} /> Connect to server</h1>
        <p className="muted">
          {firstRun
            ? "Can't reach the Mohalla server. Try the online server again, or enter a laptop's address."
            : 'The app gets its listings from the online Mohalla server, or from a laptop running it.'}
        </p>
        {error && <div className="alert">{error}</div>}
        <label>
          Server address
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="192.168.1.7:5000"
            inputMode="url" autoCapitalize="off" autoCorrect="off" required />
        </label>
        {DEFAULT_SERVER && (
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => connect(DEFAULT_SERVER)}>
            {busy ? 'Connecting…' : 'Use online server'}
          </button>
        )}
        <button className="btn btn-block" disabled={busy}>{busy ? 'Connecting…' : 'Connect to this address'}</button>
        <p className="muted small">
          For a laptop: the address is printed in its terminal when the server starts ("On your phone: http://…").
          Phone and laptop must be on the same Wi-Fi or hotspot.
        </p>
      </form>
    </div>
  );
}
