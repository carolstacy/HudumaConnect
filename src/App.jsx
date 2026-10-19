
import { useState, useEffect } from 'react'
import './App.css'
import { db } from './firebase'

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  reload,
  signOut
} from 'firebase/auth'

const auth = getAuth()

// Authorized administrator Firebase Authentication UIDs.
const ADMIN_UIDS = [
  'WD1k9W3pzEMzm8qrOPdt1aR5KD12',
  'xwAgmHAcsLaPV2bAkVVbXRFM8s22'
]

const services = [
  {
    name: 'Roads and Transport',
    number: '01',
    description: 'Report damaged roads, potholes and transport concerns.'
  },
  {
    name: 'Water and Sanitation',
    number: '02',
    description: 'Report water supply problems and sanitation issues.'
  },
  {
    name: 'Waste Management',
    number: '03',
    description: 'Report missed garbage collection and waste concerns.'
  },
  {
    name: 'Street Lighting',
    number: '04',
    description: 'Report faulty streetlights and lighting problems.'
  },
  {
    name: 'Public Facilities',
    number: '05',
    description: 'Report maintenance issues affecting public facilities.'
  },
  {
    name: 'Other Services',
    number: '06',
    description: 'Submit another public-service request.'
  }
]

const statuses = ['Pending', 'In Progress', 'Resolved']

const EMPTY_FORM = {
  name: '',
  phone: '',
  category: '',
  location: '',
  mapLocation: '',
  description: ''
}

function getErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'The email address or password is incorrect.',
    'auth/user-not-found': 'No account was found with those credentials.',
    'auth/wrong-password': 'The email address or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/api-key-not-valid': 'Your Firebase API key is invalid. Check src/firebase.js.',
    'auth/invalid-api-key': 'Your Firebase API key is invalid. Check src/firebase.js.',
    'auth/unauthorized-continue-uri': 'Check your Firebase email action URL configuration.',
    'permission-denied': 'Firebase denied this action. Check your Firestore security rules.',
    unavailable: 'Firebase is temporarily unavailable. Check your connection.'
  }

  return messages[error?.code] || error?.message || 'Something went wrong.'
}

function parseCoordinates(value) {
  const match = String(value || '').trim().match(
    /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/
  )

  if (!match) return null

  const latitude = Number(match[1])
  const longitude = Number(match[2])

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }

  return { latitude, longitude }
}

function isValidMapLocation(value) {
  const input = String(value || '').trim()

  if (!input) return false
  if (parseCoordinates(input)) return true

  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()

    const allowedHost =
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'maps.app.goo.gl' ||
      host === 'goo.gl'

    if (url.protocol !== 'https:' || !allowedHost) return false

    return (
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && url.pathname.startsWith('/maps')) ||
      url.pathname.startsWith('/maps') ||
      host === 'maps.google.com'
    )
  } catch {
    return false
  }
}

function getMapsUrl(value) {
  const input = String(value || '').trim()

  if (!input) return ''

  const coordinates = parseCoordinates(input)

  if (coordinates) {
    return `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`
  }

  if (isValidMapLocation(input)) {
    return input
  }

  return ''
}

function isValidPhone(value) {
  const phone = String(value || '').trim()
  const digits = phone.replace(/\D/g, '')

  return (
    /^\+?[0-9\s()-]+$/.test(phone) &&
    digits.length >= 7 &&
    digits.length <= 15
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationLoading, setVerificationLoading] = useState(false)

  const [requests, setRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [databaseError, setDatabaseError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showAdmin, setShowAdmin] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const [form, setForm] = useState(EMPTY_FORM)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')

  const [trackingId, setTrackingId] = useState('')
  const [trackedRequest, setTrackedRequest] = useState(null)
  const [trackingMessage, setTrackingMessage] = useState('')
  const [lastSubmittedId, setLastSubmittedId] = useState('')

  // Both administrator accounts are recognized here.
  const isAdmin = Boolean(user && ADMIN_UIDS.includes(user.uid))
  const needsEmailVerification = Boolean(user && !user.emailVerified)
  const canUsePortal = Boolean(user && user.emailVerified)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthReady(true)
      setShowAdmin(false)
      setDatabaseError('')
      setRequests([])
      setTrackedRequest(null)
      setShowAuth(false)

      if (!currentUser || currentUser.emailVerified) {
        setVerificationMessage('')
      } else {
        setVerificationMessage(
          'Please verify your email address to continue.'
        )
      }
    })

    return unsubscribe
  }, [])

  // Administrators load all requests; regular users load their own.
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setRequests([])
      setLoadingRequests(false)
      return
    }

    let cancelled = false

    async function loadRequests() {
      setLoadingRequests(true)
      setDatabaseError('')

      try {
        const requestsCollection = collection(db, 'requests')

        const requestsQuery = isAdmin
          ? requestsCollection
          : query(
            requestsCollection,
            where('userId', '==', user.uid)
          )

        const snapshot = await getDocs(requestsQuery)

        if (cancelled) return

        const loadedRequests = snapshot.docs.map((item) => ({
          ...item.data(),
          firestoreId: item.id
        }))

        loadedRequests.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0
          const timeB = b.createdAt?.toMillis?.() || 0
          return timeB - timeA
        })

        setRequests(loadedRequests)
      } catch (error) {
        if (!cancelled) {
          console.error('Could not load requests:', error)
          setDatabaseError(getErrorMessage(error))
        }
      } finally {
        if (!cancelled) setLoadingRequests(false)
      }
    }

    loadRequests()

    return () => {
      cancelled = true
    }
  }, [user, isAdmin, authReady])

  function openAuth(mode = 'login') {
    setAuthMode(mode)
    setAuthMessage('')
    setAuthPassword('')
    setVerificationMessage('')
    setShowAuth(true)
    setShowAdmin(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function returnHome() {
    setShowAuth(false)
    setAuthMessage('')
    setShowAdmin(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleAuthentication(event) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthMessage('')
    setVerificationMessage('')

    try {
      let credential

      if (authMode === 'register') {
        credential = await createUserWithEmailAndPassword(
          auth,
          authEmail.trim(),
          authPassword
        )

        setAuthPassword('')
        setShowAuth(false)
        setShowAdmin(false)

        try {
          await sendEmailVerification(credential.user)

          setVerificationMessage(
            'Your account has been created. A verification email has been sent. Check your inbox and spam folder.'
          )
        } catch (error) {
          setVerificationMessage(
            `Your account was created, but the verification email could not be sent. ${getErrorMessage(error)} Use Resend Verification Email to try again.`
          )
        }

        return
      }

      credential = await signInWithEmailAndPassword(
        auth,
        authEmail.trim(),
        authPassword
      )

      // Check the UID against both authorized administrators.
      if (authMode === 'admin' && !ADMIN_UIDS.includes(credential.user.uid)) {
        await signOut(auth)
        setAuthMessage(
          'This account is not authorized to access the administrator dashboard.'
        )
        return
      }

      await reload(credential.user)

      const refreshedUser = auth.currentUser

      if (!refreshedUser?.emailVerified) {
        setAuthPassword('')
        setShowAuth(false)
        setShowAdmin(false)
        setVerificationMessage(
          'Your email address is not verified. Open the verification link in your email before continuing.'
        )
        return
      }

      setUser(refreshedUser)
      setAuthPassword('')
      setShowAuth(false)
      setAuthMessage('')
      setVerificationMessage('')

      if (authMode === 'admin' && ADMIN_UIDS.includes(refreshedUser.uid)) {
        setShowAdmin(true)
      }
    } catch (error) {
      setAuthMessage(getErrorMessage(error))
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleResendVerification() {
    const currentUser = auth.currentUser

    if (!currentUser) {
      setVerificationMessage('Your session has expired. Sign in again.')
      return
    }

    setVerificationLoading(true)
    setVerificationMessage('')

    try {
      await reload(currentUser)

      if (auth.currentUser?.emailVerified) {
        setUser({ ...auth.currentUser })
        setVerificationMessage('Your email is already verified.')
        return
      }

      await sendEmailVerification(auth.currentUser)

      setVerificationMessage(
        'A new verification email has been sent. Check your inbox and spam folder.'
      )
    } catch (error) {
      setVerificationMessage(getErrorMessage(error))
    } finally {
      setVerificationLoading(false)
    }
  }

  async function handleCheckVerification() {
    const currentUser = auth.currentUser

    if (!currentUser) {
      setVerificationMessage('Your session has expired. Sign in again.')
      return
    }

    setVerificationLoading(true)
    setVerificationMessage('')

    try {
      await reload(currentUser)

      const refreshedUser = auth.currentUser

      if (refreshedUser?.emailVerified) {
        setUser({ ...refreshedUser })
        setVerificationMessage(
          'Email verified successfully. Your portal is now available.'
        )
        setShowAuth(false)

        // Recognize either administrator after email verification.
        setShowAdmin(
          ADMIN_UIDS.includes(refreshedUser.uid)
        )
      } else {
        setVerificationMessage(
          'Your email is not verified yet. Open the verification link, then try again.'
        )
      }
    } catch (error) {
      setVerificationMessage(getErrorMessage(error))
    } finally {
      setVerificationLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth)
      setShowAuth(false)
      setShowAdmin(false)
      setAuthMessage('')
      setVerificationMessage('')
      setRequests([])
      setTrackedRequest(null)
      setTrackingMessage('')
    } catch (error) {
      setDatabaseError(getErrorMessage(error))
    }
  }

  function handleFormChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value
    }))

    if (name === 'mapLocation') {
      setLocationMessage('')
    }
  }

  function handleUseCurrentLocation() {
    setLocationMessage('')

    if (!navigator.geolocation) {
      setLocationMessage(
        'Your browser does not support GPS location sharing. Paste a Google Maps link instead.'
      )
      return
    }

    setLocationLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        const coordinates = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`

        setForm((previous) => ({
          ...previous,
          mapLocation: coordinates
        }))

        setLocationMessage(
          `Location captured: ${coordinates}. You can preview it in Google Maps below.`
        )

        setLocationLoading(false)
      },
      (error) => {
        const messages = {
          1: 'Location permission was denied. Allow location access in your browser settings or paste a Google Maps link.',
          2: 'Your location could not be determined. Try again or paste a Google Maps link.',
          3: 'The location request timed out. Please try again.'
        }

        setLocationMessage(
          messages[error.code] ||
          'Unable to get your location. Please try again.'
        )

        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!user) {
      openAuth('login')
      return
    }

    if (!user.emailVerified) {
      setDatabaseError(
        'Please verify your email address before submitting a request.'
      )
      return
    }

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.category ||
      !form.location.trim() ||
      !form.mapLocation.trim() ||
      !form.description.trim()
    ) {
      setDatabaseError('Please complete all required fields.')
      return
    }

    if (!isValidPhone(form.phone)) {
      setDatabaseError(
        'Enter a valid phone number with 7 to 15 digits. You may include your country code.'
      )
      return
    }

    if (!isValidMapLocation(form.mapLocation)) {
      setDatabaseError(
        'Enter a valid Google Maps link or GPS coordinates, such as -1.286389, 36.817223.'
      )
      return
    }

    setSubmitting(true)
    setDatabaseError('')
    setLastSubmittedId('')

    try {
      const referenceId =
        'HC-' + Date.now().toString(36).toUpperCase()

      const newRequest = {
        referenceId,
        userId: user.uid,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: user.email || '',
        category: form.category,
        location: form.location.trim(),
        mapLocation: form.mapLocation.trim(),
        mapUrl: getMapsUrl(form.mapLocation),
        description: form.description.trim(),
        status: 'Pending',
        date: new Date().toLocaleDateString(),
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, 'requests'), newRequest)

      setLastSubmittedId(referenceId)
      setTrackingId(referenceId)
      setTrackedRequest({
        ...newRequest,
        createdAt: null
      })

      setForm({ ...EMPTY_FORM })
      setLocationMessage('')
      setTrackingMessage('')

      const requestsQuery = isAdmin
        ? collection(db, 'requests')
        : query(
          collection(db, 'requests'),
          where('userId', '==', user.uid)
        )

      const snapshot = await getDocs(requestsQuery)

      setRequests(
        snapshot.docs.map((item) => ({
          ...item.data(),
          firestoreId: item.id
        }))
      )
    } catch (error) {
      console.error('Could not submit request:', error)
      setDatabaseError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTrackRequest(event) {
    event.preventDefault()

    if (!user) {
      openAuth('login')
      return
    }

    if (!user.emailVerified) {
      setTrackingMessage(
        'Please verify your email address before tracking requests.'
      )
      return
    }

    setTrackedRequest(null)
    setTrackingMessage('')

    const referenceId = trackingId.trim()

    if (!referenceId) {
      setTrackingMessage('Enter your request reference number.')
      return
    }

    try {
      const requestsCollection = collection(db, 'requests')

      const trackingQuery = isAdmin
        ? query(
          requestsCollection,
          where('referenceId', '==', referenceId)
        )
        : query(
          requestsCollection,
          where('referenceId', '==', referenceId),
          where('userId', '==', user.uid)
        )

      const snapshot = await getDocs(trackingQuery)

      if (snapshot.empty) {
        setTrackingMessage(
          'No request with that reference number was found in your account.'
        )
        return
      }

      const item = snapshot.docs[0]

      setTrackedRequest({
        ...item.data(),
        firestoreId: item.id
      })
    } catch (error) {
      console.error('Tracking failed:', error)
      setTrackingMessage(getErrorMessage(error))
    }
  }

  async function handleStatusUpdate(requestItem, newStatus) {
    if (!isAdmin || !user?.emailVerified) {
      setDatabaseError(
        'Only a verified administrator can change request statuses.'
      )
      return
    }

    try {
      setDatabaseError('')

      await updateDoc(
        doc(db, 'requests', requestItem.firestoreId),
        { status: newStatus }
      )

      setRequests((previous) =>
        previous.map((item) =>
          item.firestoreId === requestItem.firestoreId
            ? { ...item, status: newStatus }
            : item
        )
      )

      if (trackedRequest?.firestoreId === requestItem.firestoreId) {
        setTrackedRequest((previous) => ({
          ...previous,
          status: newStatus
        }))
      }
    } catch (error) {
      console.error('Could not update status:', error)
      setDatabaseError(getErrorMessage(error))
    }
  }

  const visibleRequests = requests.filter((item) => {
    const searchableText = [
      item.referenceId,
      item.name,
      item.category,
      item.location,
      item.phone,
      item.email
    ]
      .join(' ')
      .toLowerCase()

    return (
      searchableText.includes(searchTerm.toLowerCase()) &&
      (statusFilter === 'All' || item.status === statusFilter)
    )
  })

  if (!authReady) {
    return (
      <main className="loading-screen">
        <div className="loading-brand">HudumaConnect</div>
        <p>Loading the public service portal...</p>
      </main>
    )
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="container top-bar-content">
          <span>PUBLIC SERVICE REQUEST PORTAL</span>
        </div>
      </div>

      <header className="navbar">
        <div className="container nav-content">
          <a className="brand" href="#home" onClick={returnHome}>
            <span className="brand-icon">HC</span>
            <span>
              <strong>HudumaConnect</strong>
              <small>Public Service Portal</small>
            </span>
          </a>

          <nav className="nav-links">
            <a href="#home" onClick={returnHome}>Home</a>

            {canUsePortal && !showAuth && !showAdmin && (
              <>
                <a href="#services">Services</a>
                <a href="#submit">Submit Request</a>
                <a href="#track">Track Request</a>
              </>
            )}

            {isAdmin && canUsePortal && (
              <button
                type="button"
                className="nav-dashboard-btn"
                onClick={() => {
                  setShowAdmin(!showAdmin)
                  setShowAuth(false)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {showAdmin ? 'Public Portal' : 'Admin Dashboard'}
              </button>
            )}
          </nav>

          <div className="account-area">
            {user ? (
              <>
                <span className="account-email">{user.email}</span>
                <button
                  type="button"
                  className="outline-btn"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => openAuth('admin')}
                >
                  Admin Login
                </button>

                <button
                  type="button"
                  className="primary-btn nav-signin"
                  onClick={() => openAuth('login')}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {needsEmailVerification && (
          <section className="auth-page">
            <div className="auth-section">
              <p className="eyebrow">EMAIL VERIFICATION</p>
              <h1>Verify your email address</h1>

              <p className="auth-description">
                Verify your email address before using the portal.
              </p>

              <p>
                Verification email sent to:
                <strong> {user.email}</strong>
              </p>

              <p>
                Open the verification email and follow its link.
                Return here when you are finished.
              </p>

              <button
                type="button"
                className="primary-btn auth-submit"
                onClick={handleCheckVerification}
                disabled={verificationLoading}
              >
                {verificationLoading
                  ? 'Checking...'
                  : 'I Have Verified My Email'}
              </button>

              <button
                type="button"
                className="outline-btn"
                onClick={handleResendVerification}
                disabled={verificationLoading}
              >
                Resend Verification Email
              </button>

              {verificationMessage && (
                <p className="notice-message" role="status">
                  {verificationMessage}
                </p>
              )}

              <button
                type="button"
                className="text-button"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </section>
        )}

        {showAuth && !user && (
          <section className="auth-page">
            <div className="auth-section">
              <button
                type="button"
                className="text-button"
                onClick={returnHome}
              >
                Back to Home
              </button>

              <p className="eyebrow">
                {authMode === 'admin'
                  ? 'ADMINISTRATOR ACCESS'
                  : 'HUDUMACONNECT ACCOUNT'}
              </p>

              <h1>
                {authMode === 'register'
                  ? 'Create your account'
                  : authMode === 'admin'
                    ? 'Administrator login'
                    : 'Welcome back'}
              </h1>

              <p className="auth-description">
                {authMode === 'register'
                  ? 'Create an account to submit and track service requests. You will need to verify your email address.'
                  : authMode === 'admin'
                    ? 'Sign in using an authorized administrator account.'
                    : 'Sign in to submit requests and follow their progress.'}
              </p>

              <form onSubmit={handleAuthentication} className="auth-form">
                <label htmlFor="authEmail">Email address</label>
                <input
                  id="authEmail"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  autoComplete="email"
                  required
                />

                <label htmlFor="authPassword">Password</label>
                <input
                  id="authPassword"
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  autoComplete={
                    authMode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  minLength={6}
                  required
                />

                <button
                  type="submit"
                  className="primary-btn auth-submit"
                  disabled={authLoading}
                >
                  {authLoading
                    ? 'Please wait...'
                    : authMode === 'register'
                      ? 'Create Account'
                      : 'Sign In'}
                </button>
              </form>

              {authMessage && (
                <p className="error-message" role="alert">
                  {authMessage}
                </p>
              )}

              {authMode !== 'admin' && (
                <p className="auth-switch">
                  {authMode === 'login'
                    ? "Don't have an account?"
                    : 'Already have an account?'}{' '}

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setAuthMode(
                        authMode === 'login' ? 'register' : 'login'
                      )
                      setAuthMessage('')
                    }}
                  >
                    {authMode === 'login'
                      ? 'Create an account'
                      : 'Sign in'}
                  </button>
                </p>
              )}
            </div>
          </section>
        )}

        {!showAuth && !showAdmin && !needsEmailVerification && (
          <>
            <section id="home" className="hero">
              <div className="container hero-content">
                <div className="hero-text">
                  <p className="eyebrow">YOUR COMMUNITY. YOUR SERVICES.</p>

                  <h1>
                    Public services,
                    <span> made simpler.</span>
                  </h1>

                  <p>
                    A convenient place to report community concerns,
                    submit service requests and follow progress from
                    submission to resolution.
                  </p>

                  <div className="hero-actions">
                    {canUsePortal ? (
                      <a className="primary-btn" href="#submit">
                        Submit a Request
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => openAuth('register')}
                      >
                        Get Started
                      </button>
                    )}

                    <a className="secondary-btn" href="#services">
                      Explore Services
                    </a>
                  </div>

                  <p className="trust-note">
                    <strong>Trusted by your community.</strong>{' '}
                    Requests are linked to your signed-in account.
                    Email verification helps protect access.
                  </p>
                </div>

                <div className="hero-card">
                  <p className="card-eyebrow">HOW IT WORKS</p>
                  <h2>One portal for your service requests</h2>

                  <p className="hero-card-description">
                    Follow a clear process from reporting a concern
                    to receiving a status update.
                  </p>

                  <div className="hero-step">
                    <span className="step-number">01</span>
                    <div>
                      <h3>Submit your request</h3>
                      <p>Choose a service and explain the issue.</p>
                    </div>
                  </div>

                  <div className="hero-step">
                    <span className="step-number">02</span>
                    <div>
                      <h3>Track progress</h3>
                      <p>Use your account to follow the request status.</p>
                    </div>
                  </div>

                  <div className="hero-step">
                    <span className="step-number">03</span>
                    <div>
                      <h3>Receive an update</h3>
                      <p>See when the request is being handled or resolved.</p>
                    </div>
                  </div>

                  <div className="hero-card-footer">
                    Service requests are linked to the signed-in account.
                  </div>
                </div>
              </div>
            </section>

            <section id="services" className="section">
              <div className="container">
                <div className="section-heading">
                  <p className="eyebrow">SERVICE DIRECTORY</p>
                  <h2>How can we help you?</h2>
                  <p>
                    Choose a service category to report an issue in your community.
                  </p>
                </div>

                <div className="services-grid">
                  {services.map((service) => (
                    <article className="service-card" key={service.name}>
                      <span className="service-number">{service.number}</span>
                      <h3>{service.name}</h3>
                      <p>{service.description}</p>

                      {canUsePortal ? (
                        <a
                          className="service-link"
                          href="#submit"
                          onClick={() =>
                            setForm((previous) => ({
                              ...previous,
                              category: service.name
                            }))
                          }
                        >
                          Make a Request
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="service-link service-link-button"
                          onClick={() => openAuth('login')}
                        >
                          Sign In to Continue
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="how-section section">
              <div className="container">
                <div className="section-heading">
                  <p className="eyebrow">SIMPLE PROCESS</p>
                  <h2>Three steps to get started</h2>
                  <p>
                    Submit information clearly and follow your request online.
                  </p>
                </div>

                <div className="steps">
                  <article>
                    <span>01</span>
                    <h3>Create an account</h3>
                    <p>
                      Register and verify your email to access your personal
                      service-request area.
                    </p>
                  </article>

                  <article>
                    <span>02</span>
                    <h3>Submit a request</h3>
                    <p>
                      Choose the category, location and details of the issue.
                    </p>
                  </article>

                  <article>
                    <span>03</span>
                    <h3>Track the outcome</h3>
                    <p>Check your request status whenever you need an update.</p>
                  </article>
                </div>
              </div>
            </section>

            {canUsePortal && (
              <>
                <section id="submit" className="section form-section">
                  <div className="container form-container">
                    <div className="section-heading">
                      <p className="eyebrow">NEW REQUEST</p>
                      <h2>Submit a Service Request</h2>
                      <p>
                        Provide accurate information so the concern can be reviewed.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="request-form">
                      <div className="form-grid">
                        <label>
                          Full name
                          <input
                            name="name"
                            value={form.name}
                            onChange={handleFormChange}
                            autoComplete="name"
                            required
                          />
                        </label>

                        <label>
                          Phone number
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleFormChange}
                            placeholder="+254 712 345 678"
                            autoComplete="tel"
                            maxLength={20}
                            required
                          />
                          <small>
                            Provide a number where service personnel can reach you.
                          </small>
                        </label>

                        <label>
                          Service category
                          <select
                            name="category"
                            value={form.category}
                            onChange={handleFormChange}
                            required
                          >
                            <option value="">Select a service</option>
                            {services.map((service) => (
                              <option key={service.name} value={service.name}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          General location
                          <input
                            name="location"
                            value={form.location}
                            onChange={handleFormChange}
                            placeholder="Area, estate, road or nearby landmark"
                            required
                          />
                        </label>

                        <label className="full-width">
                          Precise location

                          <button
                            type="button"
                            className="outline-btn"
                            onClick={handleUseCurrentLocation}
                            disabled={locationLoading}
                          >
                            {locationLoading
                              ? 'Getting your location...'
                              : 'Use My Current Location'}
                          </button>

                          {locationMessage && (
                            <small role="status">{locationMessage}</small>
                          )}

                          <input
                            type="text"
                            name="mapLocation"
                            value={form.mapLocation}
                            onChange={handleFormChange}
                            placeholder="Paste a Google Maps link or enter latitude, longitude"
                            required
                          />

                          <small>
                            Allow location access when prompted. Alternatively,
                            paste a Google Maps sharing link or enter coordinates
                            such as -1.286389, 36.817223.
                          </small>

                          {form.mapLocation.trim() &&
                            isValidMapLocation(form.mapLocation) && (
                              <a
                                className="service-link"
                                href={getMapsUrl(form.mapLocation)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Preview location in Google Maps
                              </a>
                            )}

                          {form.mapLocation.trim() &&
                            !isValidMapLocation(form.mapLocation) && (
                              <small className="error-message">
                                Enter a valid Google Maps link or coordinates.
                              </small>
                            )}
                        </label>

                        <label className="full-width">
                          Request description
                          <textarea
                            name="description"
                            value={form.description}
                            onChange={handleFormChange}
                            placeholder="Explain the issue clearly"
                            rows={5}
                            required
                          />
                        </label>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="primary-btn"
                          disabled={submitting || locationLoading}
                        >
                          {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                      </div>
                    </form>

                    {lastSubmittedId && (
                      <div className="success-panel" role="status">
                        <p className="eyebrow">SUBMISSION CONFIRMED</p>
                        <h3>Your request has been submitted</h3>
                        <p>
                          Keep this reference number to track your request.
                        </p>
                        <strong className="reference-number">
                          {lastSubmittedId}
                        </strong>
                      </div>
                    )}
                  </div>
                </section>

                <section id="track" className="section">
                  <div className="container tracking-container">
                    <div className="section-heading">
                      <p className="eyebrow">REQUEST STATUS</p>
                      <h2>Track a Request</h2>
                      <p>
                        View requests belonging to your signed-in account.
                      </p>
                    </div>

                    <form
                      onSubmit={handleTrackRequest}
                      className="tracking-form"
                    >
                      <input
                        value={trackingId}
                        onChange={(event) => setTrackingId(event.target.value)}
                        placeholder="Enter your reference number"
                        aria-label="Request reference number"
                        required
                      />

                      <button type="submit" className="primary-btn">
                        Track Request
                      </button>
                    </form>

                    {trackingMessage && (
                      <p className="notice-message" role="status">
                        {trackingMessage}
                      </p>
                    )}

                    {trackedRequest && (
                      <article className="tracking-result">
                        <p className="eyebrow">REQUEST DETAILS</p>
                        <h3>{trackedRequest.category}</h3>

                        <p>
                          Reference number:{' '}
                          <strong>{trackedRequest.referenceId}</strong>
                        </p>
                        <p>
                          Contact number: {trackedRequest.phone || 'Not provided'}
                        </p>
                        <p>Location: {trackedRequest.location}</p>
                        <p>Description: {trackedRequest.description}</p>
                        <p>
                          Status:{' '}
                          <span className="status-label">
                            {trackedRequest.status}
                          </span>
                        </p>
                        <p>Date submitted: {trackedRequest.date}</p>

                        {getMapsUrl(
                          trackedRequest.mapUrl || trackedRequest.mapLocation
                        ) && (
                            <p>
                              <a
                                className="service-link"
                                href={getMapsUrl(
                                  trackedRequest.mapUrl ||
                                  trackedRequest.mapLocation
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open location in Google Maps
                              </a>
                            </p>
                          )}
                      </article>
                    )}
                  </div>
                </section>

                <section className="section form-section">
                  <div className="container">
                    <div className="section-heading">
                      <p className="eyebrow">YOUR ACTIVITY</p>
                      <h2>My Recent Requests</h2>
                      <p>Review your most recent submissions.</p>
                    </div>

                    {loadingRequests && <p>Loading your requests...</p>}

                    {!loadingRequests && requests.length === 0 && (
                      <div className="empty-state">
                        <h3>No requests yet</h3>
                        <p>Your submitted requests will appear here.</p>
                      </div>
                    )}

                    <div className="requests-list">
                      {requests.slice(0, 5).map((item) => (
                        <article
                          className="request-card"
                          key={item.firestoreId}
                        >
                          <div>
                            <p className="request-reference">
                              {item.referenceId}
                            </p>
                            <h3>{item.category}</h3>
                            <p>Location: {item.location}</p>
                            <p>Date: {item.date}</p>
                          </div>

                          <div className="request-card-actions">
                            <span
                              className={`status-label status-${String(
                                item.status
                              ).toLowerCase().replace(' ', '-')}`}
                            >
                              {item.status}
                            </span>

                            <button
                              type="button"
                              className="outline-btn"
                              onClick={() => {
                                setTrackingId(item.referenceId)
                                setTrackedRequest(item)
                                document
                                  .getElementById('track')
                                  ?.scrollIntoView({ behavior: 'smooth' })
                              }}
                            >
                              View Details
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {showAdmin && isAdmin && canUsePortal && (
          <section className="section admin-section">
            <div className="container">
              <div className="admin-heading">
                <div>
                  <p className="eyebrow">ADMINISTRATION</p>
                  <h1>Administrator Dashboard</h1>
                  <p>
                    Review incoming requests and update their status.
                  </p>
                </div>

                <span className="admin-label">
                  Authorized Administrator
                </span>
              </div>

              <div className="admin-stats">
                <article className="admin-stat">
                  <p>Total Requests</p>
                  <h3>{requests.length}</h3>
                </article>

                <article className="admin-stat">
                  <p>Pending</p>
                  <h3>
                    {requests.filter((r) => r.status === 'Pending').length}
                  </h3>
                </article>

                <article className="admin-stat">
                  <p>In Progress</p>
                  <h3>
                    {requests.filter((r) => r.status === 'In Progress').length}
                  </h3>
                </article>

                <article className="admin-stat">
                  <p>Resolved</p>
                  <h3>
                    {requests.filter((r) => r.status === 'Resolved').length}
                  </h3>
                </article>
              </div>

              <div className="admin-toolbar">
                <div>
                  <label htmlFor="searchTerm">Search requests</label>
                  <input
                    id="searchTerm"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Reference, name, category, location or phone"
                  />
                </div>

                <div>
                  <label htmlFor="statusFilter">Filter by status</label>
                  <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="All">All statuses</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingRequests && <p>Loading requests...</p>}

              {!loadingRequests && visibleRequests.length === 0 && (
                <div className="empty-state">
                  <h3>No matching requests</h3>
                  <p>Try a different search term or status filter.</p>
                </div>
              )}

              <div className="admin-request-list">
                {visibleRequests.map((item) => (
                  <article
                    className="admin-request"
                    key={item.firestoreId}
                  >
                    <div className="admin-request-info">
                      <p className="request-reference">
                        {item.referenceId}
                      </p>
                      <h3>{item.category}</h3>

                      <p>
                        <strong>Submitted by:</strong> {item.name}
                      </p>
                      <p>
                        <strong>Email:</strong> {item.email}
                      </p>
                      <p>
                        <strong>Phone:</strong>{' '}
                        {item.phone || 'Not provided'}
                      </p>
                      <p>
                        <strong>General location:</strong> {item.location}
                      </p>
                      <p>
                        <strong>Description:</strong> {item.description}
                      </p>
                      <p>
                        <strong>Date:</strong> {item.date}
                      </p>

                      {(item.mapUrl || item.mapLocation) && (
                        <p>
                          <strong>Precise location:</strong>{' '}
                          {item.mapLocation || item.mapUrl}{' '}

                          {getMapsUrl(
                            item.mapUrl || item.mapLocation
                          ) && (
                              <a
                                className="service-link"
                                href={getMapsUrl(
                                  item.mapUrl || item.mapLocation
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open in Google Maps
                              </a>
                            )}
                        </p>
                      )}
                    </div>

                    <div className="admin-status-control">
                      <label htmlFor={`status-${item.firestoreId}`}>
                        Request status
                        <select
                          id={`status-${item.firestoreId}`}
                          value={item.status}
                          onChange={(event) =>
                            handleStatusUpdate(item, event.target.value)
                          }
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {databaseError && (
          <div className="container">
            <div className="error-message" role="alert">
              {databaseError}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="container footer-content">
          <div>
            <strong>HudumaConnect</strong>
            <p>Public Service Request System</p>
          </div>

          <div className="footer-disclaimer">
            <p>Academic demonstration project.</p>
            <p>Not an official government website.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
