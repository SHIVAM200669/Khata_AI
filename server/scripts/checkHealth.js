async function check() {
  try {
    const r1 = await fetch('http://localhost:5000/api/health');
    console.log('Backend port 5000:', r1.status, await r1.json());
  } catch (e) {
    console.log('Backend port 5000 error:', e.message);
  }

  try {
    const r2 = await fetch('http://localhost:5173/api/health');
    console.log('Vite proxy port 5173:', r2.status, await r2.json());
  } catch (e) {
    console.log('Vite proxy port 5173 error:', e.message);
  }
}

check();
