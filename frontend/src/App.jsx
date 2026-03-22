const apiBase = 'http://127.0.0.1:8000/api/v1'

function App() {
  async function checkHealth() {
    try {
      const res = await fetch(`${apiBase}/health`)
      if (!res.ok) {
        throw new Error('health check failed')
      }
      const data = await res.json()
      alert(`后端状态: ${data.status} @ ${data.time}`)
    } catch (error) {
      alert(`请求失败: ${error.message}`)
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>独行青年安全守护</h1>
        <p>当前为 MVP 骨架：FastAPI + React</p>
        <button type="button" onClick={checkHealth}>
          检查后端连通性
        </button>
      </section>
    </main>
  )
}

export default App
