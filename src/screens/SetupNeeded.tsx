export function SetupNeeded() {
  return (
    <main className="page narrow">
      <h1>Khooneh</h1>
      <div className="card">
        <p><strong>Firebase isn’t configured yet.</strong></p>
        <ol>
          <li>Create a free Firebase project and add a Web app.</li>
          <li>Enable <em>Anonymous</em> sign-in and Cloud Firestore.</li>
          <li>Paste the web config into <code>src/firebase/config.ts</code>.</li>
          <li>Deploy <code>firestore.rules</code> and rebuild.</li>
        </ol>
        <p className="muted">See README.md for the full steps.</p>
      </div>
    </main>
  );
}
