import { useAppStore } from '../context/AppStore';
import { useAuth } from '../context/AuthContext';
import { PetCard } from '../components/PetCard';
import { PawPath } from '../components/PawPath';
import './Profile.css';

export function Profile() {
  const { pets, currentUser, darkMode, setDarkMode } = useAppStore();
  const { signOut, mockMode } = useAuth();

  const myPets = pets.filter(p => p.reportedById === currentUser.id);

  const totalReunited = currentUser.reunitedCount;
  const totalReports = myPets.length;
  const totalSightings = pets.reduce(
    (acc, p) => acc + p.sightings.filter(s => s.reportedBy === currentUser.name).length,
    0
  );

  return (
    <div className="profile screen-content">
      <header className="profile-header">
        <h1 className="t-headline">Profile</h1>
      </header>

      <div className="profile-body">
        {/* Avatar & name */}
        <div className="profile-hero">
          <div className="profile-avatar">
            {currentUser.avatarUrl
              ? <img src={currentUser.avatarUrl} alt={currentUser.name} />
              : <span className="t-headline" style={{ color: 'var(--sprout-700)' }}>{currentUser.name[0]}</span>
            }
          </div>
          <div>
            <h2 className="t-title">{currentUser.name}</h2>
            <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>
              {mockMode ? 'Demo mode — connect Supabase to go live' : 'PawTrace community member'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-number t-headline" style={{ color: 'var(--coral-500)' }}>{totalReports}</span>
            <span className="stat-label t-body-s">Reports</span>
          </div>
          <div className="stat-card">
            <span className="stat-number t-headline" style={{ color: 'var(--sprout-500)' }}>{totalSightings}</span>
            <span className="stat-label t-body-s">Sightings</span>
          </div>
          <div className="stat-card stat-reunited">
            <span className="stat-number t-headline" style={{ color: 'var(--lagoon-500)' }}>
              {totalReunited} 🎉
            </span>
            <span className="stat-label t-body-s">Reunited</span>
          </div>
        </div>

        {/* Reunited celebration */}
        {totalReunited > 0 && (
          <div className="reunited-celebration">
            <div className="celebration-icon">🎉</div>
            <div>
              <p className="t-title" style={{ color: 'var(--lagoon-700)' }}>
                You've helped {totalReunited} pet{totalReunited !== 1 ? 's' : ''} get home!
              </p>
              <p className="t-body-s" style={{ color: 'var(--lagoon-700)', opacity: 0.8 }}>
                Your community makes a real difference. Thank you.
              </p>
            </div>
          </div>
        )}

        <PawPath count={5} />

        {/* My pets */}
        {myPets.length > 0 && (
          <section aria-labelledby="my-pets-label">
            <h2 className="t-title section-label" id="my-pets-label">My reports</h2>
            <div className="profile-list">
              {myPets.map(pet => (
                <PetCard key={pet.id} pet={pet} variant="horizontal" />
              ))}
            </div>
          </section>
        )}

        {myPets.length === 0 && (
          <div className="profile-empty">
            <svg viewBox="0 0 24 24" fill="var(--sprout-200)" width="48" height="48">
              <ellipse cx="12" cy="16" rx="6" ry="5"/>
              <circle cx="5" cy="9" r="2.4"/>
              <circle cx="19" cy="9" r="2.4"/>
              <circle cx="9" cy="5" r="2.2"/>
              <circle cx="15" cy="5" r="2.2"/>
            </svg>
            <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>You haven't made any reports yet.</p>
          </div>
        )}

        <PawPath count={5} />

        {/* Settings */}
        <section aria-labelledby="settings-label">
          <h2 className="t-title section-label" id="settings-label">Settings</h2>
          <div className="settings-list">
            <div className="setting-row">
              <div>
                <p className="t-body-l" style={{ fontWeight: 700 }}>Dark mode</p>
                <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Warm dark theme, easier on the eyes</p>
              </div>
              <button
                className={`toggle ${darkMode ? 'toggle-on' : ''}`}
                onClick={() => setDarkMode(!darkMode)}
                role="switch"
                aria-checked={darkMode}
                aria-label="Toggle dark mode"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <p className="t-body-l" style={{ fontWeight: 700 }}>Nearby alerts</p>
                <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Get notified about pets in your area</p>
              </div>
              <button
                className="toggle toggle-on"
                role="switch"
                aria-checked={true}
                aria-label="Toggle nearby alerts"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <p className="t-body-l" style={{ fontWeight: 700 }}>Share location</p>
                <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Help with distance calculations</p>
              </div>
              <button
                className="toggle"
                role="switch"
                aria-checked={false}
                aria-label="Toggle location sharing"
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <div className="about-box">
          <svg viewBox="0 0 24 24" fill="var(--sprout-500)" width="28" height="28">
            <ellipse cx="12" cy="16" rx="6" ry="5"/>
            <circle cx="5" cy="9" r="2.4"/>
            <circle cx="19" cy="9" r="2.4"/>
            <circle cx="9" cy="5" r="2.2"/>
            <circle cx="15" cy="5" r="2.2"/>
          </svg>
          <div>
            <p className="t-title" style={{ fontFamily: 'Fredoka', color: 'var(--sprout-700)' }}>PawTrace</p>
            <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Helping pets find their way home. v1.0</p>
          </div>
        </div>

        {!mockMode && (
          <button className="signout-btn" onClick={signOut}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
